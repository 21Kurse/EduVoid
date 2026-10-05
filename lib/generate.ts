/**
 * Generate stage (AGENTS.md §4.3, §13.5): ONE generator call per concept
 * filling typed components from the fixed library. No free-form app code.
 * Per-item salvage: bad quiz items are dropped, the whole concept only
 * fails when even the explainer is missing.
 */
import { complete } from "./llm.ts";
import { z } from "zod";
import type { Concept } from "./spec.ts";
import type { SourceResult } from "./source.ts";
import { HERO_MESSAGES_SYSTEM, heroSimSchema, validateHeroCode, type HeroSimSpec } from "./hero-sim.ts";
import { SIM_TEMPLATES } from "./sim-templates.ts";

// Schema is deliberately permissive: per-item salvage happens in code so a
// single bad quiz option does not burn a schema retry (and its tokens).
const genSchema = z.object({
  explainer: z.string(),
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
  'You write study content for ONE concept. Output ONLY JSON of shape {"explainer":string,"quiz":[{"prompt":string,"options":[string],"answer":number,"explanation":string}],"flashcards":[{"front":string,"back":string}],"sim":optional({"template":"two-state-prob"|"double-slit","values":{string:number},"predictPrompt":string})}. Ground every statement in the cited claims given to you (paraphrase; quotes under 15 words). Use $...$ for inline math. 2 quiz questions, 1-2 flashcards. If a concrete numeric simulation of this concept fits one of the listed templates, include "sim" with 2-4 numeric values (two-state-prob: p in 0..1 and n shots; double-slit: slit separation d and wavelength lambda) and a prediction question; otherwise omit it.';

export type GeneratedConcept =
  | { ok: true; concept: Concept; latencyMs: number }
  | { ok: false; detail: string; latencyMs: number };

function claimsForConcept(topic: string, concept: { id: string; title: string; summary: string }, source: SourceResult): string {
  // Flagged claims (T7 verifier) must never ground generation (§4.4).
  const supported = source.claims.filter((c) => c.status === "supported");
  const own = supported.slice(0, 10).map((c, i) => `${i + 1}. ${c.text} [passages: ${c.passageIds.join(", ")}]`).join("\n");
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
  opts: { timeoutMs?: number } = {},
): Promise<GeneratedConcept> {
  const t0 = Date.now();
  const r = await complete({
    role: "generator",
    system: GEN_SYSTEM,
    messages: [{ role: "user", content: claimsForConcept(topic, concept, source) }],
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

  const components: Concept["components"] = [
    { type: "explainer", markdown: d.explainer.slice(0, 4000) },
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
    concept: { id: concept.id, title: concept.title, summary: concept.summary, claims: [], components },
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
