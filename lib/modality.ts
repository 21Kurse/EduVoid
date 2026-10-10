/**
 * Adaptive-regeneration modalities (T11 + G3 finding 3): hints that make
 * regeneration a genuinely different modality, plus the enforcement helper
 * that guarantees the requested component actually exists in the output.
 */

/** §13.7: regeneration must be a genuinely different modality, not a re-roll. */
export const MODALITY_HINT: Record<string, string> = {
  explainer:
    'Adaptation mode "worked explanation": write the explainer as a step-by-step worked walkthrough of one concrete example, carried through to its result with numbers.',
  sim: 'Adaptation mode "simulation": lead with the interactive sim — include a "sim" component choosing whichever listed template fits this concept best, and keep the explainer to 2-3 sentences of setup. If no template fits, use a concrete numeric worked example instead.',
  flashcards:
    'Adaptation mode "flashcards": include 3-4 flashcards covering the core ideas and keep the explainer to 2-3 sentences.',
  quiz: 'Adaptation mode "practice quiz": give 3 quiz questions of increasing difficulty and keep the explainer to 1-2 sentences.',
};

type Components = { type: string; questions?: unknown[] }[];

/** G3 F3: does the requested adaptation modality actually exist, usable? */
export function usableModality(components: Components, modality: string): boolean {
  switch (modality) {
    case "sim":
      return components.some((c) => c.type === "sim");
    case "flashcards":
      return components.some((c) => c.type === "flashcards");
    case "quiz":
      return components.some((c) => c.type === "quiz" && (c.questions?.length ?? 0) > 0);
    default:
      return true; // explainer is always present
  }
}

export function modalityFeedback(modality: string): string {
  const need =
    modality === "sim"
      ? "a 'sim' object with a fitting template (two-state-prob, double-slit or bayes-update), 2-4 numeric values, and a prediction question"
      : modality === "flashcards"
        ? "a 'flashcards' array with 2-4 {front, back} cards"
        : "a 'quiz' array with 2-3 questions";
  return `ADAPTATION REQUIREMENT: your previous output had no usable '${modality}' component. This regeneration MUST include ${need}. Include it.`;
}
