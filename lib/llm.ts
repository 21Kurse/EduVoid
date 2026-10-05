/**
 * Provider-agnostic LLM access (AGENTS.md §3). All model calls go through
 * complete(): role-based routing, JSON extraction, zod validation, schema
 * retries with the error fed back, bounded 429/5xx backoff, and a transport
 * timeout. Failure contract: never throws — returns a discriminated result
 * so callers render a visible, non-crashing state (§12).
 */

import { extractJson } from "./extract.ts";
import { envTransport, HttpError, modelForRole } from "./transport.ts";
import type {
  ChatResponse,
  CompleteInput,
  CompleteResult,
  LlmMessage,
  TokenUsage,
} from "./types.ts";

export { HttpError, modelForRole, openAiCompatibleTransport } from "./transport.ts";
export { extractJson } from "./extract.ts";
export type {
  ChatRequest,
  ChatResponse,
  ChatTransport,
  CompleteErr,
  CompleteInput,
  CompleteOk,
  CompleteResult,
  LlmMessage,
  Role,
  TokenUsage,
} from "./types.ts";

const MAX_RETRIES = 2; // initial attempt + 2 retries (§3)

/** Backoff base for 429/5xx transport retries (exponential). */
const RATE_LIMIT_BASE_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Bounded-concurrency map (protects against rate limits in parallel runs).
 * Results match input order.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/**
 * One completion. With a schema: request JSON, validate with zod, and on
 * failure retry up to 2 times appending the validation error. 429/5xx get
 * exponential backoff within a separately bounded budget. Never throws.
 */
export async function complete<T>(input: CompleteInput<T>): Promise<CompleteResult<T>> {
  const routed = modelForRole(input.role);
  const model = input.modelOverride ?? routed;
  const transport = envTransport();
  const startedAll = Date.now();
  if (!model) {
    return {
      ok: false,
      reason: "no-config",
      detail: `No model configured for role "${input.role}" (set LLM_MODEL_DEFAULT or LLM_MODEL_${input.role.toUpperCase()}).`,
      attempts: 0,
      model: null,
      latencyMs: 0,
    };
  }
  if (!transport) {
    return {
      ok: false,
      reason: "no-config",
      detail: "LLM_BASE_URL / LLM_API_KEY missing; cannot call the model.",
      attempts: 0,
      model,
      latencyMs: 0,
    };
  }

  const messages: LlmMessage[] = [...input.messages];
  let lastIssue = "";
  let lastUsage: TokenUsage | undefined;
  // Rate-limit retries are bounded separately from schema retries, or a
  // persistently-429ing endpoint would loop forever.
  const rateMax = input.rateLimit?.maxRetries ?? 3;
  const rateBaseMs = input.rateLimit?.baseMs ?? RATE_LIMIT_BASE_MS;
  let rateRetries = 0;

  for (let attempt = 1; attempt <= 1 + MAX_RETRIES; attempt++) {
    const t0 = Date.now();
    let res: ChatResponse;
    try {
      res = await transport({
        model,
        system:
          input.schema && attempt === 1
            ? `${input.system}\n\nRespond with ONLY a JSON object matching the requested shape. No prose, no markdown fences.`
            : input.system,
        messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        bodyExtras: input.bodyExtras,
        timeoutMs: input.timeoutMs,
      });
    } catch (e) {
      // Retry only on 429/5xx, with exponential backoff, within a separate
      // bounded budget so a hard rate limit terminates.
      const status = e instanceof HttpError ? e.status : undefined;
      const retryable = status !== undefined && (status === 429 || status >= 500);
      if (retryable && rateRetries < rateMax) {
        rateRetries += 1;
        await sleep(rateBaseMs * 2 ** (rateRetries - 1));
        attempt -= 1; // rate limiting must not consume a schema-retry slot
        continue;
      }
      return {
        ok: false,
        reason: "transport",
        detail: e instanceof Error ? e.message : String(e),
        attempts: attempt,
        model,
        status,
        latencyMs: Date.now() - startedAll,
        usage: lastUsage,
      };
    }

    lastUsage = res.usage;
    const raw = res.text;

    if (!input.schema) {
      return {
        ok: true,
        data: raw as unknown as T,
        raw,
        attempts: attempt,
        model,
        latencyMs: Date.now() - t0,
        usage: res.usage,
      };
    }

    const parsed = extractJson(raw);
    if (parsed === null) {
      lastIssue = "Response contained no parseable JSON.";
    } else {
      const result = input.schema.safeParse(parsed);
      if (result.success) {
        return {
          ok: true,
          data: result.data,
          raw,
          attempts: attempt,
          model,
          latencyMs: Date.now() - t0,
          usage: res.usage,
        };
      }
      lastIssue = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    }

    // Feed the validation error back for the retry (§3).
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `Your JSON failed validation: ${lastIssue}\nReturn corrected JSON only, same requested shape.`,
    });
  }

  return {
    ok: false,
    reason: "schema",
    detail: lastIssue,
    attempts: 1 + MAX_RETRIES,
    model,
    latencyMs: Date.now() - startedAll,
    usage: lastUsage,
  };
}
