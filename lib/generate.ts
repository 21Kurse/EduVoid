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
import {
  MAX_QUIZ_PER_CONCEPT,
  MAX_QUIZ_PER_PRACTICE_SET,
  dedupeQuizItems,
} from "./quiz-dedupe.ts";
import { MODALITY_HINT, modalityFeedback, usableModality } from "./modality.ts";
import { fitsLocalTemplate } from "./local-adapt.ts";
import { HERO_MESSAGES_SYSTEM, heroSimSchema, validateHeroCode, type HeroSimSpec } from "./hero-sim.ts";
import { isImplementedSimTemplate } from "./sim-templates.ts";

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

/** Exported for tests: the quiz rule lives in the prompt and in code. */
export const GEN_SYSTEM =
  'You write study content for ONE concept. Output ONLY JSON of shape {\"explainer\":string,\"grounding\":[string],\"quiz\":[{\"prompt\":string,\"options\":[string],\"answer\":number,\"explanation\":string}],\"flashcards\":[{\"front\":string,\"back\":string}],\"sim\":optional({\"template\":\"two-state-prob\"|\"double-slit\"|\"bayes-update\",\"values\":{string:number},\"predictPrompt\":string})}. Ground every statement in the cited claims given to you (paraphrase; quotes under 15 words). Use $...$ for inline math. Write to build intuition and write enough to do it: 4 to 7 short paragraphs, roughly 250 to 450 words, starting from what the learner already knows, in plain words, defining each technical term the first time it appears, and ending with the single idea to remember. Prefer one concrete picture or analogy over abstraction, and keep one point per sentence, put a blank line between paragraphs, and keep each paragraph to 2 to 4 sentences. Decide whether an example is needed: when the concept involves a procedure, a calculation or a quantity, include ONE worked example with its numbers carried through to the result, under a short heading beginning with the word Example; when the concept is a definition or an idea with nothing to compute, do NOT bolt on a made-up example and never invent numbers. Exactly ONE quiz question whenever this concept teaches a testable fact (a definition, a rule, a number to predict) — phrase it about THAT fact, not about the topic in general; output \"quiz\":[] only when nothing in the concept can be tested. Never ask the generic \"what happens when it is measured\" / \"why do outcomes vary\" style question — other concepts in this lesson already cover it. 1-2 flashcards. MOST concepts must have NO sim: a prediction prompt is not required for every concept. Include \"sim\" ONLY when this concept is itself about two-outcome probabilities or amplitudes, about interference, fringes or diffraction, or about updating a belief from evidence (Bayes, base rates, test accuracy) — then give 2-4 numeric values (two-state-prob: p in 0..1 and n shots; double-slit: slit separation d and wavelength lambda; bayes-update: prior, sensitivity and falsePositive each in 0..1) and ONE prediction question that this concept’s own content answers. A sim with a prediction the concept does not cover is worse than no sim, so omit \"sim\" in every other case. Cite as you write: after each sentence a claim supports, append the marker [[claim-id]] using the exact id from the claim pool. List every id you used in \"grounding\". NEVER write claim numbers or ids as prose (no \"claim 9\", no bare ids); the marker is the only citation form.';

/**
 * T11 (§13.7) + G3 F3: modality hints and enforcement live in modality.ts.
 */
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

type ParsedGen = z.infer<typeof genSchema>;

/**
 * Build the typed Concept from a validated generator output: assigns the
 * grounded claims (G3 F1/F2), post-processes explainer markers, and salvages
 * quiz/flashcards/sim items per component.
 */
function buildConcept(
  d: ParsedGen,
  concept: { id: string; title: string; summary: string },
  source: SourceResult,
  modality?: string,
  /** Prompts already rendered elsewhere in this lesson (quiz hygiene). */
  avoidPrompts: readonly string[] = [],
): Concept {
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
  // Owner request (Oct 10): write more and build intuition. The explainer is
  // deliberately allowed to be long (the prompt asks for 250-450 words); the
  // cap is a safety net against a runaway generation, not a target.
  const numbered = postProcessExplainer(
    d.explainer.slice(0, 8000),
    numberClaims(conceptClaims),
  );

  const components: Concept["components"] = [
    { type: "explainer", markdown: numbered.markdown },
  ];
  // Owner feedback (Oct 8): ONE question per concept, and never a repeat of
  // a question another concept already shows. The "practice quiz" modality
  // is the deliberate exception — that adaptation IS a short question set.
  const quizItems = dedupeQuizItems(
    d.quiz.filter(
      (q) =>
        q.prompt.trim() &&
        q.options.length >= 2 &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < q.options.length &&
        q.explanation.trim(),
    ),
    avoidPrompts,
    modality === "quiz" ? MAX_QUIZ_PER_PRACTICE_SET : MAX_QUIZ_PER_CONCEPT,
  );
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
  const maxCards = modality === "flashcards" ? 4 : 2;
  const cards = d.flashcards.filter((c) => c.front.trim() && c.back.trim()).slice(0, maxCards);
  if (cards.length > 0) {
    components.push({ type: "flashcards", cards });
  }
  // Only the hand-built templates may ship (§13.6). The prompt offers just
  // those three; a reserved id (`slider-curve` / `vector-field`) is dropped
  // entirely — the concept keeps its explainer/quiz/flashcards rather than
  // showing a learner a "coming soon" placeholder.
  if (d.sim && isImplementedSimTemplate(d.sim.template)) {
    // Owner feedback (Oct 10): prediction questions are not required for
    // every concept — models force-fit the two-state template onto unrelated
    // concepts, and the learner then gets a random "commit to a prediction"
    // gate. The template only ships when it genuinely fits this concept's own
    // text, using the same deterministic fit signal as the adaptation fallback
    // and the hero-sim safety net (lib/local-adapt.ts, no model, no randomness).
    // A dropped sim leaves the explainer/quiz/flashcards untouched.
    const candidate: Concept = {
      id: concept.id,
      title: concept.title,
      summary: concept.summary,
      claims: conceptClaims,
      components,
    };
    if (fitsLocalTemplate(d.sim.template, candidate, source.topic)) {
      components.push({
        type: "sim",
        template: d.sim.template,
        params: { values: (d.sim.values ?? {}) as Record<string, number | string | boolean> },
        predictPrompt: d.sim.predictPrompt,
      });
    } else {
      console.log(
        `[generate] dropped '${d.sim.template}' sim for ${concept.id}: the template does not fit this concept`,
      );
    }
  }
  return { id: concept.id, title: concept.title, summary: concept.summary, claims: conceptClaims, components };
}

export async function generateConcept(
  topic: string,
  concept: { id: string; title: string; summary: string },
  source: SourceResult,
  opts: {
    timeoutMs?: number;
    modality?: string;
    signal?: AbortSignal;
    /** Quiz prompts already on screen; a concept never repeats one. */
    avoidPrompts?: readonly string[];
  } = {},
): Promise<GeneratedConcept> {
  const t0 = Date.now();
  const hint = opts.modality ? MODALITY_HINT[opts.modality] : undefined;
  const content = hint
    ? `${claimsForConcept(topic, concept, source)}\n\nADAPTATION (regenerating for a learner who missed this concept): ${hint}`
    : claimsForConcept(topic, concept, source);
  const call = (c: string) =>
    complete({
      role: "generator",
      system: GEN_SYSTEM,
      messages: [{ role: "user", content: c }],
      schema: genSchema,
      temperature: 0.4,
      // Raised with the longer explainer (owner request: write more).
      maxTokens: 3200,
      timeoutMs: opts.timeoutMs ?? 60_000,
      signal: opts.signal,
      rateLimit: { baseMs: 1500, maxRetries: 2 },
    });
  const latencyMs = () => Date.now() - t0;
  const fail = (detail: string) => ({ ok: false as const, detail, latencyMs: latencyMs() });

  const r = await call(content);
  if (!r.ok) return fail(`${r.reason}: ${r.detail.slice(0, 200)}`);
  if (!r.data.explainer.trim()) return fail("generator returned an empty explainer");
  let built = buildConcept(r.data, concept, source, opts.modality, opts.avoidPrompts);

  // G3 F3 enforcement: the requested modality must actually exist, or the
  // banner would promise something the panel does not show. One stronger
  // retry, then an honest failure (the client keeps the original content).
  const modality = opts.modality && opts.modality !== "explainer" ? opts.modality : null;
  if (modality && !usableModality(built.components, modality)) {
    console.warn(`[generate] modality '${modality}' missing for ${concept.id}; retrying once`);
    const r2 = await call(`${content}\n\n${modalityFeedback(modality)}`);
    if (r2.ok && r2.data.explainer.trim()) {
      const built2 = buildConcept(r2.data, concept, source, modality, opts.avoidPrompts);
      if (usableModality(built2.components, modality)) built = built2;
    }
  }
  if (modality && !usableModality(built.components, modality)) {
    return fail(`adaptation failed: no usable '${modality}' component in generator output`);
  }
  return { ok: true, concept: built, latencyMs: latencyMs() };
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
  opts: {
    timeoutMs?: number;
    rateLimit?: { baseMs?: number; maxRetries?: number };
    signal?: AbortSignal;
  } = {},
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
    maxTokens: 2200,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
    rateLimit: opts.rateLimit,
  });
  if (!r.ok) return { ok: false, conceptId: concept.id, detail: r.detail };
  const v = validateHeroCode(r.data.code);
  if (!v.ok) return { ok: false, conceptId: concept.id, detail: `hero code rejected: ${v.reason}` };
  return { ok: true, conceptId: concept.id, spec: r.data };
}
