import { afterEach, describe, expect, it, vi } from "vitest";
import { generateConcept } from "../lib/generate";
import { MODALITY_CYCLE } from "../lib/mastery";
import { MODALITY_HINT } from "../lib/modality";
import type { SourceResult } from "../lib/source";

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

afterEach(() => vi.unstubAllGlobals());

const CONCEPT = { id: "born-rule", title: "The Born rule", summary: "Probabilities from amplitudes." };
const SOURCE: SourceResult = {
  topic: "quantum superposition",
  sources: [
    {
      id: "src-1",
      title: "Notes",
      url: "https://uni.example",
      authority: "university",
      passages: [{ id: "src-1-p1", label: "extracted", text: "P = |alpha|^2.", url: "" }],
    },
  ],
  claims: [
    {
      id: "claim-1",
      text: "Measurement probability equals |amplitude|^2.",
      passageIds: ["src-1-p1"],
      sourceIds: ["src-1"],
      status: "supported",
    },
  ],
  contradictions: [],
  timings: { searchMs: 1, extractionMs: 0, claimsMs: 1, totalMs: 2 },
};

const GOOD_GEN = {
  explainer: "The **Born rule** says $P(0) = |\\\\alpha|^2$.",
  quiz: [
    { prompt: "P(0) for alpha=0.6?", options: ["0.36", "0.6"], answer: 0, explanation: "0.6^2." },
    { prompt: "Bad item", options: ["a"], answer: 0, explanation: "x" }, // invalid: 1 option
  ],
  flashcards: [{ front: "Born rule?", back: "P = |amplitude|^2." }],
  sim: { template: "two-state-prob", values: { alpha: 0.6, beta: 0.8 }, predictPrompt: "Predict the fraction." },
};

function okResponse(content: object) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
  });
}

describe("generateConcept", () => {
  it("assembles typed components with deterministic ids and salvages per item", () =>
    withLlmEnv(async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(GOOD_GEN)));
      const r = await generateConcept("quantum superposition", CONCEPT, SOURCE);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const types = r.concept.components.map((c) => c.type);
        expect(types).toEqual(["explainer", "quiz", "flashcards", "sim"]);
        const quiz = r.concept.components.find((c) => c.type === "quiz");
        if (quiz?.type === "quiz") {
          expect(quiz.questions).toHaveLength(1); // invalid item salvaged out
          expect(quiz.questions[0].id).toBe("born-rule-q1");
        }
      }
    }));

  it("fails visibly when the explainer is missing", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(okResponse({ explainer: "", quiz: [], flashcards: [] })),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/empty explainer/);
    }));

  it("fails visibly on transport errors without throwing", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => Promise.resolve(new Response("down", { status: 400 }))),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE, { timeoutMs: 5000 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/transport/);
    }));

  it("drops sim components with unknown templates (hand-built set only)", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({
            explainer: "E",
            quiz: [],
            flashcards: [],
            sim: { template: "grand-piano", values: {}, predictPrompt: "?" },
          }),
        ),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.concept.components.some((c) => c.type === "sim")).toBe(false);
      }
    }));

  it("assigns grounded claims to the concept and numbers explainer markers (G3 F2)", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({
            ...GOOD_GEN,
            explainer: "Probability is the squared amplitude. [[claim-1]] Done.",
            grounding: ["claim-1", "claim-nonexistent"],
          }),
        ),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.concept.claims.map((c) => c.id)).toEqual(["claim-1"]);
        const explainer = r.concept.components.find((c) => c.type === "explainer");
        if (explainer?.type === "explainer") {
          expect(explainer.markdown).toContain("[1](#claim-claim-1)");
          expect(explainer.markdown).not.toContain("[[");
        }
      }
    }));

  it("strips markers for ungrounded claims and keeps concept.claims empty", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({ ...GOOD_GEN, explainer: "Facts [[claim-1]] hold. claim 4 says so." }),
        ),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.concept.claims).toEqual([]);
        const explainer = r.concept.components.find((c) => c.type === "explainer");
        if (explainer?.type === "explainer") {
          expect(explainer.markdown).not.toContain("[[");
          expect(explainer.markdown).not.toMatch(/claim\s+4/i);
        }
      }
    }));

  it("fails honestly when the requested modality is missing from output (G3 F3)", () =>
    withLlmEnv(async () => {
      // Both attempts lack flashcards -> adaptation must fail with a visible
      // detail, not return a banner-worthy concept without flashcards.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(okResponse({ explainer: "E", quiz: [], flashcards: [] })),
        ),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE, { modality: "flashcards" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/no usable 'flashcards'/);
    }));

  it("retries once with a stronger requirement and then honors the modality (G3 F3)", () =>
    withLlmEnv(async () => {
      const responses = [
        okResponse({ explainer: "E", quiz: [], flashcards: [] }),
        okResponse({
          explainer: "E",
          quiz: [],
          flashcards: [
            { front: "f1", back: "b1" },
            { front: "f2", back: "b2" },
          ],
        }),
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => Promise.resolve(responses.shift() ?? responses[0])),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE, { modality: "flashcards" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const fc = r.concept.components.find((c) => c.type === "flashcards");
        expect(fc?.type).toBe("flashcards");
        expect(r.concept.components.some((c) => c.type === "sim")).toBe(false);
      }
    }));

  it("treats a sim-less regeneration as a failure in sim mode (G3 F3)", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(okResponse({ explainer: "E", quiz: [], flashcards: [] })),
        ),
      );
      const r = await generateConcept("t", CONCEPT, SOURCE, { modality: "sim" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/no usable 'sim'/);
    }));

  it("has an adaptation hint for every modality in the cycle (T11)", () => {
    for (const m of MODALITY_CYCLE) expect(MODALITY_HINT[m]).toMatch(/\S/);
  });

  it("sends the adaptation hint to the model when regenerating in a modality", () =>
    withLlmEnv(async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse(GOOD_GEN));
      vi.stubGlobal("fetch", fetchMock);
      const r = await generateConcept("t", CONCEPT, SOURCE, { modality: "sim" });
      expect(r.ok).toBe(true);
      const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
        messages: { content: string }[];
      };
      expect(body.messages.map((m) => m.content).join("\n")).toContain(
        'Adaptation mode "simulation"',
      );
    }));
});
