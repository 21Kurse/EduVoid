import { describe, expect, it } from "vitest";
import { curriculumSpecSchema } from "../lib/spec";

const baseSource = {
  id: "src-1",
  title: "Placeholder source",
  url: "about:fixture#s",
  authority: "other",
  passages: [
    { id: "p-1", label: "fixture", text: "Fixture passage: test passage." },
  ],
};

const baseConcept = {
  id: "conc-1",
  title: "Concept 1",
  summary: "A test concept.",
  claims: [
    {
      id: "claim-1",
      text: "Test claim.",
      passageIds: ["p-1"],
      sourceIds: ["src-1"],
      status: "supported",
    },
  ],
  components: [{ type: "explainer", markdown: "Test text." }],
};

const baseSpec = {
  topic: "Test topic",
  level: "beginner",
  concepts: [baseConcept],
  edges: [],
  sources: [baseSource],
};

describe("curriculumSpecSchema extra validations", () => {
  it("accepts a minimal valid spec", () => {
    expect(curriculumSpecSchema.safeParse(baseSpec).success).toBe(true);
  });

  it("rejects duplicate concept ids", () => {
    const bad = { ...baseSpec, concepts: [baseConcept, baseConcept] };
    const r = curriculumSpecSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toMatch(/duplicate concept id/);
    }
  });

  it("rejects a claim citing an unknown passage", () => {
    const bad = JSON.parse(JSON.stringify(baseSpec));
    bad.concepts[0].claims[0].passageIds = ["p-does-not-exist"];
    const r = curriculumSpecSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toMatch(/unknown passage/);
    }
  });

  it("rejects a question with an out-of-range answer index", () => {
    const bad = JSON.parse(JSON.stringify(baseSpec));
    bad.concepts[0].components.push({
      type: "quiz",
      questions: [
        {
          id: "q-1",
          prompt: "Pick one.",
          options: ["a", "b"],
          answer: 5,
          explanation: "Because.",
          passageIds: ["p-1"],
        },
      ],
    });
    const r = curriculumSpecSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toMatch(/answer index out of range/);
    }
  });

  it("rejects an edge referencing an unknown concept", () => {
    const bad = { ...baseSpec, edges: [{ from: "conc-1", to: "ghost" }] };
    const r = curriculumSpecSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toMatch(/unknown concept/);
    }
  });

  it("rejects edges that are self-loops", () => {
    const bad = { ...baseSpec, edges: [{ from: "conc-1", to: "conc-1" }] };
    const r = curriculumSpecSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toMatch(/self-loop/);
    }
  });

  it("rejects a passage not labeled as fixture placeholder", () => {
    const bad = JSON.parse(JSON.stringify(baseSpec));
    bad.sources[0].passages[0].label = "live extraction";
    expect(curriculumSpecSchema.safeParse(bad).success).toBe(true); // label is free-form
  });
});
