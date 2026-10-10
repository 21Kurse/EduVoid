/**
 * Local adaptation fallback (owner feedback, Oct 8: "I don't get this" showed
 * a message instead of anything). When the live regeneration route fails —
 * a 502 from the provider, a rate limit, or a timeout — the learner must
 * still get a visibly different presentation, and the one thing we can build
 * with no model at all is a template sim (§13.6: the template sims are
 * hand-built; the LLM only supplies parameters and text).
 *
 * Rules:
 *  - Template choice and every parameter are deterministic — same concept in,
 *    same sim out. No model call, no randomness.
 *  - Only templates that actually fit the concept's own text are used; an
 *    unrelated topic gets `null` and the honest failure message instead of a
 *    fabricated simulation. `fitsLocalTemplate` is the ONE fit signal: the
 *    generator's sim gate, this fallback, the adaptive-loop modality choice
 *    and the hero-sim safety net all read it, so they can never disagree.
 *  - The sim LEADS the concept, so the change is visible even when the
 *    concept already contained a sim lower down.
 *  - The learner gets the new presentation, not a sentence announcing it
 *    (owner feedback, Oct 10): this module used to ship a "here it is as a
 *    hands-on simulation" line with the fallback; that string is gone.
 */
import type { Component, Concept } from "./spec";

/** The hand-built templates this module can fill without a model. */
type LocalSimTemplate = "two-state-prob" | "double-slit" | "bayes-update";

/** Interference-flavoured concepts map to the double-slit template. */
const INTERFERENCE = /double[-\s]?slit|interfer|fringe|diffract|wavelength|path difference|phase difference/i;

/** Probability/measurement-flavoured concepts map to the two-state template. */
const TWO_STATE = /probabilit|measure|superposition|qubit|collapse|outcome|amplitude|born|bit\b|spin|random/i;

/** Belief-updating concepts map to the Bayes template (owner request, Oct 10). */
const BAYES = /bayes|posterior|base[\s-]?rate|false[\s-]?positive|likelihood|sensitivity|conditional[\s-]?probabilit/i;

/** Everything the concept already says about itself — the fit signal. */
function conceptText(concept: Concept, topic: string): string {
  return [
    topic,
    concept.title,
    concept.summary,
    ...concept.claims.map((c) => c.text),
    ...concept.components.flatMap((c) => (c.type === "explainer" ? [c.markdown] : [])),
  ]
    .join(" \n ")
    .slice(0, 6000);
}

/**
 * Does this template plausibly fit the concept? Deterministic, and the only
 * place the fit signal is defined — used both to pick a local sim and to
 * decide whether the hero sim's paired template sim is an appropriate safety
 * net (an unrelated experiment is worse than no experiment).
 */
export function fitsLocalTemplate(
  template: LocalSimTemplate,
  concept: Concept,
  topic: string,
): boolean {
  const text = conceptText(concept, topic);
  if (template === "double-slit") return INTERFERENCE.test(text);
  if (template === "bayes-update") return BAYES.test(text);
  return TWO_STATE.test(text);
}

/** Which hand-built template (if any) fits this concept's content. */
export function pickLocalTemplate(concept: Concept, topic: string): LocalSimTemplate | null {
  if (fitsLocalTemplate("double-slit", concept, topic)) return "double-slit";
  if (fitsLocalTemplate("bayes-update", concept, topic)) return "bayes-update";
  if (fitsLocalTemplate("two-state-prob", concept, topic)) return "two-state-prob";
  return null;
}

const PREDICT_PROMPT: Record<LocalSimTemplate, string> = {
  "two-state-prob":
    "Commit to a prediction first: of 50 identical systems prepared the same way, how many land in the first outcome?",
  "double-slit":
    "Commit to a prediction first: which pattern appears on the detector when both slits are open?",
  "bayes-update":
    "Commit to a prediction first: out of 100 people who test positive, how many actually have the condition?",
};

/** Template defaults, matching the clamps in the hand-built sim components. */
const DEFAULT_VALUES: Record<LocalSimTemplate, Record<string, number>> = {
  "two-state-prob": { p: 0.5, n: 50 },
  "double-slit": { d: 2, lambda: 1 },
  "bayes-update": { prior: 0.01, sensitivity: 0.9, falsePositive: 0.05 },
};

/**
 * The concept rebuilt around a template sim, or null when no template fits.
 * The sim is placed first so the change is visible; the concept's own
 * explainer/claims/flashcards are kept (only a previous sim is replaced).
 */
export function localSimAdaptation(concept: Concept, topic: string): Component[] | null {
  const template = pickLocalTemplate(concept, topic);
  if (!template) return null;
  const sim: Component = {
    type: "sim",
    template,
    params: { values: DEFAULT_VALUES[template] },
    predictPrompt: PREDICT_PROMPT[template],
  };
  return [sim, ...concept.components.filter((c) => c.type !== "sim")];
}
