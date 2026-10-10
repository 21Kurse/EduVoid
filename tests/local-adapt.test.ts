import { describe, expect, it } from "vitest";
import {
  fitsLocalTemplate,
  localSimAdaptation,
  pickLocalTemplate,
} from "../lib/local-adapt";
import type { Concept } from "../lib/spec";

const claim = (id: string, text: string) => ({
  id,
  text,
  sourceIds: ["src-1"],
  passageIds: ["p-1"],
  status: "supported" as const,
});

function concept(over: Partial<Concept> = {}): Concept {
  return {
    id: "measurement",
    title: "Measurement",
    summary: "Measuring forces one definite outcome.",
    claims: [claim("claim-1", "The probability of an outcome is the squared amplitude.")],
    components: [{ type: "explainer", markdown: "Measuring a system collapses its state." }],
    ...over,
  };
}

const QUANTUM_TOPIC = "quantum superposition and measurement";

describe("pickLocalTemplate", () => {
  it("maps an interference concept to the double-slit template", () => {
    expect(
      pickLocalTemplate(
        concept({
          id: "interference",
          title: "Interference and the double slit",
          summary: "Fringe spacing depends on wavelength.",
          claims: [claim("c", "Bright fringes appear where the path difference is a whole wavelength.")],
          components: [{ type: "explainer", markdown: "Two slits produce alternating bright and dark fringes." }],
        }),
        QUANTUM_TOPIC,
      ),
    ).toBe("double-slit");
  });

  it("maps a probability concept to the two-state template", () => {
    expect(pickLocalTemplate(concept(), QUANTUM_TOPIC)).toBe("two-state-prob");
  });

  it("maps a Bayes concept to the bayes-update template, ahead of the generic probability one", () => {
    const bayes = concept({
      id: "posterior",
      title: "Prior and posterior",
      summary: "The posterior updates the prior with the likelihood of the evidence.",
      claims: [claim("c", "A positive test for a rare condition leaves a low probability of disease.")],
      components: [{ type: "explainer", markdown: "Bayes' rule divides by the evidence." }],
    });
    expect(pickLocalTemplate(bayes, "Bayes' theorem")).toBe("bayes-update");
    expect(fitsLocalTemplate("bayes-update", bayes, "Bayes' theorem")).toBe(true);
    // The generic probability template fits this text too — Bayes must win.
    expect(fitsLocalTemplate("two-state-prob", bayes, "Bayes' theorem")).toBe(true);
  });

  it("returns null for a topic no template fits (no fabricated sim)", () => {
    const unrelated = concept({
      id: "photosynthesis",
      title: "Light reactions",
      summary: "Chlorophyll absorbs light.",
      claims: [claim("c", "Chlorophyll absorbs red and blue light.")],
      components: [{ type: "explainer", markdown: "The Calvin cycle fixes carbon." }],
    });
    expect(pickLocalTemplate(unrelated, "how photosynthesis works")).toBeNull();
    expect(localSimAdaptation(unrelated, "how photosynthesis works")).toBeNull();
  });
});

describe("fitsLocalTemplate (guards the hero sim's paired fallback)", () => {
  it("accepts the double-slit template for an interference concept under a fitting topic", () => {
    const interference = concept({
      id: "interference",
      title: "Interference and the double slit",
      summary: "Fringe spacing depends on wavelength.",
      claims: [claim("c", "Bright fringes appear where the path difference is a whole wavelength.")],
      components: [{ type: "explainer", markdown: "Two slits produce alternating bright and dark fringes." }],
    });
    expect(fitsLocalTemplate("double-slit", interference, "wave optics")).toBe(true);
    expect(fitsLocalTemplate("two-state-prob", interference, "wave optics")).toBe(false);
  });

  it("accepts the two-state template for a probability concept", () => {
    expect(fitsLocalTemplate("two-state-prob", concept(), "medical testing")).toBe(true);
    expect(fitsLocalTemplate("double-slit", concept(), "medical testing")).toBe(false);
  });

  it("keeps the demo path working: the quantum topic itself fits two-state", () => {
    // The fit signal includes the topic, so a concept inside a superposition
    // lesson legitimately accepts the probability sim — the hero fallback on
    // the demo topic must stay enabled.
    expect(fitsLocalTemplate("two-state-prob", concept(), QUANTUM_TOPIC)).toBe(true);
  });

  it("rejects both templates for an unrelated concept", () => {
    // Observed live (freeze-period P3): the ambiguous topic "loops" planned a
    // programming lesson; its hero canvas failed and the paired probability sim
    // rendered under a programming concept. No template belongs here.
    const programming = concept({
      id: "what-is-a-loop",
      title: "What is a Loop",
      summary: "A loop repeats a sequence of instructions multiple times.",
      claims: [claim("c", "Loops Automation provides engineering and automation products.")],
      components: [
        {
          type: "explainer",
          markdown:
            "A loop is a series of instructions that repeats a block of code until a condition is met, automating repetitive tasks.",
        },
      ],
    });
    expect(fitsLocalTemplate("two-state-prob", programming, "loops")).toBe(false);
    expect(fitsLocalTemplate("double-slit", programming, "loops")).toBe(false);

    const history = concept({
      id: "storming-bastille",
      title: "Storming of the Bastille",
      summary: "The 14 July 1789 assault on the Paris prison.",
      claims: [claim("c", "The French Revolution began in 1789.")],
      components: [{ type: "explainer", markdown: "A Parisian crowd stormed the fortress-prison." }],
    });
    expect(fitsLocalTemplate("two-state-prob", history, "the French Revolution")).toBe(false);
    expect(fitsLocalTemplate("double-slit", history, "the French Revolution")).toBe(false);
  });
});

describe("localSimAdaptation", () => {
  it("leads with a usable template sim carrying clamped default values", () => {
    const out = localSimAdaptation(concept(), QUANTUM_TOPIC);
    expect(out).not.toBeNull();
    const sim = out![0];
    expect(sim.type).toBe("sim");
    if (sim.type === "sim") {
      expect(sim.template).toBe("two-state-prob");
      expect(sim.params.values).toEqual({ p: 0.5, n: 50 });
      expect(sim.predictPrompt.length).toBeGreaterThan(0);
    }
  });

  it("replaces a previous sim instead of stacking a second one", () => {
    const withSim = concept({
      components: [
        { type: "explainer", markdown: "E" },
        { type: "sim", template: "two-state-prob", params: { values: { p: 0.2, n: 10 } }, predictPrompt: "?" },
      ],
    });
    const out = localSimAdaptation(withSim, QUANTUM_TOPIC)!;
    expect(out.filter((c) => c.type === "sim")).toHaveLength(1);
    expect(out[0]!.type).toBe("sim");
    expect(out.some((c) => c.type === "explainer")).toBe(true);
  });

  it("is deterministic — the same concept always yields the same sim", () => {
    const a = localSimAdaptation(concept(), QUANTUM_TOPIC);
    const b = localSimAdaptation(concept(), QUANTUM_TOPIC);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("carries no announcement sentence — the learner sees the sim, not a claim about it", () => {
    const out = localSimAdaptation(concept(), QUANTUM_TOPIC)![0];
    // Owner feedback (Oct 10): the modality announcement above the concept was
    // removed; the only prose left in the adaptation is the predict prompt.
    expect(out.type).toBe("sim");
    if (out.type === "sim") expect(out.predictPrompt).toMatch(/predict/i);
  });
});
