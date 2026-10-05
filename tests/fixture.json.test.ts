import { describe, expect, it } from "vitest";
import fixture from "../fixtures/qm-superposition.json";
import {
  curriculumSpecSchema,
  type CurriculumSpec,
} from "../lib/spec";
import { isAcyclic, topoSort, prerequisitesOf } from "../lib/graph";

const parse = curriculumSpecSchema.safeParse(fixture);

describe("T1 fixture: qm-superposition.json", () => {
  it("validates against the CurriculumSpec schema", () => {
    expect(
      parse.success,
      parse.success ? "" : JSON.stringify(parse.error.issues, null, 2),
    ).toBe(true);
  });

  it("has 5 concepts in the 5-7 range required by T1", () => {
    expect(fixture.concepts).toHaveLength(5);
  });

  it("has an acyclic prerequisite graph with a total topological order", () => {
    const ids = fixture.concepts.map((c) => c.id);
    expect(isAcyclic(ids, fixture.edges)).toBe(true);
    const order = topoSort(ids, fixture.edges);
    expect(order).not.toBeNull();
    // every concept appears exactly once in the topo order
    expect(order).toHaveLength(ids.length);
    expect(new Set(order)).toEqual(new Set(ids));
  });

  it("resolves every claim's passage and source references", () => {
    const spec = parse as { success: true; data: CurriculumSpec };
    const sources = new Set(spec.data.sources.map((s) => s.id));
    const passages = new Set(
      spec.data.sources.flatMap((s) => s.passages.map((p) => p.id)),
    );
    for (const c of spec.data.concepts) {
      for (const claim of c.claims) {
        expect(claim.passageIds.length).toBeGreaterThan(0);
        for (const pid of claim.passageIds) expect(passages.has(pid)).toBe(true);
        for (const sid of claim.sourceIds) expect(sources.has(sid)).toBe(true);
      }
    }
  });

  it("labels every passage as 'fixture' (placeholder, per the owner's instruction)", () => {
    for (const s of fixture.sources) {
      expect(s.title).toMatch(/placeholder/i);
      expect(s.url).toMatch(/^about:fixture#/);
      for (const p of s.passages) {
        expect(p.label).toBe("fixture");
        expect(p.text).toMatch(/^Fixture passage:/);
      }
    }
  });

  it("has prerequisite edges that reference real concepts", () => {
    const ids = new Set(fixture.concepts.map((c) => c.id));
    for (const e of fixture.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
    // the entry concept has no prerequisites
    expect(prerequisitesOf("states-and-superposition", fixture.edges)).toEqual(
      [],
    );
  });
});
