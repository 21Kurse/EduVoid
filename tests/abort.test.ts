import { afterEach, describe, expect, it, vi } from "vitest";
import { openAiCompatibleTransport } from "../lib/transport";
import { complete } from "../lib/llm";

const saved = {
  base: process.env.LLM_BASE_URL,
  key: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL_DEFAULT,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (saved.base === undefined) delete process.env.LLM_BASE_URL;
  else process.env.LLM_BASE_URL = saved.base;
  if (saved.key === undefined) delete process.env.LLM_API_KEY;
  else process.env.LLM_API_KEY = saved.key;
  if (saved.model === undefined) delete process.env.LLM_MODEL_DEFAULT;
  else process.env.LLM_MODEL_DEFAULT = saved.model;
});

/** A fetch stub that hangs until its signal aborts, like a slow provider. */
function hangingFetch(seen: { signal?: AbortSignal }): void {
  vi.stubGlobal("fetch", (_url: string, opts: RequestInit) => {
    const signal = opts.signal as AbortSignal;
    seen.signal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () =>
        reject(new DOMException("The operation was aborted.", "AbortError")),
      );
    });
  });
}

describe("client abort cancels the upstream LLM call (T14)", () => {
  it("aborts the in-flight provider fetch when the caller's signal aborts", async () => {
    const controller = new AbortController();
    const seen: { signal?: AbortSignal } = {};
    hangingFetch(seen);

    const pending = openAiCompatibleTransport({
      baseUrl: "https://provider.example/v1",
      apiKey: "test-key",
      model: "test-model",
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    });
    await new Promise((r) => setTimeout(r, 0));

    // A combined signal (timeout + caller) reaches fetch, and it is live.
    expect(seen.signal).toBeDefined();
    expect(seen.signal).not.toBe(controller.signal);
    expect(seen.signal!.aborted).toBe(false);

    controller.abort();
    expect(seen.signal!.aborted).toBe(true);
    await expect(pending).rejects.toThrow(/abort/i);
  });

  it("threads the caller signal through complete() to the provider fetch", async () => {
    process.env.LLM_BASE_URL = "https://provider.example/v1";
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL_DEFAULT = "test-model";
    const controller = new AbortController();
    const seen: { signal?: AbortSignal } = {};
    hangingFetch(seen);

    const pending = complete({
      role: "generator",
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
      rateLimit: { maxRetries: 0 },
    });
    await new Promise((r) => setTimeout(r, 0));
    const upstream = seen.signal;
    expect(upstream).toBeDefined();

    controller.abort();
    expect(upstream!.aborted).toBe(true);

    // Never throws: the abort surfaces as a transport failure the caller renders.
    const res = await pending;
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("transport");
      expect(res.detail).toMatch(/abort/i);
    }
  });

  it("still aborts on the per-attempt timeout when no caller signal exists", async () => {
    const seen: { signal?: AbortSignal } = {};
    hangingFetch(seen);
    const pending = openAiCompatibleTransport({
      baseUrl: "https://provider.example/v1",
      apiKey: "test-key",
      model: "test-model",
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 20,
    });
    await expect(pending).rejects.toThrow(/abort/i);
    expect(seen.signal!.aborted).toBe(true);
  });
});
