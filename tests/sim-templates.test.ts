import { describe, expect, it, vi } from "vitest";
import cachedRaw from "../data/cached/qm-superposition.json";
import { GEN_SYSTEM, generateConcept } from "../lib/generate";
import { HERO_MESSAGES_SYSTEM } from "../lib/hero-sim";
import { parseCachedRun } from "../lib/cached-run";
import {
  IMPLEMENTED_SIM_TEMPLATES,
  SIM_TEMPLATES,
  isImplementedSimTemplate,
  normalizeSimComponents,
  simTemplateOrDefault,
  type SimTemplate,
} from "../lib/sim-templates";
import { componentSchema, type Component, type Concept } from "../lib/spec";
import type { SourceResult } from "../lib/source";

/**
 * Regression guard (freeze-period P2): a judge on an unrelated topic must
 * never see a "coming soon" sim. Only the three hand-built templates exist, so
 * every path that can carry a sim — live generation, adaptation, the cached
 * demo run, the hero fallback — must drop or coerce a reserved id instead of
 * rendering it as a placeholder.
 */

const RESERVED = ["slider-curve", "vector-field"];

function sim(template: string): Component {
  return {
    type: "sim",
    template: template as SimTemplate,
    params: { values: {} },
    predictPrompt: "Predict.",
  };
}

function conceptWith(components: Component[]): Concept {
  return { id: "c1", title: "T", summary: "S", claims: [], components };
}

const EXPLAINER: Component = { type: "explainer", markdown: "x" };
const QUIZ: Component = {
  type: "quiz",
  questions: [
    { id: "q1", prompt: "p", options: ["a", "b"], answer: 0, explanation: "e", passageIds: ["src-1-p1"] },
  ],
};

describe("sim template gate", () => {
  it("knows exactly the three hand-built templates", () => {
    expect([...IMPLEMENTED_SIM_TEMPLATES]).toEqual(["two-state-prob", "double-slit", "bayes-update"]);
    expect(SIM_TEMPLATES.filter((t) => !isImplementedSimTemplate(t))).toEqual(RESERVED);
    for (const t of IMPLEMENTED_SIM_TEMPLATES) expect(isImplementedSimTemplate(t)).toBe(true);
    for (const t of RESERVED) {
      expect(isImplementedSimTemplate(t)).toBe(false);
      expect(simTemplateOrDefault(t)).toBe("two-state-prob");
      expect(simTemplateOrDefault(t, "double-slit")).toBe("double-slit");
    }
  });

  it("the spec schema and the shared list agree (no drift)", () => {
    for (const t of SIM_TEMPLATES) {
      // Reserved ids must still PARSE (the test fixture carries one) — the
      // restriction lives in the generation paths, not in the schema.
      const parsed = componentSchema.safeParse({
        type: "sim",
        template: t,
        params: { values: {} },
        predictPrompt: "Predict.",
      });
      expect(parsed.success, `schema rejects shared template ${t}`).toBe(true);
    }
    expect(
      componentSchema.safeParse({ type: "sim", template: "not-a-template", params: { values: {} }, predictPrompt: "P" }).success,
    ).toBe(false);
  });

  it("prompts name only implemented templates", () => {
    for (const prompt of [GEN_SYSTEM, HERO_MESSAGES_SYSTEM]) {
      for (const t of RESERVED) expect(prompt).not.toContain(t);
      for (const t of IMPLEMENTED_SIM_TEMPLATES) expect(prompt).toContain(t);
    }
  });

  it("normalizeSimComponents drops placeholders and keeps everything else", () => {
    const kept = conceptWith([EXPLAINER, QUIZ, sim("two-state-prob")]);
    const dropped = conceptWith([EXPLAINER, sim("slider-curve")]);
    const [k, d] = normalizeSimComponents([kept, dropped]);

    expect(k).toBe(kept); // untouched concepts keep their identity
    expect(k.components).toHaveLength(3);
    expect(d).not.toBe(dropped);
    expect(d.components.map((c) => c.type)).toEqual(["explainer"]);
    expect(JSON.stringify(normalizeSimComponents([kept, dropped]))).not.toMatch(
      /slider-curve|vector-field/,
    );
  });
});

const ENV_KEYS = ["LLM_MODEL_DEFAULT", "LLM_BASE_URL", "LLM_API_KEY"] as const;

const SOURCE: SourceResult = {
  topic: "the water cycle",
  sources: [
    {
      id: "src-1",
      title: "Notes",
      url: "https://uni.example",
      authority: "university",
      passages: [{ id: "src-1-p1", label: "extracted", text: "Evaporation, condensation, precipitation.", url: "" }],
    },
  ],
  claims: [
    {
      id: "claim-1",
      text: "Water evaporates when heated.",
      passageIds: ["src-1-p1"],
      sourceIds: ["src-1"],
      status: "supported",
    },
  ],
  contradictions: [],
  timings: { searchMs: 1, extractionMs: 0, claimsMs: 1, totalMs: 2 },
};

describe("no generation path can ship a placeholder sim", () => {
  it("generateConcept drops a reserved template but keeps explainer + quiz", async () => {
    const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
    Object.assign(process.env, {
      LLM_MODEL_DEFAULT: "mock-model",
      LLM_BASE_URL: "https://mock.example/v1",
      LLM_API_KEY: "mock-key",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    explainer: "A curve sim would be nice here.",
                    grounding: ["claim-1"],
                    quiz: [
                      {
                        prompt: "What drives evaporation?",
                        options: ["Heat", "Cold"],
                        answer: 0,
                        explanation: "Heat.",
                      },
                    ],
                    flashcards: [],
                    sim: { template: "slider-curve", values: { slope: 1 }, predictPrompt: "Predict." },
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    try {
      const r = await generateConcept("the water cycle", { id: "c1", title: "T", summary: "S" }, SOURCE);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.concept.components.map((c) => c.type)).toEqual(["explainer", "quiz"]);
      expect(JSON.stringify(r.concept)).not.toMatch(/slider-curve|vector-field/);
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      vi.unstubAllGlobals();
    }
  });

  it("the cached run carries no placeholder, and a captured one would be stripped", () => {
    const real = parseCachedRun(cachedRaw);
    expect(real).not.toBeNull();
    expect(JSON.stringify(real)).not.toMatch(/slider-curve|vector-field/);

    // Simulate a future capture (or a hand edit) that carries a reserved id on
    // a concept which already ships the real two-state sim.
    const i = cachedRaw.spec.concepts.findIndex((c) => c.components.some((x) => x.type === "sim"));
    expect(i).toBeGreaterThanOrEqual(0);
    // Loosely typed on purpose: the doctored sim must still satisfy the spec
    // schema (params.values is a free-form record), like a real capture would.
    const doctored = JSON.parse(JSON.stringify(cachedRaw)) as {
      spec: {
        concepts: {
          components: { type: string; template?: string; params?: { values: Record<string, number> }; predictPrompt?: string }[];
        }[];
      };
    };
    const target = doctored.spec.concepts[i]!;
    const before = target.components.map((c) => c.type);
    target.components.push({
      type: "sim",
      template: "vector-field",
      params: { values: {} },
      predictPrompt: "Predict.",
    });
    const parsed = parseCachedRun(doctored);
    expect(parsed).not.toBeNull();
    // The concept keeps its real components (incl. its two-state sim); only the
    // added placeholder is gone.
    const types = parsed!.spec.concepts[i]!.components.map((c) => c.type);
    expect(types).toEqual(before);
    expect(types.filter((t) => t === "sim")).toHaveLength(1);
    expect(JSON.stringify(parsed!.spec)).not.toMatch(/slider-curve|vector-field/);
  });
});
