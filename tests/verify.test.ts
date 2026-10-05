import { afterEach, describe, expect, it, vi } from "vitest";
import { runVerifyStage } from "../lib/verify";
import { generateConcept } from "../lib/generate";
import type { ExtractedClaim, Passage } from "../lib/source";

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

function okResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const PASSAGES: Passage[] = [
  { id: "src-1-p1", label: "extracted", text: "Water boils at 100 degrees Celsius at standard pressure.", url: "" },
  { id: "src-1-p2", label: "extracted", text: "Ice is less dense than liquid water, so it floats.", url: "" },
  { id: "src-2-p1", label: "extracted", text: "Sound travels faster in water than in air.", url: "" },
];

function claim(text: string, passageIds: string[], id = "claim-x-1"): ExtractedClaim {
  const sourceIds = [...new Set(passageIds.map((p) => p.replace(/-p\d+$/, "")))];
  return { id, text, passageIds, sourceIds, status: "supported" };
}

describe("runVerifyStage — deterministic layer", () => {
  it("drops claims citing unknown passage IDs without calling the model", async () =>
    withLlmEnv(async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const r = await runVerifyStage({
        claims: [
          claim("Water boils at 100 C at standard pressure.", ["src-1-p1"], "claim-a-1"),
          claim("Cites a passage that does not exist.", ["src-9-p9"], "claim-a-2"),
        ],
        passages: PASSAGES,
      });
      // Unknown-passage claim dropped deterministically; the survivor is the
      // only thing sent to the verifier.
      expect(r.claims.map((c) => c.id)).toEqual(["claim-a-1"]);
      expect(r.total).toBe(1);
      const init = vi.mocked(fetchMock).mock.calls[0][1] as unknown as { body: string };
      const body = JSON.parse(init.body) as { messages: { content: string }[] };
      const prompt = body.messages.map((m) => m.content).join(" ");
      expect(prompt).not.toContain("does not exist");
    }));
});

describe("runVerifyStage — LLM entailment layer", () => {
  it("flags unsupported and contradicted claims with reasons, keeps supported", async () =>
    withLlmEnv(async () => {
      const claims = [
        claim("Water boils at 100 C at standard pressure.", ["src-1-p1"], "claim-b-1"),
        claim("Water boils at 50 C at standard pressure.", ["src-1-p1"], "claim-b-2"),
        claim("Sound travels slower in water than in air.", ["src-2-p1"], "claim-b-3"),
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(
            okResponse({
              verdicts: [
                { id: "claim-b-1", verdict: "supported" },
                { id: "claim-b-2", verdict: "contradicted" },
                { id: "claim-b-3", verdict: "unsupported" },
              ],
            }),
          ),
        ),
      );
      const r = await runVerifyStage({ claims, passages: PASSAGES });
      expect(r.degraded).toBe(false);
      expect(r.claims.find((c) => c.id === "claim-b-1")?.status).toBe("supported");
      const c2 = r.claims.find((c) => c.id === "claim-b-2");
      expect(c2?.status).toBe("flagged");
      expect(c2?.flagReason).toContain("contradicted");
      const c3 = r.claims.find((c) => c.id === "claim-b-3");
      expect(c3?.status).toBe("flagged");
      expect(c3?.flagReason).toContain("not supported");
      expect(r.flagged).toBe(2);
      expect(r.supported).toBe(1);
      expect(r.total).toBe(3);
    }));

  it("ignores verdicts for ids outside the batch (hallucinated ids cannot flag)", async () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(
            okResponse({
              verdicts: [
                { id: "claim-c-1", verdict: "supported" },
                { id: "claim-not-real", verdict: "contradicted" },
              ],
            }),
          ),
        ),
      );
      const r = await runVerifyStage({
        claims: [claim("Real claim.", ["src-1-p1"], "claim-c-1")],
        passages: PASSAGES,
      });
      expect(r.claims[0].status).toBe("supported");
      expect(r.flagged).toBe(0);
    }));

  it("degrades visibly but never throws when the verifier transport fails", async () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(new Response("rate limited", { status: 429 })),
        ),
      );
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const r = await runVerifyStage({
        claims: [claim("Some claim.", ["src-1-p1"], "claim-d-1")],
        passages: PASSAGES,
      });
      errSpy.mockRestore();
      expect(r.degraded).toBe(true);
      expect(r.claims[0].status).toBe("supported"); // keeps extraction status
      expect(r.flagged).toBe(0);
    }));

  it("summarizes sources/passages counts from supported claims only", async () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(
            okResponse({
              verdicts: [
                { id: "claim-e-1", verdict: "supported" },
                { id: "claim-e-2", verdict: "unsupported" },
              ],
            }),
          ),
        ),
      );
      const r = await runVerifyStage({
        claims: [
          claim("Boils at 100 C.", ["src-1-p1", "src-1-p2"], "claim-e-1"),
          claim("Flagged claim.", ["src-2-p1"], "claim-e-2"),
        ],
        passages: PASSAGES,
      });
      expect(r.supported).toBe(1);
      expect(r.passages).toBe(2);
      expect(r.sources).toBe(1);
    }));

  it("batches claims so no single call exceeds the batch size", async () =>
    withLlmEnv(async () => {
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(okResponse({ verdicts: [] })),
      );
      vi.stubGlobal("fetch", fetchMock);
      const many = Array.from({ length: 20 }, (_, i) =>
        claim(`Claim ${i} states a fact.`, ["src-1-p1"], `claim-f-${i + 1}`),
      );
      await runVerifyStage({ claims: many, passages: PASSAGES });
      expect(fetchMock).toHaveBeenCalledTimes(2); // 20 / batch 12 -> 2 batches
    }));
});

describe("verified claims flow into generation", () => {
  it("generateConcept grounds only on supported claims (flagged excluded from prompt)", async () =>
    withLlmEnv(async () => {
      let capturedBody = "";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url: unknown, init: { body: string }) => {
          capturedBody = init.body;
          return Promise.resolve(
            okResponse({ explainer: "The explainer body.", quiz: [], flashcards: [] }),
          );
        }),
      );
      const source = {
        topic: "t",
        sources: [
          {
            id: "src-1",
            title: "S1",
            url: "https://s1.example",
            authority: "explainer" as const,
            passages: PASSAGES,
          },
        ],
        claims: [
          claim("Supported claim text.", ["src-1-p1"], "claim-g-1"),
          { ...claim("Flagged claim text.", ["src-1-p2"], "claim-g-2"), status: "flagged" as const, flagReason: "x" },
        ],
        contradictions: [],
        timings: { searchMs: 0, extractionMs: 0, claimsMs: 0, totalMs: 0 },
      };
      const g = await generateConcept("t", { id: "concept-g", title: "T", summary: "S" }, source);
      expect(g.ok).toBe(true);
      const body = JSON.parse(capturedBody) as { messages: { content: string }[] };
      const prompt = body.messages.map((m) => m.content).join("\n");
      expect(prompt).toContain("Supported claim text.");
      expect(prompt).not.toContain("Flagged claim text.");
    }));
});
