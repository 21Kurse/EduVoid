/**
 * Provider-agnostic LLM access (AGENTS.md §3). All model calls go through
 * complete(): role-based routing, JSON extraction, zod validation, and up to
 * 2 retries with the validation error fed back. No model IDs are invented
 * here — everything comes from env (see .env.example; owner supplies at G1).
 *
 * Failure contract: complete() never throws; it returns a discriminated
 * result so callers can render a visible, non-crashing state (§12).
 */

import type { z } from "zod";

export type Role = "planner" | "generator" | "verifier" | "grader";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompleteInput<T> = {
  role: Role;
  system: string;
  messages: LlmMessage[];
  /** When set, the response must be JSON validating against this schema. */
  schema?: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
};

export type CompleteOk<T> = {
  ok: true;
  data: T;
  /** Raw text (JSON string when a schema was given). */
  raw: string;
  attempts: number;
  model: string;
};

export type CompleteErr = {
  ok: false;
  /** Why it failed: transport, no-config, or schema validation after retries. */
  reason: "no-config" | "transport" | "schema" | "empty";
  detail: string;
  attempts: number;
  model: string | null;
};

export type CompleteResult<T> = CompleteOk<T> | CompleteErr;

/** Role -> model ID from env. Missing values must surface as no-config, never a guess. */
export function modelForRole(role: Role): string | null {
  const specific = process.env[`LLM_MODEL_${role.toUpperCase()}`];
  if (specific && specific.trim()) return specific.trim();
  const fallback = process.env.LLM_MODEL_DEFAULT;
  if (fallback && fallback.trim()) return fallback.trim();
  return null;
}

/** Everything except credentials — those are injected by the transport factory. */
export type ChatRequest = {
  model: string;
  system: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
};

/** Minimal OpenAI-compatible chat transport (works for most providers, incl. GLM). */
export type ChatTransport = (req: ChatRequest) => Promise<string>;

export async function openAiCompatibleTransport(
  req: ChatRequest & { baseUrl: string; apiKey: string },
): Promise<string> {
  const res = await fetch(`${req.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        ...req.messages,
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM response had no message content");
  return text;
}

function envTransport(): ChatTransport | null {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  // Credentials bound here; call sites pass only ChatRequest.
  return (req) => openAiCompatibleTransport({ ...req, baseUrl, apiKey });
}

/** Extract the first JSON object/array from model text (handles prose + fences). */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter(
    (s): s is string => typeof s === "string",
  );
  for (const candidate of candidates) {
    const start = candidate.search(/[[{]/);
    if (start === -1) continue;
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}

const MAX_RETRIES = 2; // initial attempt + 2 retries (§3)

/**
 * One completion. With a schema: request JSON, validate with zod, and on
 * failure retry up to 2 times appending the validation error. Never throws.
 */
export async function complete<T>(input: CompleteInput<T>): Promise<CompleteResult<T>> {
  const model = modelForRole(input.role);
  const transport = envTransport();
  if (!model) {
    return {
      ok: false,
      reason: "no-config",
      detail: `No model configured for role "${input.role}" (set LLM_MODEL_DEFAULT or LLM_MODEL_${input.role.toUpperCase()}).`,
      attempts: 0,
      model: null,
    };
  }
  if (!transport) {
    return {
      ok: false,
      reason: "no-config",
      detail: "LLM_BASE_URL / LLM_API_KEY missing; cannot call the model.",
      attempts: 0,
      model,
    };
  }

  const messages: LlmMessage[] = [...input.messages];
  let lastIssue = "";

  for (let attempt = 1; attempt <= 1 + MAX_RETRIES; attempt++) {
    let raw: string;
    try {
      raw = await transport({
        model,
        system:
          input.schema && attempt === 1
            ? `${input.system}\n\nRespond with ONLY a JSON object matching the requested shape. No prose, no markdown fences.`
            : input.system,
        messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });
    } catch (e) {
      return {
        ok: false,
        reason: "transport",
        detail: e instanceof Error ? e.message : String(e),
        attempts: attempt,
        model,
      };
    }

    if (!input.schema) {
      return { ok: true, data: raw as unknown as T, raw, attempts: attempt, model };
    }

    const parsed = extractJson(raw);
    if (parsed === null) {
      lastIssue = "Response contained no parseable JSON.";
    } else {
      const result = input.schema.safeParse(parsed);
      if (result.success) {
        return { ok: true, data: result.data, raw, attempts: attempt, model };
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
  };
}
