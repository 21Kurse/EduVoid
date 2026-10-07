/**
 * Topic safety check (AGENTS.md §13.9). A lightweight, deterministic refusal
 * for clearly harmful topics — weapons, explosives, dangerous-agent
 * synthesis, drugs, and targeted harm. Deliberately narrow: it matches a
 * build/synthesis intent next to a harmful subject, so legitimate study
 * topics ("history of the atomic bomb", "nuclear fission", "explosives in
 * mining") pass. Never generates a lesson for a refused topic.
 */

export type SafetyDecision =
  | { ok: true }
  | { ok: false; category: string; message: string };

/** Verbs that signal the user wants to *do* the harmful thing. */
const INTENT =
  /\b(how\s+(?:do\s+i|to|can\s+i)|help\s+me|teach\s+me|make|makes|making|built|build|building|construct|constructing|synthesi[sz]e|synthesi[sz]ing|produce|producing|manufacture|manufacturing|create|creating|cook|cooking|prepare|preparing|assemble|assemble|detonate)\b/i;

/** Harmful subjects. Kept explicit so legit science/history phrasings pass. */
const HARMFUL =
  /\b(bomb|bombs|explosive|explosives|ied|improvised\s+explosive|pipe\s+bomb|dirty\s+bomb|nerve\s+agent|nerve\s+gas|sarin|vx\s+agent|ricin|anthrax|bioweapon|biological\s+weapon|chemical\s+weapon|chemical\s+agent|poison\s+gas|mustard\s+gas|chlorine\s+gas|napalm|molotov|thermite\s+bomb|weapons?\s+of\s+mass\s+destruction|wmd|botulinum|deadly\s+poison|untraceable\s+poison|methamphetamine|crystal\s+meth|meth|fentanyl|heroin)\b/i;

/** Directly harmful requests that need no separate intent word. */
const DIRECT =
  /\b(build|make|synthesi[sz]e)\s+(a\s+|an\s+|the\s+)?(bomb|explosive|nerve\s+agent|bioweapon|chemical\s+weapon)\b/i;

/** Targeted harm against a person. */
const TARGETED_HARM =
  /\b(how\s+to|help\s+me|teach\s+me|i\s+want\s+to|i\s+need\s+to)\b[^.]{0,12}\b(kill|murder|poison|stab|shoot|hurt|abduct|kidnap)\b/i;

const REFUSAL_MESSAGE =
  "I can't help with that. EduVoid builds study material, and requests about weapons, explosives, dangerous-agent synthesis, illegal drugs, or harming people are out of scope. Try a science, math, or humanities topic instead — for example \"quantum superposition and measurement\".";

/**
 * Decide whether a topic should be refused. Deterministic and pure so it is
 * unit-testable and can never be talked out of a refusal by the model.
 */
export function checkTopicSafety(topic: string): SafetyDecision {
  const t = topic.trim();
  if (!t) return { ok: true };
  if (DIRECT.test(t) || TARGETED_HARM.test(t)) {
    return { ok: false, category: "harm", message: REFUSAL_MESSAGE };
  }
  if (INTENT.test(t) && HARMFUL.test(t)) {
    return { ok: false, category: "harmful-construction", message: REFUSAL_MESSAGE };
  }
  return { ok: true };
}

/** Ready-to-return refusal response; `refused` tells the client to show the friendly state. */
export function safetyRefusalResponse(decision: SafetyDecision): Response {
  const message = decision.ok ? REFUSAL_MESSAGE : decision.message;
  return Response.json(
    { error: message, refused: true, category: decision.ok ? "harm" : decision.category },
    { status: 422 },
  );
}
