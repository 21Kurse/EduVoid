import { afterEach, describe, expect, it, vi } from "vitest";
import { rankAuthorityHint, slicePassages } from "../lib/source";
import { runSourceStage } from "../lib/source";
import type { SearchProvider } from "../lib/search";

// Hermetic LLM config for the mock transport (vitest does not load .env.local).
const ENV_KEYS = ["LLM_MODEL_DEFAULT", "LLM_BASE_URL", "LLM_API_KEY"] as const;
function withLlmEnv(fn: () => Promise<void>): Promise<void> {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, {
    LLM_MODEL_DEFAULT: "mock-model",
    LLM_BASE_URL: "https://mock.example/v1",
    LLM_API_KEY: "mock-key",
  });
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const LONG = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} states a fact about the topic.`).join(" ");

function mockProvider(results: { title: string; url: string; content?: string }[]): SearchProvider {
  return { search: vi.fn().mockResolvedValue(results) };
}

describe("slicePassages", () => {
  it("splits long content into stable, sentence-bounded passages", () => {
    const ps = slicePassages("src-1", LONG);
    expect(ps.length).toBeGreaterThan(1);
    expect(ps[0].id).toBe("src-1-p1");
    expect(ps[1].id).toBe("src-1-p2");
    for (const p of ps) {
      expect(p.label).toBe("extracted");
      expect(p.text.length).toBeGreaterThan(80);
      expect(p.text.length).toBeLessThanOrEqual(1100);
    }
  });

  it("returns [] for empty content", () => {
    expect(slicePassages("src-1", "")).toEqual([]);
    expect(slicePassages("src-1", "   ")).toEqual([]);
  });
});

describe("rankAuthorityHint", () => {
  it("ranks educational/journal domains above unknown ones", () => {
    expect(rankAuthorityHint("https://phys.libretexts.org/x")).toBe("university");
    expect(rankAuthorityHint("https://en.wikipedia.org/wiki/Superposition")).toBe("explainer");
    expect(rankAuthorityHint("https://random-blog.example.com/post")).toBe("other");
  });
});

describe("runSourceStage", () => {
  it("produces sources with passages and schema-valid claims (mock LLM)", () =>
    withLlmEnv(async () => {
    const provider = mockProvider([
      { title: "Lecture notes", url: "https://uni.example/lecture", content: LONG.slice(0, 2000) },
      { title: "Encyclopedia", url: "https://en.wikipedia.org/wiki/Topic", content: LONG.slice(0, 1500) },
    ]);
    // Per-source extraction: the mock reads the prompt to answer per source.
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      const body = String(init?.body ?? "");
      const which = body.includes("src-1-p1") ? "s1" : "s2";
      const content = JSON.stringify(
        which === "s1"
          ? {
              claims: [
                { text: "Fact A holds for the topic.", passageRefs: ["src-1-p1"] },
                { text: "Fact B follows from fact A.", passageRefs: ["src-1-p2"] },
              ],
              contradictions: [],
            }
          : {
              claims: [
                { text: "Fact C adds a cross-source view.", passageRefs: ["src-2-p1"] },
              ],
              contradictions: [],
            },
      );
      return Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await runSourceStage("test topic", provider);
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].passages.length).toBeGreaterThan(0);
      expect(result.claims).toHaveLength(3);
      expect(result.claims[0].sourceIds).toEqual(["src-1"]);
      expect(result.claims[2].sourceIds).toEqual(["src-2"]);
      expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
      expect(result.timings.searchMs).toBeGreaterThanOrEqual(0);
    } finally {
      vi.unstubAllGlobals();
    }
    }));

  it("caches results per topic (second call does not re-search)", () =>
    withLlmEnv(async () => {
    const provider = mockProvider([
      { title: "A", url: "https://a.example", content: LONG.slice(0, 900) },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ choices: [{ message: { content: '{"claims":[],"contradictions":[]}' } }] }),
            { status: 200 },
          ),
        ),
      ),
    );
    try {
      await runSourceStage("cache-me", provider);
      await runSourceStage("cache-me", provider);
      expect(provider.search).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
    }));  it("degrades visibly (empty claims, no crash) when the LLM fails", () =>
    withLlmEnv(async () => {
      const provider = mockProvider([
        { title: "A", url: "https://a.example", content: LONG.slice(0, 900) },
      ]);
      // 400 is a non-retryable client error: surfaces immediately (500s would
      // exercise the bounded backoff instead — covered in llm.test.ts).
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => Promise.resolve(new Response("down", { status: 400 }))),
      );
    try {
      const result = await runSourceStage("llm-down-topic", provider);
      expect(result.claims).toEqual([]);
      expect(result.sources.length).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
    }));

  it("drops claims that cite unknown passages (deterministic check)", () =>
    withLlmEnv(async () => {
    const provider = mockProvider([
      { title: "A", url: "https://a.example", content: LONG.slice(0, 900) },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      claims: [
                        { text: "Good claim.", passageRefs: ["src-1-p1"] },
                        { text: "Bad claim.", passageRefs: ["src-9-p9"] },
                      ],
                      contradictions: [],
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    try {
      const result = await runSourceStage("ref-check-topic", provider);
      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].text).toBe("Good claim.");
    } finally {
      vi.unstubAllGlobals();
    }
    }));
});
