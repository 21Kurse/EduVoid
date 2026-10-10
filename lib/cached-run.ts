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
import bayesRaw from "../data/cached/bayes-theorem.json";
import qmRaw from "../data/cached/qm-superposition.json";
import { curriculumSpecLooseSchema, type CurriculumSpec } from "./spec";
import { normalizeQuizComponents } from "./quiz-dedupe";
import { normalizeSimComponents } from "./sim-templates";
import type { Contradiction, ExtractedClaim } from "./source";

/**
 * Demo-safe runs, PRIMARY FIRST (owner request, Oct 10: the app is tailored
 * to Bayes' theorem for now, so that is the topic the video scripts around
 * and the one whose capture has to exist). The quantum run is kept: it is a
 * real capture, and a judge who types it deserves the same safety net.
 */
export type DemoRun = {
  topic: string;
  /** Path in the repo, for error messages and docs. */
  file: string;
  /** Does a normalized typed topic belong to this run? */
  matches: (normalized: string) => boolean;
  raw: unknown;
};

export const DEMO_RUNS: DemoRun[] = [
  {
    topic: "Bayes' theorem",
    file: "data/cached/bayes-theorem.json",
    matches: (n) => n.includes("bayes"),
    raw: bayesRaw,
  },
  {
    topic: "quantum superposition and measurement",
    file: "data/cached/qm-superposition.json",
    matches: (n) => n.includes("superposition"),
    raw: qmRaw,
  },
];

/** The topic the demo path is tailored to (first registry entry). */
export const DEMO_TOPIC = DEMO_RUNS[0]!.topic;

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
 * The cached run for a typed topic, or null. Matching is generous about
 * phrasing ("Bayes theorem", "Bayes' Theorem", "bayes rule") and strict
 * about subject: a run is only offered for the topic it was captured for.
 */
export function demoRunFor(topic: string): DemoRun | null {
  const n = normalizeTopic(topic);
  if (!n) return null;
  return DEMO_RUNS.find((r) => r.matches(n) || n === normalizeTopic(r.topic)) ?? null;
}

/** Is this one of the captured demo topics? */
export function isDemoTopic(topic: string): boolean {
  return demoRunFor(topic) !== null;
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
  // Sim templates go through the same gate so a capture can never carry a
  // placeholder sim either (only the two hand-built templates are rendered).
  const normalizedSpec: CurriculumSpec = {
    ...spec.data,
    concepts: normalizeSimComponents(normalizeQuizComponents(spec.data.concepts)),
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

const memo = new Map<string, CachedLesson | null>();

/**
 * The cached lesson for a topic (defaults to the primary demo topic), parsed
 * once per run. Null means that capture is unusable — the caller renders the
 * normal error state instead of a broken lesson.
 */
export function getCachedLesson(topic: string = DEMO_TOPIC): CachedLesson | null {
  const run = demoRunFor(topic);
  if (!run) return null;
  if (!memo.has(run.file)) memo.set(run.file, parseCachedRun(run.raw));
  return memo.get(run.file) ?? null;
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
  memo.clear();
}
