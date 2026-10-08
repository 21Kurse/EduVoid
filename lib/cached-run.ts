/**
 * Demo-safe cached run (T14, AGENTS.md §7 + §15.3). Loads the verified output
 * of a REAL pipeline run for the demo topic, captured by `npm run capture:demo`.
 *
 * Hard rules enforced here:
 *  - Used ONLY when live generation fails (the caller decides) and never as
 *    a default.
 *  - Only for the demo topic; any other topic gets the normal error state.
 *  - The UI must label it exactly "cached run" and never present it as live.
 */
import raw from "../data/cached/qm-superposition.json";
import { curriculumSpecLooseSchema, type CurriculumSpec } from "./spec";
import { normalizeQuizComponents } from "./quiz-dedupe";
import type { Contradiction, ExtractedClaim } from "./source";

export const DEMO_TOPIC = "quantum superposition and measurement";

/**
 * The exact UI label for the demo-safe run. Never reworded to sound live
 * (§7, §15.3): it must always read "cached run".
 */
export const CACHED_RUN_LABEL = "cached run";

export type CachedHero = {
  conceptId: string;
  code: string;
  fallback: { template: string; values: Record<string, number | string | boolean>; predictPrompt: string };
};

export type CachedLesson = {
  topic: string;
  capturedAt: string;
  model: string;
  spec: CurriculumSpec;
  sources: { id: string; title: string; url: string; authority: string }[];
  claims: ExtractedClaim[];
  passages: { id: string; text: string; url: string; sourceId: string }[];
  contradictions: Contradiction[];
  verify: { supported: number; total: number; sources: number; flagged: number; degraded: boolean };
  hero: CachedHero | null;
};

function normalizeTopic(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Is this the demo topic? Generous enough for "quantum superposition",
 * "superposition and measurement", etc. — the cached content is only about
 * superposition, so nothing else may claim it.
 */
export function isDemoTopic(topic: string): boolean {
  const n = normalizeTopic(topic);
  if (!n) return false;
  return n.includes("superposition") || n === normalizeTopic(DEMO_TOPIC);
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Validate + normalize the captured payload; null when unusable. */
export function parseCachedRun(data: unknown): CachedLesson | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  // Loose schema: the cached run is merged runtime state, where the same
  // verified claim may ground more than one concept (each keeps its own copy).
  const spec = curriculumSpecLooseSchema.safeParse(d.spec);
  if (!spec.success) return null;
  // A cached run with no generated content is not a usable lesson.
  if (spec.data.concepts.length === 0) return null;
  if (!spec.data.concepts.some((c) => c.components.length > 0)) return null;

  // Quiz hygiene (owner feedback, Oct 8): the capture predates the
  // one-question-per-concept rule, so normalize it through the SAME helper a
  // live run uses — otherwise the demo-safe fallback would still show the
  // repeated measurement/probability questions the owner asked us to remove.
  // Only quiz components are touched; every other byte of the capture stands.
  const normalizedSpec: CurriculumSpec = {
    ...spec.data,
    concepts: normalizeQuizComponents(spec.data.concepts),
  };

  const v = (d.verify ?? {}) as Record<string, unknown>;
  const heroRaw = d.hero as { conceptId?: string; ok?: boolean; code?: string; fallback?: unknown } | null;
  const hero: CachedHero | null =
    heroRaw && heroRaw.ok !== false && typeof heroRaw.code === "string" && heroRaw.fallback
      ? {
          conceptId: heroRaw.conceptId ?? normalizedSpec.concepts[0]!.id,
          code: heroRaw.code,
          fallback: heroRaw.fallback as CachedHero["fallback"],
        }
      : null;

  return {
    topic: typeof d.topic === "string" ? d.topic : spec.data.topic,
    capturedAt: typeof d.capturedAt === "string" ? d.capturedAt : "",
    model: typeof d.model === "string" ? d.model : "unknown",
    spec: normalizedSpec,
    sources: (d.sources as CachedLesson["sources"] | undefined) ?? [],
    claims: (d.claims as ExtractedClaim[] | undefined) ?? [],
    passages: (d.passages as CachedLesson["passages"] | undefined) ?? [],
    contradictions: (d.contradictions as Contradiction[] | undefined) ?? [],
    verify: {
      supported: num(v.supported),
      total: num(v.total),
      sources: num(v.sources),
      flagged: num(v.flagged),
      degraded: v.degraded === true,
    },
    hero,
  };
}

let memo: CachedLesson | null | undefined;

/** The cached lesson, parsed once. Null means the cache is unusable. */
export function getCachedLesson(): CachedLesson | null {
  if (memo === undefined) memo = parseCachedRun(raw);
  return memo;
}

/**
 * Everything the lesson view needs, in one object — so the component applies a
 * cached lesson with one state batch and never issues a live request (§15.3).
 */
export function cachedLessonView(lesson: CachedLesson) {
  return {
    spec: lesson.spec,
    sources: lesson.sources,
    claims: lesson.claims,
    passages: lesson.passages,
    contradictions: lesson.contradictions,
    verify: {
      supported: lesson.verify.supported,
      total: lesson.verify.total,
      sources: lesson.verify.sources,
    },
    flagged: lesson.verify.flagged,
    hero: lesson.hero ? { conceptId: lesson.hero.conceptId, code: lesson.hero.code, fallback: lesson.hero.fallback } : null,
    selectedConceptId: lesson.spec.concepts[0]?.id ?? null,
    conceptStatus: Object.fromEntries(
      lesson.spec.concepts.map((c) => [c.id, { ok: c.components.length > 0 }]),
    ) as Record<string, { ok: boolean }>,
  };
}

/** Test helper. */
export function resetCachedLessonCache(): void {
  memo = undefined;
}
