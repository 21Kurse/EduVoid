/**
 * Mastery levels and colors for the mindmap (AGENTS.md §5.1).
 * T2: colors + level mapping only. Deterministic update rules arrive in T11.
 */

export type MasteryState = {
  /** 0..1, or null when the concept has not been touched yet. */
  mastery: number | null;
  attempts: number;
  timeSpent: number;
  modalityHistory: string[];
};

export type MasteryLevel = "unseen" | "struggling" | "learning" | "mastered";

/** Node colors per level — one hue family, lightness encodes mastery. */
export const MASTERY_COLORS: Record<MasteryLevel, string> = {
  unseen: "#e4e4e7", // zinc-200: not yet touched
  struggling: "#fecaca", // red-200
  learning: "#ddd6fe", // violet-200
  mastered: "#c4b5fd", // violet-300 … deep enough to read as "done" without breaking light-minimal
};

export const MASTERY_STROKE: Record<MasteryLevel, string> = {
  unseen: "#d4d4d8",
  struggling: "#fca5a5",
  learning: "#a78bfa",
  mastered: "#7c3aed",
};

/**
 * Thresholds are provisional (T11 may tune them with the owner).
 * unseen: null mastery or zero attempts.
 */
export function masteryLevel(state: MasteryState | undefined): MasteryLevel {
  if (!state || state.mastery === null || state.attempts === 0) return "unseen";
  if (state.mastery >= 0.8) return "mastered";
  if (state.mastery >= 0.5) return "learning";
  return "struggling";
}

/** Blank per-concept state, for initializing the store. */
export function emptyMastery(): MasteryState {
  return { mastery: null, attempts: 0, timeSpent: 0, modalityHistory: [] };
}

/**
 * Deterministic mastery events (T11, §13.12 — rules, no BKT):
 * - quiz correct: +0.4 (two clean answers master an untouched concept)
 * - quiz wrong: −0.3, floored at 0; first miss on unseen starts at 0.5
 * - "I don't get this": collapse toward struggling (×0.4)
 * - regenerated: record the new modality in the history
 */
export type MasteryEvent =
  | { type: "quiz"; correct: boolean }
  | { type: "dont-get" }
  | { type: "regenerated"; modality: string };

export function applyMasteryEvent(
  current: MasteryState | undefined,
  event: MasteryEvent,
): MasteryState {
  const s = current ?? emptyMastery();
  switch (event.type) {
    case "quiz": {
      const base = s.mastery ?? 0.5;
      const mastery = Math.min(1, Math.max(0, base + (event.correct ? 0.4 : -0.3)));
      return { ...s, mastery, attempts: s.attempts + 1 };
    }
    case "dont-get": {
      const base = s.mastery ?? 0.5;
      return { ...s, mastery: Math.max(0, base * 0.4) };
    }
    case "regenerated": {
      return { ...s, modalityHistory: [...s.modalityHistory.slice(-5), event.modality] };
    }
  }
}

/**
 * Modality cycle for regeneration (§6): text → sim → flashcards → quiz →
 * back to text. The next modality is the first one after the last used,
 * so a failed explainer regenerates as a simulation, etc.
 */
export const MODALITY_CYCLE = ["explainer", "sim", "flashcards", "quiz"] as const;
export type Modality = (typeof MODALITY_CYCLE)[number];

export function nextModality(history: string[]): Modality {
  // Every concept is initially presented explainer-led, so the first
  // regeneration after a failure moves straight to a simulation.
  if (history.length === 0) return "sim";
  const last = history[history.length - 1];
  const idx = MODALITY_CYCLE.indexOf(last as Modality);
  return MODALITY_CYCLE[(idx + 1) % MODALITY_CYCLE.length] ?? "sim";
}

/**
 * What the learner actually GOT, for the visible reason line (§13.7). The
 * requested modality and the delivered one can differ: asking for flashcards
 * ("flashcards" is the next step in the cycle) can come back with a sim, and
 * a banner that names the wrong thing is the same broken promise the owner
 * reported on Oct 8 ("it just shows a message"). So: name a component type
 * that was NOT there before, preferring sim over quiz over flashcards; fall
 * back to the requested modality when the regeneration only rewrote what was
 * already on screen.
 */
export function deliveredModality(
  before: readonly { type: string }[],
  after: readonly { type: string }[],
  requested: Modality,
): Modality {
  const had = new Set(before.map((c) => c.type));
  const arrived = new Set(after.map((c) => c.type).filter((t) => t !== "explainer" && !had.has(t)));
  if (arrived.has("sim")) return "sim";
  if (arrived.has("quiz")) return "quiz";
  if (arrived.has("flashcards")) return "flashcards";
  return requested;
}

/** The visible one-line reason (§13.7) shown when a concept regenerates. */
export function adaptReason(modality: Modality, missed: boolean): string {
  const as: Record<Modality, string> = {
    explainer: "a worked explanation",
    sim: "a hands-on simulation",
    flashcards: "flashcards",
    quiz: "a quick quiz",
  };
  return missed
    ? `You missed a question, so here it is again as ${as[modality]}.`
    : `You said this didn't land, so here it is as ${as[modality]}.`;
}
