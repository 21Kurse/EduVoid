/**
 * Concept merge (G3 finding 3): regenerated content is applied by concept
 * ID — never by index — so regenerating concept B changes only B, and every
 * other concept object keeps its identity (React subtree state like quiz
 * picks and sim runs survives). Returns null when the id is unknown so a
 * stale/aborted response can never leak into the wrong concept.
 */
import type { CurriculumSpec } from "./spec";

type Concept = CurriculumSpec["concepts"][number];

export function mergeConcept(
  spec: CurriculumSpec,
  conceptId: string,
  patch: { components?: Concept["components"]; claims?: Concept["claims"] },
): CurriculumSpec | null {
  let matched = false;
  const concepts = spec.concepts.map((c) => {
    if (c.id !== conceptId) return c;
    matched = true;
    return {
      ...c,
      ...(patch.components ? { components: patch.components } : {}),
      ...(patch.claims ? { claims: patch.claims } : {}),
    };
  });
  return matched ? { ...spec, concepts } : null;
}
