/**
 * Model routing and the OpenAI-compatible transport (NIM/GLM endpoints).
 * Split out of lib/llm.ts to keep files small.
 */

import { type ChatRequest, type ChatResponse, type Role, type TokenUsage } from "./types.ts";

/** Role -> model ID from env. Missing values surface as no-config, never a guess. */
export function modelForRole(role: Role): string | null {
  const specific = process.env[`LLM_MODEL_${role.toUpperCase()}`];
  if (specific && specific.trim()) return specific.trim();
  const fallback = process.env.LLM_MODEL_DEFAULT;
  if (fallback && fallback.trim()) return fallback.trim();
  return null;
}

/** HTTP error with status, so callers can special-case 429/5xx. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function openAiCompatibleTransport(
  req: ChatRequest & { baseUrl: string; apiKey: string },
): Promise<ChatResponse> {
  const res = await fetch(`${req.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${req.apiKey}`,
    },
    signal: AbortSignal.timeout(req.timeoutMs ?? 120_000),
    body: JSON.stringify({
      model: req.model,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        ...req.messages,
      ],
      ...(req.bodyExtras ?? {}),
    }),
  });
  if (!res.ok) {
    throw new HttpError(
      res.status,
      `LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const message = json.choices?.[0]?.message;
  // Some reasoning models put the answer in `content` and thinking in
  // `reasoning_content`; others return only reasoning_content.
  const text = message?.content ?? message?.reasoning_content ?? "";
  if (!text) throw new Error("LLM response had no message content");
  const usage: TokenUsage | undefined = json.usage
    ? {
        promptTokens: json.usage.prompt_tokens,
        completionTokens: json.usage.completion_tokens,
        reasoningTokens: json.usage.completion_tokens_details?.reasoning_tokens,
      }
    : undefined;
  return { text, usage };
}

export function envTransport(): ((req: ChatRequest) => Promise<ChatResponse>) | null {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  // Credentials bound here; call sites pass only ChatRequest.
  return (req) => openAiCompatibleTransport({ ...req, baseUrl, apiKey });
}
