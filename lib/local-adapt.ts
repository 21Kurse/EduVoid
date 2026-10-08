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
 *    fabricated simulation.
 *  - The sim LEADS the concept, so the change is visible even when the
 *    concept already contained a sim lower down.
 */
import type { Component, Concept } from "./spec";

/** The two templates this module can fill without a model. */
type LocalSimTemplate = "two-state-prob" | "double-slit";

/** §13.7 one-liner shown when the fallback (not the model) built the new modality. */
export const LOCAL_FALLBACK_REASON =
  "Live regeneration was unavailable, so here is the same concept as a hands-on simulation.";

/** Interference-flavoured concepts map to the double-slit template. */
const INTERFERENCE = /double[-\s]?slit|interfer|fringe|diffract|wavelength|path difference|phase difference/i;

/** Probability/measurement-flavoured concepts map to the two-state template. */
const TWO_STATE = /probabilit|measure|superposition|qubit|collapse|outcome|amplitude|born|bit\b|spin|random/i;

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

/** Which hand-built template (if any) fits this concept's content. */
export function pickLocalTemplate(concept: Concept, topic: string): LocalSimTemplate | null {
  const text = conceptText(concept, topic);
  if (INTERFERENCE.test(text)) return "double-slit";
  if (TWO_STATE.test(text)) return "two-state-prob";
  return null;
}

const PREDICT_PROMPT: Record<LocalSimTemplate, string> = {
  "two-state-prob":
    "Commit to a prediction first: of 50 identical systems prepared the same way, how many land in the first outcome?",
  "double-slit":
    "Commit to a prediction first: which pattern appears on the detector when both slits are open?",
};

/** Template defaults, matching the clamps in the hand-built sim components. */
const DEFAULT_VALUES: Record<LocalSimTemplate, Record<string, number>> = {
  "two-state-prob": { p: 0.5, n: 50 },
  "double-slit": { d: 2, lambda: 1 },
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
