import { describe, expect, it } from "vitest";
import { LOCAL_FALLBACK_REASON, localSimAdaptation, pickLocalTemplate } from "../lib/local-adapt";
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

  it("says out loud that it is a fallback, not a live regeneration", () => {
    expect(LOCAL_FALLBACK_REASON).toMatch(/unavailable/i);
    expect(LOCAL_FALLBACK_REASON).toMatch(/simulation/i);
  });
});
