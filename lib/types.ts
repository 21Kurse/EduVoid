/**
 * LLM types (AGENTS.md §3). Split out of lib/llm.ts to keep files small.
 */

import type { z } from "zod";

export type Role = "planner" | "generator" | "verifier" | "grader";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  /** Reasoning/thinking tokens when the provider reports them. */
  reasoningTokens?: number;
};

export type CompleteInput<T> = {
  role: Role;
  system: string;
  messages: LlmMessage[];
  /** When set, the response must be JSON validating against this schema. */
  schema?: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  /** Per-call model override (spike/probing); env routing is the default. */
  modelOverride?: string;
  /** Provider-specific extras merged into the request body. */
  bodyExtras?: Record<string, unknown>;
  /** Rate-limit (429/5xx) backoff tuning; defaults suit production. */
  rateLimit?: { baseMs?: number; maxRetries?: number };
  /** Per-attempt transport timeout (added for models that hang); ms. */
  timeoutMs?: number;
};

export type CompleteOk<T> = {
  ok: true;
  data: T;
  /** Raw text (JSON string when a schema was given). */
  raw: string;
  attempts: number;
  model: string;
  latencyMs: number;
  usage?: TokenUsage;
};

export type CompleteErr = {
  ok: false;
  /** Why it failed: transport, no-config, or schema validation after retries. */
  reason: "no-config" | "transport" | "schema" | "empty";
  detail: string;
  attempts: number;
  model: string | null;
  /** HTTP status when the failure was an HTTP error (e.g. 429). */
  status?: number;
  latencyMs: number;
  usage?: TokenUsage;
};

export type CompleteResult<T> = CompleteOk<T> | CompleteErr;

/** Everything except credentials — those are injected by the transport factory. */
export type ChatRequest = {
  model: string;
  system: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Provider-specific extras merged into the request body (e.g. thinking off). */
  bodyExtras?: Record<string, unknown>;
  /** Abort the attempt after this many ms (guards against hanging models). */
  timeoutMs?: number;
};

export type ChatResponse = { text: string; usage?: TokenUsage };

/** Minimal OpenAI-compatible chat transport (works for most providers, incl. GLM). */
export type ChatTransport = (req: ChatRequest) => Promise<ChatResponse>;
