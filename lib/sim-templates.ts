/**
 * Template sim ids (§4, §13.6). Shared by the spec schema, the generator
 * allowlist, and the hero-sim fallback contract — one list so they can
 * never drift apart. Lives alone to avoid a generate ↔ hero-sim cycle.
 *
 * ONLY three templates are hand-built (`IMPLEMENTED_SIM_TEMPLATES`). The other
 * two ids are reserved: data that predates the hand-built set (the test
 * fixture) still validates against the schema, but NO generation path may
 * ship one — `components/sims.tsx` renders an unimplemented template as a
 * "coming soon" placeholder, and a learner must never see that. Every path
 * that can carry a sim (live generation, adaptation, cached run, hero
 * fallback) therefore passes through the guards below.
 */
import type { Component } from "./spec.ts";

export const SIM_TEMPLATES = ["two-state-prob", "double-slit", "bayes-update", "slider-curve", "vector-field"] as const;
export type SimTemplate = (typeof SIM_TEMPLATES)[number];

/** The templates the app can actually render (components/sims.tsx). */
export const IMPLEMENTED_SIM_TEMPLATES = ["two-state-prob", "double-slit", "bayes-update"] as const;
export type ImplementedSimTemplate = (typeof IMPLEMENTED_SIM_TEMPLATES)[number];

export function isImplementedSimTemplate(t: string): t is ImplementedSimTemplate {
  return (IMPLEMENTED_SIM_TEMPLATES as readonly string[]).includes(t);
}

/** `t` when implemented, otherwise the given default (never a placeholder). */
export function simTemplateOrDefault(
  t: string,
  dflt: ImplementedSimTemplate = "two-state-prob",
): ImplementedSimTemplate {
  return isImplementedSimTemplate(t) ? t : dflt;
}

type ConceptLike = { components: Component[] };

/**
 * Drop sim components whose template is not implemented; every other
 * component is untouched and concepts without a placeholder keep their
 * identity. Deterministic, no LLM — this is the one guarantee that a
 * placeholder sim cannot reach the UI from generated, adapted or cached
 * content. A concept left with no components at all is honest: the existing
 * "couldn't generate this" state covers it (the generator always emits an
 * explainer, so in practice only a sim is ever dropped).
 */
export function normalizeSimComponents<T extends ConceptLike>(concepts: T[]): T[] {
  return concepts.map((c) => {
    const components = c.components.filter(
      (comp) => comp.type !== "sim" || isImplementedSimTemplate(comp.template),
    );
    return components.length === c.components.length ? c : { ...c, components };
  });
}
