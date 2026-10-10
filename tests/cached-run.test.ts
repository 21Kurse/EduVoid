import { beforeEach, describe, expect, it } from "vitest";
import {
  CACHED_RUN_LABEL,
  DEMO_RUNS,
  DEMO_TOPIC,
  cachedLessonView,
  demoRunFor,
  getCachedLesson,
  isDemoTopic,
  parseCachedRun,
  resetCachedLessonCache,
} from "../lib/cached-run";

beforeEach(() => resetCachedLessonCache());

describe("demo topic registry", () => {
  it("is tailored to Bayes' theorem first (owner request, Oct 10)", () => {
    expect(DEMO_TOPIC.toLowerCase()).toContain("bayes");
    expect(isDemoTopic("Bayes' theorem")).toBe(true);
  });

  it("matches the demo topics however the user phrases them", () => {
    for (const t of [
      DEMO_TOPIC,
      "bayes",
      "Bayes theorem",
      "BAYES' THEOREM",
      "  bayes rule  ",
      "quantum superposition",
      "Quantum Superposition and Measurement",
      "superposition and measurement",
    ]) {
      expect(isDemoTopic(t), t).toBe(true);
    }
  });

  it("never claims another topic (each capture is only about its own subject)", () => {
    for (const t of ["Fourier transform", "how photosynthesis works", "the water cycle", ""]) {
      expect(isDemoTopic(t), t).toBe(false);
      expect(getCachedLesson(t), t).toBeNull();
    }
  });

  it("resolves each demo topic to the capture it was taken from", () => {
    expect(demoRunFor("Bayes' theorem")?.file).toContain("bayes");
    expect(demoRunFor("quantum superposition")?.file).toContain("qm-superposition");
  });
});

describe("parseCachedRun", () => {
  it("rejects unusable payloads instead of rendering a broken lesson", () => {
    expect(parseCachedRun(null)).toBeNull();
    expect(parseCachedRun({})).toBeNull();
    expect(parseCachedRun({ spec: { topic: "x" } })).toBeNull();
  });
});

describe("cached demo runs", () => {
  it("every registry entry is a real, schema-valid capture with generated content", () => {
    for (const run of DEMO_RUNS) {
      const lesson = getCachedLesson(run.topic);
      expect(lesson, `${run.file} must be a captured run`).not.toBeNull();
      if (!lesson) continue;
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
    }
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

  it("obeys the lesson's quiz rules after the capture (owner feedback)", () => {
    // The captures predate one-question-per-concept, so parseCachedRun
    // normalizes them through the same helper a live run uses. Without this
    // the demo-safe fallback would still ask repeated questions.
    const lesson = getCachedLesson();
    expect(lesson).not.toBeNull();
    if (!lesson) return;
    const quizzes = lesson.spec.concepts
      .flatMap((c) => c.components)
      .filter((c): c is Extract<typeof c, { type: "quiz" }> => c.type === "quiz");
    expect(quizzes.length).toBeGreaterThan(0);
    for (const quiz of quizzes) expect(quiz.questions.length).toBeLessThanOrEqual(1);
    const prompts = quizzes.flatMap((q) => q.questions.map((x) => x.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("is labeled exactly \"cached run\"", () => {
    expect(CACHED_RUN_LABEL).toBe("cached run");
  });
});
