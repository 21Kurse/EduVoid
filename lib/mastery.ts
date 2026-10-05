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
