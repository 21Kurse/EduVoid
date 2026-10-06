/**
 * Generate stage (AGENTS.md §4.3, §13.5): ONE generator call per concept
 * filling typed components from the fixed library. No free-form app code.
 * Per-item salvage: bad quiz items are dropped, the whole concept only
 * fails when even the explainer is missing.
 */
import { complete } from "./llm.ts";
import { z } from "zod";
import type { Claim, Concept } from "./spec.ts";
import type { SourceResult } from "./source.ts";
import { numberClaims, postProcessExplainer } from "./claim-numbers.ts";
import { HERO_MESSAGES_SYSTEM, heroSimSchema, validateHeroCode, type HeroSimSpec } from "./hero-sim.ts";
import { SIM_TEMPLATES } from "./sim-templates.ts";

// Schema is deliberately permissive: per-item salvage happens in code so a
// single bad quiz option does not burn a schema retry (and its tokens).
const genSchema = z.object({
  explainer: z.string(),
  /** Claim ids the explainer/quiz actually used (G3 finding 1: concept -> claim mapping). */
  grounding: z.array(z.string()).max(12).default([]),
  quiz: z
    .array(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()),
        answer: z.number(),
        explanation: z.string(),
      }),
    )
    .max(6)
    .default([]),
  flashcards: z
    .array(z.object({ front: z.string(), back: z.string() }))
    .max(4)
    .default([]),
  sim: z
    .object({
      template: z.string(),
      values: z.record(z.string(), z.unknown()).optional(),
      predictPrompt: z.string(),
    })
    .optional(),
});

const GEN_SYSTEM =
  'You write study content for ONE concept. Output ONLY JSON of shape {"explainer":string,"grounding":[string],"quiz":[{"prompt":string,"options":[string],"answer":number,"explanation":string}],"flashcards":[{"front":string,"back":string}],"sim":optional({"template":"two-state-prob"|"double-slit","values":{string:number},"predictPrompt":string})}. Ground every statement in the cited claims given to you (paraphrase; quotes under 15 words). Use $...$ for inline math. 2 quiz questions, 1-2 flashcards. If a concrete numeric simulation of this concept fits one of the listed templates, include "sim" with 2-4 numeric values (two-state-prob: p in 0..1 and n shots; double-slit: slit separation d and wavelength lambda) and a prediction question; otherwise omit it. Cite as you write: after each sentence a claim supports, append the marker [[claim-id]] using the exact id from the claim pool. List every id you used in "grounding". NEVER write claim numbers or ids as prose (no "claim 9", no bare ids); the marker is the only citation form.';

/**
 * T11 (§13.7): regeneration must be a genuinely different modality, not a
 * re-roll of the same explainer. One hint per modality in MODALITY_CYCLE.
 */
export const MODALITY_HINT: Record<string, string> = {
  explainer:
    'Adaptation mode "worked explanation": write the explainer as a step-by-step worked walkthrough of one concrete example, carried through to its result with numbers.',
  sim: 'Adaptation mode "simulation": lead with the interactive sim — include a "sim" component choosing whichever listed template fits this concept best, and keep the explainer to 2-3 sentences of setup. If no template fits, use a concrete numeric worked example instead.',
  flashcards:
    'Adaptation mode "flashcards": include 3-4 flashcards covering the core ideas and keep the explainer to 2-3 sentences.',
  quiz: 'Adaptation mode "practice quiz": give 3 quiz questions of increasing difficulty and keep the explainer to 1-2 sentences.',
};

export type GeneratedConcept =
  | { ok: true; concept: Concept; latencyMs: number }
  | { ok: false; detail: string; latencyMs: number };

function claimsForConcept(topic: string, concept: { id: string; title: string; summary: string }, source: SourceResult): string {
  // Flagged claims (T7 verifier) must never ground generation (§4.4).
  const supported = source.claims.filter((c) => c.status === "supported");
  // Bullets with ids, no numbers: the model has nothing to mimic as
  // "claim 9" prose and can copy exact ids into [[...]] markers (G3 F2).
  const own = supported
    .slice(0, 10)
    .map((c) => `- ${c.text} [id: ${c.id}]`)
    .join("\n");
  const passages = source.sources
    .flatMap((s) => s.passages.map((p) => `[${p.id}] ${p.text.slice(0, 260)}`))
    .slice(0, 10)
    .join("\n");
  return [
    `Topic: "${topic}"`,
    `Concept: ${concept.title} -- ${concept.summary}`,
    `Verified claim pool:\n${own || "(none extracted; rely on passages)"}`,
    `Passages (cite mentally, do not copy):\n${passages}`,
  ].join("\n\n");
}

export async function generateConcept(
  topic: string,
  concept: { id: string; title: string; summary: string },
  source: SourceResult,
  opts: { timeoutMs?: number; modality?: string } = {},
): Promise<GeneratedConcept> {
  const t0 = Date.now();
  const hint = opts.modality ? MODALITY_HINT[opts.modality] : undefined;
  const content = hint
    ? `${claimsForConcept(topic, concept, source)}\n\nADAPTATION (regenerating for a learner who missed this concept): ${hint}`
    : claimsForConcept(topic, concept, source);
  const r = await complete({
    role: "generator",
    system: GEN_SYSTEM,
    messages: [{ role: "user", content }],
    schema: genSchema,
    temperature: 0.4,
    maxTokens: 2000,
    timeoutMs: opts.timeoutMs ?? 60_000,
    rateLimit: { baseMs: 1500, maxRetries: 2 },
  });
  const latencyMs = Date.now() - t0;
  if (!r.ok) {
    return { ok: false, detail: `${r.reason}: ${r.detail.slice(0, 200)}`, latencyMs };
  }
  const d = r.data;
  if (!d.explainer.trim()) {
    return { ok: false, detail: "generator returned an empty explainer", latencyMs };
  }

  // Concept -> claim assignment (G3 findings 1+2): the generator names the
  // ids it grounded on; only those (still verified) become this concept's
  // claims, in the order the generator used them. Display numbering and the
  // explainer's inline markers both derive from this list.
  const supportedById = new Map(
    source.claims.filter((c) => c.status === "supported").map((c) => [c.id, c]),
  );
  const conceptClaims: Claim[] = [];
  for (const id of d.grounding) {
    const c = supportedById.get(id);
    if (c && !conceptClaims.some((x) => x.id === c.id)) conceptClaims.push(c);
    if (conceptClaims.length >= 10) break;
  }
  const numbered = postProcessExplainer(
    d.explainer.slice(0, 4000),
    numberClaims(conceptClaims),
  );

  const components: Concept["components"] = [
    { type: "explainer", markdown: numbered.markdown },
  ];
  const quizItems = d.quiz
    .filter((q) => q.prompt.trim() && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length && q.explanation.trim())
    .slice(0, 3);
  if (quizItems.length > 0) {
    components.push({
      type: "quiz",
      questions: quizItems.map((q, i) => ({
        id: `${concept.id}-q${i + 1}`,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        passageIds: source.claims.slice(0, 1).flatMap((c) => c.passageIds).length
          ? source.claims[0].passageIds
          : (source.sources[0]?.passages ?? []).slice(0, 1).map((p) => p.id),
      })),
    });
  }
  const cards = d.flashcards.filter((c) => c.front.trim() && c.back.trim()).slice(0, 2);
  if (cards.length > 0) {
    components.push({ type: "flashcards", cards });
  }
  if (d.sim && (SIM_TEMPLATES as readonly string[]).includes(d.sim.template)) {
    components.push({
      type: "sim",
      template: d.sim.template as (typeof SIM_TEMPLATES)[number],
      params: { values: (d.sim.values ?? {}) as Record<string, number | string | boolean> },
      predictPrompt: d.sim.predictPrompt,
    });
  }
  return {
    ok: true,
    concept: {
      id: concept.id,
      title: concept.title,
      summary: concept.summary,
      claims: conceptClaims,
      components,
    },
    latencyMs,
  };
}

/**
 * One hero sim per run (T10): LLM-written canvas/JS, statically validated
 * here; the client re-validates at runtime (ready timeout + error trap)
 * and falls back to the paired template sim on any failure.
 */
export async function generateHeroSim(
  topic: string,
  concept: Concept,
  source: SourceResult,
  opts: { timeoutMs?: number; rateLimit?: { baseMs?: number; maxRetries?: number } } = {},
): Promise<{ ok: true; conceptId: string; spec: HeroSimSpec } | { ok: false; conceptId: string; detail: string }> {
  const claimBlock = source.claims
    .filter((c) => c.status === "supported")
    .slice(0, 8)
    .map((c) => `- ${c.text}`)
    .join("\n");
  const r = await complete({
    role: "generator",
    system: HERO_MESSAGES_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Topic: ${topic}\nConcept: ${concept.title} — ${concept.summary}\nVerified claims to illustrate:\n${claimBlock}`,
      },
    ],
    schema: heroSimSchema,
    maxTokens: 1400,
    timeoutMs: opts.timeoutMs,
    rateLimit: opts.rateLimit,
  });
  if (!r.ok) return { ok: false, conceptId: concept.id, detail: r.detail };
  const v = validateHeroCode(r.data.code);
  if (!v.ok) return { ok: false, conceptId: concept.id, detail: `hero code rejected: ${v.reason}` };
  return { ok: true, conceptId: concept.id, spec: r.data };
}
