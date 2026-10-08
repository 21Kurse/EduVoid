/**
 * Quiz hygiene (owner feedback, Oct 8): the generator was attaching two
 * questions to every concept and asking the SAME measurement/probability
 * question in most of them ("What happens to a quantum system's
 * superposition when it is measured?" appeared verbatim on two concepts in
 * one run). Rules enforced here, deterministically:
 *
 *  - at most ONE question per concept (a practice-quiz adaptation may ask
 *    up to MAX_QUIZ_PER_PRACTICE_SET, because that modality is explicitly
 *    "a set of practice questions");
 *  - a question may not repeat a question already rendered in the lesson —
 *    neither verbatim nor as a near-duplicate paraphrase.
 *
 * No LLM in this path: the client passes the prompts already on screen and
 * whatever survives here is what the learner sees.
 */

/** One question per concept (the default so a lesson never repeats itself). */
export const MAX_QUIZ_PER_CONCEPT = 1;

/** The "practice quiz" adaptation modality is deliberately a small set. */
export const MAX_QUIZ_PER_PRACTICE_SET = 3;

/** Words that carry no topic signal, so they must not inflate similarity. */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "these", "those", "from", "into",
  "what", "which", "when", "where", "whose", "why", "how", "does", "did", "doing",
  "is", "are", "was", "were", "been", "being", "be", "has", "have", "had",
  "can", "could", "will", "would", "should", "must", "may", "might",
  "you", "your", "yours", "their", "theirs", "them", "they", "its", "it",
  "not", "any", "all", "some", "more", "most", "less", "least", "than", "then",
  "about", "after", "before", "between", "during", "over", "under", "upon",
  "one", "two", "three", "each", "other", "another", "such", "also", "both",
]);

/** Lowercase, punctuation-free, whitespace-collapsed form used for equality. */
export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Crude but deterministic stem. Two folds, both needed in practice:
 *  1. plural: "state"/"states" must collapse, or a restated question slips
 *     through on a plural alone (this really happened — see the FIDELITY
 *     pair in tests, caught live on Oct 8); never fold an "ss" ending.
 *  2. truncation: long words cut to 6 chars so "measured"/"measurement"
 *     collapse to "measur".
 * Truncation beats a stemmer here — no dependency, no surprises.
 */
function stem(token: string): string {
  let t = token;
  if (t.length >= 4 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return t.length > 6 ? t.slice(0, 6) : t;
}

/**
 * Topic-bearing tokens of a prompt: stopwords and one/two-letter noise are
 * dropped, but DIGITS ARE KEPT ("0.6" -> "0", "6"), so two numeric drills
 * that differ only in their numbers stay distinct.
 */
export function contentTokens(prompt: string): string[] {
  return normalizePrompt(prompt)
    .split(" ")
    .filter((t) => (t.length > 2 || /^\d+$/.test(t)) && !STOPWORDS.has(t))
    .map(stem);
}

/** Minimum shared tokens before containment may even be considered. */
const MIN_SHARED_TOKENS = 3;

/**
 * Overlap coefficient, not Jaccard: "does one question subsume the other?"
 * Two ask-the-same-thing prompts can share little vocabulary ("...state when
 * a measurement is performed" vs "...superposition when it is measured") but
 * the shorter one is almost fully contained in the longer one.
 */
export function promptContainment(a: string, b: string): number {
  const ta = new Set(contentTokens(a));
  const tb = new Set(contentTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  if (shared < MIN_SHARED_TOKENS) return 0;
  return shared / Math.min(ta.size, tb.size);
}

/** Above this, two prompts are treated as the same question. */
export const DUPLICATE_CONTAINMENT = 0.8;

/** Digit runs in a prompt ("0.6" -> ["0","6"]). */
export function numberTokens(prompt: string): string[] {
  return normalizePrompt(prompt)
    .split(" ")
    .filter((t) => /^\d+$/.test(t));
}

/**
 * Two questions that differ in their numbers are different questions: "P(0)
 * for alpha = 0.6" and "P(1) for alpha = 0.8" are drills, not a repeat, so
 * the paraphrase test is skipped when both carry (different) numbers.
 */
function differsOnlyInNumbers(a: string, b: string): boolean {
  const na = numberTokens(a);
  const nb = numberTokens(b);
  if (na.length === 0 || nb.length === 0) return false;
  return na.length !== nb.length || na.some((d, i) => d !== nb[i]);
}

/** Is this prompt already on screen (verbatim or as a paraphrase)? */
export function isDuplicatePrompt(prompt: string, seen: readonly string[]): boolean {
  const n = normalizePrompt(prompt);
  if (!n) return true; // an empty prompt is never worth rendering
  for (const s of seen) {
    if (normalizePrompt(s) === n) return true;
    if (differsOnlyInNumbers(prompt, s)) continue;
    if (promptContainment(prompt, s) >= DUPLICATE_CONTAINMENT) return true;
  }
  return false;
}

/**
 * Cap to `cap` items, dropping anything that repeats `seen` or an earlier
 * item in the same batch. Order is preserved, so the generator's best
 * (usually first) question survives.
 */
export function dedupeQuizItems<T extends { prompt: string }>(
  items: readonly T[],
  seen: readonly string[],
  cap: number = MAX_QUIZ_PER_CONCEPT,
): T[] {
  const out: T[] = [];
  const known = [...seen];
  for (const item of items) {
    if (out.length >= cap) break;
    if (isDuplicatePrompt(item.prompt, known)) continue;
    out.push(item);
    known.push(item.prompt);
  }
  return out;
}

/**
 * Minimal shape of a concept for quiz hygiene: anything with components,
 * where a quiz component carries questions with prompts. Kept structural so
 * this module never depends on the full spec schema.
 */
type ConceptLike = {
  components: readonly { type: string; questions?: readonly { prompt: string }[] }[];
};

type WithComponents = readonly ConceptLike[];

/** Every quiz prompt the learner can already see in this lesson. */
export function renderedQuizPrompts(concepts: WithComponents): string[] {
  return concepts.flatMap((c) =>
    c.components.flatMap((comp) =>
      comp.type === "quiz" ? (comp.questions ?? []).map((q) => q.prompt) : [],
    ),
  );
}

/**
 * Remove a question that duplicates something already on screen. Used by the
 * client after a response (the server dedupes too, but two concurrent
 * concept requests can race and both look "first").
 */
export function stripDuplicateQuiz<T extends ConceptLike>(
  concept: T,
  seen: readonly string[],
): T {
  const components = concept.components.flatMap((comp) => {
    if (comp.type !== "quiz") return [comp];
    const all = comp.questions ?? [];
    const questions = all.filter((q) => !isDuplicatePrompt(q.prompt, seen));
    if (questions.length === all.length) return [comp]; // untouched
    return questions.length > 0 ? [{ ...comp, questions }] : [];
  });
  const unchanged =
    components.length === concept.components.length &&
    components.every((c, i) => c === concept.components[i]);
  return unchanged ? concept : ({ ...concept, components } as T);
}

/**
 * Lesson-wide reconciliation for concepts that were generated in PARALLEL
 * (owner feedback, Oct 8). The per-call `avoidPrompts` list cannot help here:
 * two concept requests are in flight at the same time, so neither can see the
 * other's question — a live run really did ship "what is the quantum fidelity
 * ... after measurement" on two concepts this way. This pass runs after every
 * merge, in lesson order, and drops any question an EARLIER concept already
 * shows (verbatim or paraphrase). It never caps: a "practice quiz" adaptation
 * is deliberately a small set, and those questions are unique anyway.
 * Concepts with nothing to fix keep their identity, so re-running it after a
 * patch never triggers a render loop.
 */
export function withUniqueQuizzes<T extends ConceptLike>(concepts: readonly T[]): T[] {
  const seen: string[] = [];
  let changed = false;
  const out = concepts.map((concept) => {
    let touched = false;
    const components = concept.components.flatMap((comp) => {
      if (comp.type !== "quiz") return [comp];
      const all = comp.questions ?? [];
      const questions = all.filter((qq) => !isDuplicatePrompt(qq.prompt, seen));
      seen.push(...questions.map((qq) => qq.prompt));
      if (questions.length === all.length) return [comp]; // untouched
      touched = true;
      return questions.length > 0 ? [{ ...comp, questions }] : [];
    });
    if (!touched) return concept;
    changed = true;
    return { ...concept, components } as T;
  });
  return changed ? out : (concepts as unknown as T[]);
}

/**
 * Apply the whole-lesson rules to a list of concepts, in order: at most
 * `cap` question(s) each, and never a prompt that an earlier concept already
 * asked. Used for the cached demo run so the built-in fallback obeys the
 * same rules as a live run (the capture predates them).
 */
export function normalizeQuizComponents<T extends ConceptLike>(
  concepts: readonly T[],
  cap: number = MAX_QUIZ_PER_CONCEPT,
): T[] {
  const seen: string[] = [];
  return concepts.map((concept) => {
    let touched = false;
    const components = concept.components.flatMap((comp) => {
      if (comp.type !== "quiz") return [comp];
      const all = comp.questions ?? [];
      const questions = dedupeQuizItems(all, seen, cap);
      seen.push(...questions.map((q) => q.prompt));
      if (questions.length === all.length) return [comp]; // untouched
      touched = true;
      return questions.length > 0 ? [{ ...comp, questions }] : [];
    });
    return touched ? ({ ...concept, components } as T) : concept;
  });
}
