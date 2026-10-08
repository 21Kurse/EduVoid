import { describe, expect, it } from "vitest";
import {
  DUPLICATE_CONTAINMENT,
  MAX_QUIZ_PER_CONCEPT,
  MAX_QUIZ_PER_PRACTICE_SET,
  contentTokens,
  dedupeQuizItems,
  isDuplicatePrompt,
  normalizeQuizComponents,
  normalizePrompt,
  numberTokens,
  promptContainment,
  renderedQuizPrompts,
  stripDuplicateQuiz,
  withUniqueQuizzes,
} from "../lib/quiz-dedupe";

/** The real pair that shipped in one run (owner feedback, Oct 8). */
const ASKED_TWICE_A = "What happens to a quantum system's superposition when it is measured?";
const ASKED_TWICE_B = "What happens to a quantum system's state when a measurement is performed?";
const THIRD = "Why must quantum algorithms limit the number of measurements performed during computation?";
const FOURTH = "What does the no-cloning theorem forbid?";

/**
 * The second pair, captured from a live lesson on Oct 8 AFTER the first fix:
 * two concepts, generated in parallel, both asked for the fidelity right
 * after a measurement. They were not verbatim repeats and the first version
 * of the detector missed them (containment 0.71), so they are the regression
 * case for plural folding.
 */
const FIDELITY_A = "What is the value of quantum fidelity for the definite state immediately after measurement?";
const FIDELITY_B =
  "What happens to the quantum fidelity of the states in a superposition immediately after a measurement yields a definite outcome?";

const q = (prompt: string) => ({ prompt });

describe("normalizePrompt", () => {
  it("collapses casing, punctuation and spacing", () => {
    expect(normalizePrompt("What's  P(0),  exactly?")).toBe("what s p 0 exactly");
  });
});

describe("isDuplicatePrompt", () => {
  it("catches a verbatim repeat", () => {
    expect(isDuplicatePrompt(ASKED_TWICE_A, [ASKED_TWICE_A])).toBe(true);
  });

  it("catches the measured/measurement paraphrase that actually shipped", () => {
    // Containment with prefix-stemming: "measured" and "measurement" both
    // stem to "measur", and the shorter question is contained in the longer.
    expect(promptContainment(ASKED_TWICE_A, ASKED_TWICE_B)).toBeGreaterThanOrEqual(
      DUPLICATE_CONTAINMENT,
    );
    expect(isDuplicatePrompt(ASKED_TWICE_B, [ASKED_TWICE_A])).toBe(true);
  });

  it("keeps genuinely different questions", () => {
    for (const other of [THIRD, FOURTH]) {
      expect(isDuplicatePrompt(other, [ASKED_TWICE_A]), other).toBe(false);
    }
  });

  it("does not merge two numeric drills on the same idea", () => {
    const a = "For alpha = 0.6, what probability does the Born rule give for outcome 0?";
    const b = "For alpha = 0.8, what probability does the Born rule give for outcome 1?";
    // These share almost every word (so containment alone would merge them),
    // but they differ in their numbers — different questions, kept both.
    expect(numberTokens(a)).toEqual(["0", "6", "0"]);
    expect(isDuplicatePrompt(b, [a])).toBe(false);
    // Identical numbers do not buy an exemption: a verbatim repeat is still a
    // repeat.
    expect(isDuplicatePrompt(a, [a])).toBe(true);
  });

  it("catches the fidelity paraphrase that shipped after the first fix", () => {
    // "state" vs "states" must not be enough to hide a restated question.
    expect(promptContainment(FIDELITY_A, FIDELITY_B)).toBeGreaterThanOrEqual(
      DUPLICATE_CONTAINMENT,
    );
    expect(isDuplicatePrompt(FIDELITY_B, [FIDELITY_A])).toBe(true);
  });

  it("never accepts an empty prompt", () => {
    expect(isDuplicatePrompt("   ", [])).toBe(true);
  });
});

describe("dedupeQuizItems", () => {
  it("caps a concept at ONE question, keeping the first", () => {
    const out = dedupeQuizItems([q(FOURTH), q(THIRD)], []);
    expect(out).toHaveLength(MAX_QUIZ_PER_CONCEPT);
    expect(out[0]!.prompt).toBe(FOURTH);
  });

  it("drops a question the lesson already asked and keeps looking", () => {
    const out = dedupeQuizItems([q(ASKED_TWICE_A), q(FOURTH)], [ASKED_TWICE_B]);
    expect(out.map((x) => x.prompt)).toEqual([FOURTH]);
  });

  it("returns nothing when the only question is a repeat", () => {
    expect(dedupeQuizItems([q(ASKED_TWICE_A)], [ASKED_TWICE_A])).toEqual([]);
  });

  it("allows a small practice set for the quiz modality", () => {
    const out = dedupeQuizItems(
      [q(FOURTH), q(THIRD), q(ASKED_TWICE_A), q(ASKED_TWICE_A)],
      [],
      MAX_QUIZ_PER_PRACTICE_SET,
    );
    expect(out).toHaveLength(3);
    expect(new Set(out.map((x) => x.prompt)).size).toBe(3);
  });
});

describe("whole-lesson rules", () => {
  const concepts = [
    { id: "c1", components: [{ type: "explainer" }, { type: "quiz", questions: [q(ASKED_TWICE_A)] }] },
    // c2's first ask is the paraphrase of c1's question -> dropped, FOURTH kept.
    { id: "c2", components: [{ type: "quiz", questions: [q(ASKED_TWICE_B), q(FOURTH)] }] },
    // c3 opens with a repeat of c2's survivor -> dropped, THIRD kept.
    { id: "c3", components: [{ type: "quiz", questions: [q(FOURTH), q(THIRD)] }] },
    // c4 has nothing but a repeat -> the concept loses its quiz block entirely.
    { id: "c4", components: [{ type: "explainer" }, { type: "quiz", questions: [q(ASKED_TWICE_A)] }] },
  ];

  it("keeps the survivor of a duplicated concept and drops the rest", () => {
    const out = normalizeQuizComponents(concepts);
    expect(out[1]!.components.map((c) => c.type)).toEqual(["quiz"]);
    expect(out[2]!.components.map((c) => c.type)).toEqual(["quiz"]);
    expect(out[3]!.components.map((c) => c.type)).toEqual(["explainer"]); // quiz block gone
  });

  it("never repeats a prompt across concepts and never exceeds the cap", () => {
    const out = normalizeQuizComponents(concepts);
    expect(renderedQuizPrompts(out)).toEqual([ASKED_TWICE_A, FOURTH, THIRD]);
    for (const c of out) {
      for (const comp of c.components) {
        if (comp.type === "quiz") expect(comp.questions?.length ?? 0).toBeLessThanOrEqual(1);
      }
    }
  });

  it("leaves a spec with nothing to fix untouched (same object identities)", () => {
    const clean = [
      { id: "c1", components: [{ type: "explainer" }] },
      { id: "c2", components: [{ type: "quiz", questions: [q(FOURTH)] }] },
    ];
    const out = normalizeQuizComponents(clean);
    expect(out[0]).toBe(clean[0]);
    expect(out[1]).toBe(clean[1]);
  });

  it("stripDuplicateQuiz drops only the duplicated question (race guard)", () => {
    const concept = {
      components: [
        { type: "explainer" as const },
        { type: "quiz" as const, questions: [q(FOURTH), { prompt: ASKED_TWICE_B }] },
      ],
    };
    const out = stripDuplicateQuiz(concept, [ASKED_TWICE_A]);
    const quiz = out.components.find((c) => c.type === "quiz");
    expect(quiz && "questions" in quiz ? quiz.questions.map((x) => x.prompt) : []).toEqual([FOURTH]);
  });

  it("contentTokens ignores stopwords and short noise", () => {
    expect(contentTokens("What is the P of it?")).toEqual([]);
  });
});

describe("withUniqueQuizzes (parallel-generation reconciliation)", () => {
  const lesson = [
    { id: "c1", components: [{ type: "explainer" }, { type: "quiz", questions: [q(FIDELITY_A)] }] },
    // c2 completed before c1 and cannot have seen c1's question -> its
    // paraphrase is the later one in lesson order and gets dropped.
    { id: "c2", components: [{ type: "explainer" }, { type: "quiz", questions: [q(FIDELITY_B)] }] },
  ];

  it("drops the later of two paraphrases, keeping the earlier concept's", () => {
    const out = withUniqueQuizzes(lesson);
    expect(out[0]).toBe(lesson[0]); // untouched, identity kept
    expect(renderedQuizPrompts(out)).toEqual([FIDELITY_A]);
    expect(out[1]!.components.map((c) => c.type)).toEqual(["explainer"]);
  });

  it("is idempotent: a second pass changes nothing", () => {
    const once = withUniqueQuizzes(lesson);
    const twice = withUniqueQuizzes(once);
    expect(twice).toBe(once); // identical array reference, so no render loop
  });

  it("never caps: an adapted practice-quiz set of 3 unique questions survives", () => {
    const adapted = [
      { id: "c1", components: [{ type: "quiz", questions: [q(FOURTH), q(THIRD), q(ASKED_TWICE_A)] }] },
    ];
    expect(withUniqueQuizzes(adapted)[0]!.components[0]).toMatchObject({
      questions: [q(FOURTH), q(THIRD), q(ASKED_TWICE_A)],
    });
  });
});
