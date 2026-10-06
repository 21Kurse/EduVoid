/** Per-concept generation status in the lesson UI (shared by panel/feed). */
export type ConceptStatus = Record<string, { ok: boolean; detail?: string; loading?: boolean }>;

export const EMPTY_CONCEPT_STATUS: ConceptStatus = {};
