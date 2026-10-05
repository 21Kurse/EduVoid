/**
 * Template sim ids (§4, §13.6). Shared by the spec schema, the generator
 * allowlist, and the hero-sim fallback contract — one list so they can
 * never drift apart. Lives alone to avoid a generate ↔ hero-sim cycle.
 */
export const SIM_TEMPLATES = ["two-state-prob", "double-slit", "slider-curve", "vector-field"] as const;
export type SimTemplate = (typeof SIM_TEMPLATES)[number];
