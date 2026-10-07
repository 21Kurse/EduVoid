import { beforeEach, describe, expect, it } from "vitest";
import {
  CACHED_RUN_LABEL,
  DEMO_TOPIC,
  cachedLessonView,
  getCachedLesson,
  isDemoTopic,
  parseCachedRun,
  resetCachedLessonCache,
} from "../lib/cached-run";

beforeEach(() => resetCachedLessonCache());

describe("isDemoTopic", () => {
  it("matches the demo topic however the user phrases it", () => {
    for (const t of [
      DEMO_TOPIC,
      "quantum superposition",
      "Quantum Superposition and Measurement",
      "superposition and measurement",
      "  superposition  ",
    ]) {
      expect(isDemoTopic(t), t).toBe(true);
    }
  });

  it("never claims another topic (the cache is only about superposition)", () => {
    for (const t of ["Fourier transform", "Bayes' theorem", "how photosynthesis works", ""]) {
      expect(isDemoTopic(t), t).toBe(false);
    }
  });
});

describe("parseCachedRun", () => {
  it("rejects unusable payloads instead of rendering a broken lesson", () => {
    expect(parseCachedRun(null)).toBeNull();
    expect(parseCachedRun({})).toBeNull();
    expect(parseCachedRun({ spec: { topic: "x" } })).toBeNull();
  });
});

describe("cached demo run", () => {
  it("is a real, schema-valid captured run with generated content", () => {
    const lesson = getCachedLesson();
    expect(lesson, "data/cached/qm-superposition.json must be a captured run").not.toBeNull();
    if (!lesson) return;
    expect(lesson.topic.toLowerCase()).toContain("superposition");
    expect(Number.isNaN(Date.parse(lesson.capturedAt))).toBe(false);
    expect(lesson.model.length).toBeGreaterThan(0);
    expect(lesson.spec.concepts.length).toBeGreaterThan(0);
    // Every concept carries content (checked against the real spec schema).
    expect(lesson.spec.concepts.every((c) => c.components.length > 0)).toBe(true);
    // Citations survive the capture: claims reference real passages.
    expect(lesson.verify.total).toBeGreaterThan(0);
    expect(lesson.verify.supported).toBeGreaterThan(0);
    expect(lesson.claims.length).toBeGreaterThan(0);
    expect(lesson.passages.length).toBeGreaterThan(0);
    const passageIds = new Set(lesson.passages.map((p) => p.id));
    const cited = lesson.claims.flatMap((c) => c.passageIds);
    expect(cited.length).toBeGreaterThan(0);
    expect(cited.every((id) => passageIds.has(id))).toBe(true);
  });

  it("assembles a complete view in one batch so no live request is needed", () => {
    const lesson = getCachedLesson();
    expect(lesson).not.toBeNull();
    if (!lesson) return;
    const view = cachedLessonView(lesson);
    expect(view.spec).toBe(lesson.spec);
    expect(view.selectedConceptId).toBe(lesson.spec.concepts[0]!.id);
    expect(Object.keys(view.conceptStatus)).toHaveLength(lesson.spec.concepts.length);
    expect(Object.values(view.conceptStatus).every((s) => s.ok)).toBe(true);
    expect(view.verify.sources).toBe(lesson.verify.sources);
  });

  it("is labeled exactly \"cached run\"", () => {
    expect(CACHED_RUN_LABEL).toBe("cached run");
  });
});
