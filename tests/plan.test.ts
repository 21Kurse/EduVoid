import { afterEach, describe, expect, it, vi } from "vitest";
import { runPlanStage } from "../lib/plan";
import type { SourceRecord } from "../lib/source";

const ENV_KEYS = ["LLM_MODEL_DEFAULT", "LLM_BASE_URL", "LLM_API_KEY"] as const;
function withLlmEnv(fn: () => Promise<void>): Promise<void> {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, {
    LLM_MODEL_DEFAULT: "mock-model",
    LLM_MODEL_PLANNER: "mock-planner",
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

const SOURCES: SourceRecord[] = [
  {
    id: "src-1",
    title: "Lecture notes on superposition",
    url: "https://uni.example/notes",
    authority: "university",
    passages: [{ id: "src-1-p1", label: "extracted", text: "Superposition means weighted states.", url: "" }],
  },
];

function mockPlan(content: object) {
  return vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
        { status: 200 },
      ),
    ),
  );
}

const GOOD_PLAN = {
  concepts: [
    { id: "states-and-superposition", title: "States and superposition", summary: "States are vectors." },
    { id: "born-rule", title: "The Born rule", summary: "Probabilities from amplitudes." },
    { id: "interference", title: "Interference", summary: "Amplitudes can cancel." },
  ],
  edges: [
    { from: "states-and-superposition", to: "born-rule" },
    { from: "states-and-superposition", to: "interference" },
  ],
};

describe("runPlanStage", () => {
  it("produces a valid skeleton spec from a well-formed plan", () =>
    withLlmEnv(async () => {
      vi.stubGlobal("fetch", mockPlan(GOOD_PLAN));
      const r = await runPlanStage("quantum superposition", "beginner", SOURCES);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.spec.concepts).toHaveLength(3);
        expect(r.spec.edges).toHaveLength(2);
        expect(r.spec.topic).toBe("quantum superposition");
        expect(r.spec.concepts.every((c) => c.components.length === 0)).toBe(true);
        expect(r.latencyMs).toBeGreaterThanOrEqual(0);
      }
    }));

  it("caps concepts at 8 and sanitizes messy ids", () =>
    withLlmEnv(async () => {
      const concepts = Array.from({ length: 12 }, (_, i) => ({
        id: `Big Title ${i}!!`,
        title: `Concept ${i}`,
        summary: "s",
      }));
      vi.stubGlobal("fetch", mockPlan({ concepts, edges: [] }));
      const r = await runPlanStage("t", "beginner", SOURCES);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.spec.concepts.length).toBeLessThanOrEqual(8);
        for (const c of r.spec.concepts) expect(c.id).toMatch(/^[a-z0-9-]+$/);
      }
    }));

  it("drops unknown/self/cyclic edges, keeping the graph acyclic", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        mockPlan({
          concepts: GOOD_PLAN.concepts,
          edges: [
            { from: "states-and-superposition", to: "ghost" },
            { from: "born-rule", to: "born-rule" },
            { from: "born-rule", to: "states-and-superposition" }, // cycle
            { from: "states-and-superposition", to: "born-rule" }, // fine
          ],
        }),
      );
      const r = await runPlanStage("t", "beginner", SOURCES);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.spec.edges).toEqual([{ from: "states-and-superposition", to: "born-rule" }]);
      }
    }));

  it("fails with a visible, bounded error when the planner call fails", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => Promise.resolve(new Response("nope", { status: 400 }))),
      );
      const r = await runPlanStage("t", "beginner", SOURCES);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/400/);
    }));

  it("fails visibly when the model emits invalid plan JSON after retries", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify({ choices: [{ message: { content: "garbage" } }] }), { status: 200 }),
          ),
        ),
      );
      const r = await runPlanStage("t", "beginner", SOURCES, { timeoutMs: 5000 });
      expect(r.ok).toBe(false);
    }));
});
