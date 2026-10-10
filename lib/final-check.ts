/**
 * Final check (owner request, Oct 10: "for Bayes' theorem it also asks
 * questions in the end"). The per-concept quizzes test one idea each as the
 * learner meets it; this is the set that closes the lesson — a handful of
 * harder questions that span every concept, including at least one that
 * applies the idea to a case the lesson did not show.
 *
 * Rules:
 *  - Grounded on the SAME verified claims the lesson was generated from
 *    (§4.4): the caller sends the concepts with their claim texts, and the
 *    prompt forbids anything outside them.
 *  - Never a repeat: the caller sends the prompts already on screen, and the
 *    deterministic dedupe (lib/quiz-dedupe.ts, no model) drops any question
 *    that duplicates one — inline or within the set.
 *  - Answers feed the SAME mastery rules and adaptive loop as an inline quiz
 *    (deterministic, §13.12): answering here is not a side channel.
 *  - This is NOT the participant eval (§6): `data/eval/questions.json` holds
 *    the external pre/post items and never comes from this module.
 */
import { z } from "zod";
import { complete } from "./llm.ts";
import { dedupeQuizItems } from "./quiz-dedupe.ts";

/** How many questions the final check aims for (5 fits a 2-minute demo beat). */
export const FINAL_CHECK_TARGET = 5;

/** Hard cap on what the model may return before the deterministic assembly. */
export const FINAL_CHECK_MAX = 6;

/**
 * At most this many questions about any one concept, so the closing set is
 * genuinely lesson-spanning.
 */
export const FINAL_CHECK_PER_CONCEPT_CAP = 2;

/** Below this the set stops being a lesson check; overflow tops it back up. */
export const FINAL_CHECK_MIN = 3;

export const finalCheckSchema = z.object({
  questions: z
    .array(
      z.object({
        conceptId: z.string(),
        prompt: z.string(),
        options: z.array(z.string()),
        answer: z.number(),
        explanation: z.string(),
      }),
    )
    .max(10)
    .default([]),
});

export type FinalCheckQuestion = z.infer<typeof finalCheckSchema>["questions"][number];

/** The concept slice the final check needs — already trimmed to verified claims. */
export type FinalCheckConcept = {
  id: string;
  title: string;
  summary: string;
  claims: { id: string; text: string }[];
};

export const FINAL_CHECK_SYSTEM =
  'You write the closing question set for a lesson. The learner has just studied every concept; now test whether they can use it. Output ONLY JSON of shape {"questions":[{"conceptId":string,"prompt":string,"options":[string],"answer":number,"explanation":string}]}. Rules: write 5 questions (never more than 6); each question tests ONE of the listed concepts and carries that concept\'s exact id in "conceptId"; SPREAD the set across the listed concepts — never more than two questions about the same concept, and cover as many different concepts as you can; never reuse a question the lesson already asked; "answer" is the 0-based index of the correct option. Make them HARDER than the concept quizzes: at least two must apply the idea to a case the lesson never showed (a new number, a new scenario, a transfer), and at least one must require the learner to reason about which quantity or which rule applies rather than recall a sentence. Exactly 4 options per question, all plausible, no "all of the above" and no joke options. The explanation is one or two sentences and says WHY, citing the numbers or the rule used. Ground every question and every correct answer ONLY in the verified claims given to you: if a claim you need is not there, ask about something that is. Use $...$ for inline math. Keep each prompt under 40 words and each option under 16 words.';

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function finalCheckPrompt(
  topic: string,
  concepts: readonly FinalCheckConcept[],
  avoidPrompts: readonly string[] = [],
): string {
  const conceptBlock = concepts
    .map((c) => {
      const claims = c.claims
        .slice(0, 8)
        .map((cl) => `  - ${truncate(cl.text, 260)}`)
        .join("\n");
      return `[${c.id}] ${c.title} — ${c.summary}\n${claims || "  - (no claims; skip this concept)"}`;
    })
    .join("\n");
  const asked = avoidPrompts.length
    ? `\n\nQuestions the lesson ALREADY asked (never repeat or paraphrase these):\n${avoidPrompts
        .slice(0, 24)
        .map((p) => `- ${truncate(p, 200)}`)
        .join("\n")}`
    : "";
  return `Topic: "${topic}"\n\nConcepts with their verified claims:\n${conceptBlock}${asked}`;
}

/**
 * Spread a set across the lesson: keep at most `cap` questions per concept,
 * then top back up from the overflow (in the model's order) if the spread
 * would leave fewer than FINAL_CHECK_MIN questions. A live run really did
 * return five questions all tagged with the same concept — the prompt now
 * forbids that, and this makes it impossible to reach the learner either way.
 */
export function spreadAcrossConcepts(
  questions: readonly FinalCheckQuestion[],
  cap: number = FINAL_CHECK_PER_CONCEPT_CAP,
): FinalCheckQuestion[] {
  const perConcept = new Map<string, number>();
  const kept: FinalCheckQuestion[] = [];
  const overflow: FinalCheckQuestion[] = [];
  for (const q of questions) {
    const n = perConcept.get(q.conceptId) ?? 0;
    if (n < cap) {
      perConcept.set(q.conceptId, n + 1);
      kept.push(q);
    } else {
      overflow.push(q);
    }
  }
  if (kept.length >= FINAL_CHECK_MIN) return kept;
  const topped = [...kept];
  for (const q of overflow) {
    if (topped.length >= FINAL_CHECK_MIN) break;
    topped.push(q);
  }
  return topped;
}

/**
 * Deterministic assembly (§12: no silent bad output, no model judgement in
 * code paths): drop malformed items, drop questions about concepts that do
 * not exist, drop repeats of anything already on screen or earlier in the
 * set, cap, then spread the survivors across the lesson. Order is preserved,
 * so the model's hardest question first survives.
 */
export function assembleFinalCheck(
  raw: { questions: FinalCheckQuestion[] },
  concepts: readonly FinalCheckConcept[],
  avoidPrompts: readonly string[] = [],
): FinalCheckQuestion[] {
  const known = new Set(concepts.map((c) => c.id));
  const usable = raw.questions.filter(
    (q) =>
      known.has(q.conceptId) &&
      q.prompt.trim().length > 0 &&
      q.options.length >= 2 &&
      q.options.every((o) => o.trim().length > 0) &&
      Number.isInteger(q.answer) &&
      q.answer >= 0 &&
      q.answer < q.options.length &&
      q.explanation.trim().length > 0,
  );
  const questionSet = dedupeQuizItems(usable, avoidPrompts, FINAL_CHECK_MAX);
  return spreadAcrossConcepts(questionSet).map((q) => ({
    conceptId: q.conceptId,
    prompt: q.prompt.trim(),
    options: q.options.slice(0, 6),
    answer: q.answer,
    explanation: q.explanation.trim(),
  }));
}

export type FinalCheckResult =
  | { ok: true; questions: FinalCheckQuestion[]; latencyMs: number }
  | { ok: false; detail: string; latencyMs: number };

/**
 * One short model call (never the whole lesson, §2): the closing question set
 * for a lesson whose concepts are already generated and verified.
 */
export async function runFinalCheck(
  topic: string,
  concepts: readonly FinalCheckConcept[],
  opts: { avoidPrompts?: readonly string[]; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<FinalCheckResult> {
  const t0 = Date.now();
  const avoidPrompts = opts.avoidPrompts ?? [];
  const r = await complete({
    role: "generator",
    system: FINAL_CHECK_SYSTEM,
    messages: [{ role: "user", content: finalCheckPrompt(topic, concepts, avoidPrompts) }],
    schema: finalCheckSchema,
    temperature: 0.5,
    maxTokens: 1800,
    timeoutMs: opts.timeoutMs ?? 45_000,
    signal: opts.signal,
    rateLimit: { baseMs: 1500, maxRetries: 2 },
  });
  const latencyMs = Date.now() - t0;
  if (!r.ok) return { ok: false, detail: `${r.reason}: ${r.detail.slice(0, 200)}`, latencyMs };
  const questions = assembleFinalCheck(r.data, concepts, avoidPrompts);
  if (questions.length === 0) {
    return {
      ok: false,
      detail: "every generated question was malformed or repeated a question already asked",
      latencyMs,
    };
  }
  return { ok: true, questions, latencyMs };
}
