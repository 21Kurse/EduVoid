import { describe, expect, it } from "vitest";
import { mergeConcept } from "../lib/merge-concept";
import type { CurriculumSpec } from "../lib/spec";

const spec = {
  topic: "t",
  level: "beginner" as const,
  edges: [],
  sources: [],
  concepts: [
    { id: "a", title: "A", summary: "a", claims: [], components: [{ type: "explainer" as const, markdown: "A" }] },
    { id: "b", title: "B", summary: "b", claims: [], components: [{ type: "explainer" as const, markdown: "B" }] },
    { id: "c", title: "C", summary: "c", claims: [], components: [] },
  ],
} as CurriculumSpec;

describe("mergeConcept (G3 finding 3)", () => {
  it("changes only the named concept", () => {
    const next = mergeConcept(spec, "b", {
      components: [{ type: "flashcards", cards: [{ front: "f", back: "b" }] }],
    });
    expect(next).not.toBeNull();
    expect(next?.concepts[1].components[0].type).toBe("flashcards");
    // Other concepts keep their identity (reference equality).
    expect(next?.concepts[0]).toBe(spec.concepts[0]);
    expect(next?.concepts[2]).toBe(spec.concepts[2]);
  });

  it("merges claims and components together", () => {
    const claim = {
      id: "claim-x", text: "x", passageIds: ["p1"], sourceIds: ["s1"], status: "supported" as const,
    };
    const next = mergeConcept(spec, "c", {
      components: [{ type: "explainer", markdown: "new" }],
      claims: [claim],
    });
    expect(next?.concepts[2].claims).toEqual([claim]);
    expect(next?.concepts[2].components[0]).toEqual({ type: "explainer", markdown: "new" });
    expect(next?.concepts[0]).toBe(spec.concepts[0]);
  });

  it("returns null for an unknown id (no leak into the spec)", () => {
    expect(mergeConcept(spec, "does-not-exist", { components: [{ type: "explainer", markdown: "x" }] })).toBeNull();
  });
});
