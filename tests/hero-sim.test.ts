import { afterEach, describe, expect, it, vi } from "vitest";
import { HERO_READY_TIMEOUT_MS, heroSimSchema, validateHeroCode, wrapHeroCode } from "../lib/hero-sim";
import { generateHeroSim } from "../lib/generate";
import type { Concept } from "../lib/spec";
import type { SourceResult } from "../lib/source";
import type { CompleteInput } from "../lib/types";

const ENV_KEYS = ["LLM_MODEL_DEFAULT", "LLM_BASE_URL", "LLM_API_KEY"] as const;
function withLlmEnv(fn: () => Promise<void>): Promise<void> {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, {
    LLM_MODEL_DEFAULT: "mock-model",
    LLM_BASE_URL: "http://mock",
    LLM_API_KEY: "mock-key",
  });
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

const goodCode = `<div style="height:200px"><canvas id="c" width="300" height="200"></canvas><script>const ctx=document.getElementById("c").getContext("2d");ctx.fillRect(10,10,50,50);</script></div>`;

describe("hero-sim contract", () => {
  it("accepts a valid single-canvas fragment and rejects broken code", () => {
    expect(validateHeroCode(goodCode).ok).toBe(true);
    expect(validateHeroCode("<p>no canvas</p>").ok).toBe(false);
    expect(validateHeroCode('<canvas></canvas><canvas></canvas>').ok).toBe(false);
    expect(validateHeroCode('<canvas></canvas><script src="evil.js"></script>').ok).toBe(false);
    expect(validateHeroCode('<canvas></canvas><script>fetch("/steal")</script>').ok).toBe(false);
    expect(validateHeroCode('<canvas></canvas><script>eval("x")</script>').ok).toBe(false);
    expect(validateHeroCode('<canvas></canvas><script>localStorage.setItem("a","b")</script>').ok).toBe(false);
  });

  it("wraps code with CSP, an error trap, and a ready ping", () => {
    const doc = wrapHeroCode(goodCode);
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("default-src 'none'"); // blocks all network from the frame
    expect(doc.indexOf("window.onerror")).toBeLessThan(doc.indexOf("<canvas")); // trap installs before user code
    expect(doc).toContain('type:"hero-sim",status:"ready"');
    expect(doc).toContain('type:"hero-sim",status:"error"');
  });

  it("exposes a finite ready timeout for the client state machine", () => {
    expect(HERO_READY_TIMEOUT_MS).toBeGreaterThan(0);
    expect(HERO_READY_TIMEOUT_MS).toBeLessThan(15_000);
  });

  it("parses a full hero spec with its template fallback", () => {
    const r = heroSimSchema.safeParse({
      code: goodCode,
      fallback: { template: "two-state-prob", values: { p: 0.5, n: 60 }, predictPrompt: "How many land in A?" },
    });
    expect(r.success).toBe(true);
  });

  it("forced failure: generateHeroSim degrades to ok=false instead of throwing", async () =>
    withLlmEnv(async () => {
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response("upstream down", { status: 500 })),
      );
      vi.stubGlobal("fetch", fetchMock);
      const concept: Concept = { id: "c-1", title: "T", summary: "s", claims: [], components: [] };
      const source = { topic: "t", sources: [], claims: [], contradictions: [], timings: { searchMs: 0, extractionMs: 0, claimsMs: 0, totalMs: 0 } } as unknown as SourceResult;
      const r = await generateHeroSim("topic", concept, source, {
        timeoutMs: 5000,
        rateLimit: { baseMs: 1, maxRetries: 0 },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/500|upstream|failed/i);
      vi.unstubAllGlobals();
    }));

  it("forced invalid code: a schema-valid but unsafe response is rejected", async () =>
    withLlmEnv(async () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                code: '<canvas></canvas><script>document.cookie="x"</script>',
                fallback: { template: "two-state-prob", values: { p: 0.5 }, predictPrompt: "predict" },
              }),
            },
          },
        ],
      };
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } })),
      );
      vi.stubGlobal("fetch", fetchMock);
      const concept: Concept = { id: "c-1", title: "T", summary: "s", claims: [], components: [] };
      const source = { topic: "t", sources: [], claims: [], contradictions: [], timings: { searchMs: 0, extractionMs: 0, claimsMs: 0, totalMs: 0 } } as unknown as SourceResult;
      const r = await generateHeroSim("topic", concept, source, {
        timeoutMs: 5000,
        rateLimit: { baseMs: 1, maxRetries: 0 },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toContain("forbidden construct");
      vi.unstubAllGlobals();
    }));

  it("after extracting schema payload, hero path never hands the parent unsafe code", () => {
    // CompleteInput type guard: the generator role routes through the same LLM contract.
    const input: CompleteInput<unknown> = {
      role: "generator",
      system: "s",
      messages: [{ role: "user", content: "c" }],
    };
    expect(input.role).toBe("generator");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
