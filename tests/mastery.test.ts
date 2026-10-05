import { describe, expect, it } from "vitest";
import {
  adaptReason,
  applyMasteryEvent,
  masteryLevel,
  MODALITY_CYCLE,
  nextModality,
  type MasteryState,
} from "../lib/mastery";

describe("mastery rules", () => {
  it("a wrong answer on an unseen concept drops it to struggling", () => {
    const s = applyMasteryEvent(undefined, { type: "quiz", correct: false });
    expect(s.mastery).toBeCloseTo(0.2);
    expect(masteryLevel(s)).toBe("struggling");
    expect(s.attempts).toBe(1);
  });

  it("two correct answers master an untouched concept", () => {
    let s = applyMasteryEvent(undefined, { type: "quiz", correct: true });
    s = applyMasteryEvent(s, { type: "quiz", correct: true });
    expect(s.mastery).toBe(1); // 0.9 + 0.4 clamps at the ceiling
    expect(masteryLevel(s)).toBe("mastered");
  });

  it("mastery never leaves [0, 1] no matter how many misses", () => {
    let s: MasteryState | undefined;
    for (let i = 0; i < 20; i++) s = applyMasteryEvent(s, { type: "quiz", correct: false });
    expect(s?.mastery).toBe(0);
    for (let i = 0; i < 20; i++) s = applyMasteryEvent(s, { type: "quiz", correct: true });
    expect(s?.mastery).toBe(1);
  });

  it("\"I don't get this\" collapses mastery toward struggling", () => {
    let s = applyMasteryEvent(undefined, { type: "quiz", correct: true }); // 0.5? no: null base 0.5 + 0.4 = 0.9
    s = applyMasteryEvent(s, { type: "dont-get" });
    expect(s.mastery).toBeCloseTo(0.36);
    expect(masteryLevel(s)).toBe("struggling");
  });

  it("regeneration appends to the modality history (bounded)", () => {
    let s = applyMasteryEvent(undefined, { type: "regenerated", modality: "sim" });
    for (let i = 0; i < 10; i++) s = applyMasteryEvent(s, { type: "regenerated", modality: "quiz" });
    expect(s.modalityHistory[s.modalityHistory.length - 1]).toBe("quiz");
    expect(s.modalityHistory.length).toBeLessThanOrEqual(6);
  });
});

describe("modality cycle (adaptive loop)", () => {
  it("cycles explainer -> sim -> flashcards -> quiz -> explainer", () => {
    expect(nextModality([])).toBe("sim"); // initial presentation is always explainer-led
    expect(nextModality(["explainer"])).toBe("sim");
    expect(nextModality(["explainer", "sim"])).toBe("flashcards");
    expect(nextModality(["explainer", "sim", "flashcards"])).toBe("quiz");
    expect(nextModality(["explainer", "sim", "flashcards", "quiz"])).toBe("explainer");
    expect(MODALITY_CYCLE).toHaveLength(4);
  });

  it("the scripted scenario: miss, regenerate as sim, recover (§6 loop)", () => {
    // 1. Learner answers the concept quiz wrongly.
    let s = applyMasteryEvent(undefined, { type: "quiz", correct: false });
    // 2. Loop picks the next modality and regenerates.
    const modality = nextModality(s.modalityHistory);
    s = applyMasteryEvent(s, { type: "regenerated", modality });
    expect(modality).toBe("sim");
    expect(adaptReason(modality, true)).toMatch(/missed a question.*simulation/);
    // 3. The regenerated (simulation) version is answered correctly twice.
    s = applyMasteryEvent(s, { type: "quiz", correct: true });
    s = applyMasteryEvent(s, { type: "quiz", correct: true });
    expect(masteryLevel(s)).toBe("mastered");
    expect(s.modalityHistory).toEqual(["sim"]);
  });
});
