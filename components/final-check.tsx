"use client";

/**
 * Final check (owner request, Oct 10: "for Bayes' theorem it also asks
 * questions in the end"). It closes the lesson: one model call writes a
 * harder, lesson-spanning set from the same verified claims the concepts were
 * built from, and every answer goes through the SAME mastery rules and
 * adaptive loop as an inline quiz — so a miss here recolours the mindmap and
 * regenerates that concept in a different modality.
 */
import { useCallback, useState } from "react";
import type { Concept } from "@/lib/spec";

export type FinalCheckQuestion = {
  conceptId: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

type Phase = "idle" | "loading" | "ready" | "error";

export function FinalCheck({
  topic,
  concepts,
  askedPrompts,
  onAnswered,
  onOpenConcept,
}: {
  topic: string;
  /** The lesson's concepts, in the order the lesson shows them. */
  concepts: Concept[];
  /** Every quiz prompt already on screen — the check must not repeat one. */
  askedPrompts: string[];
  onAnswered: (conceptId: string, correct: boolean) => void;
  onOpenConcept?: (conceptId: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [questions, setQuestions] = useState<FinalCheckQuestion[]>([]);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  // Grounded concepts only: a concept without claims cannot be tested
  // against a source, so it is left out of the prompt.
  const grounded = concepts
    .map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      claims: c.claims.filter((cl) => cl.status === "supported").map((cl) => ({ id: cl.id, text: cl.text })),
    }))
    .filter((c) => c.claims.length > 0);

  const titleOf = (id: string) => concepts.find((c) => c.id === id)?.title ?? id;

  const start = useCallback(
    async (avoid: string[]) => {
      setPhase("loading");
      setError(null);
      try {
        const res = await fetch("/api/final-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topic, concepts: grounded, avoidPrompts: avoid }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          questions?: FinalCheckQuestion[];
          detail?: string;
          error?: string;
        };
        if (!j.ok || !j.questions || j.questions.length === 0) {
          setError(j.detail ?? j.error ?? `HTTP ${res.status}`);
          setPhase("error");
          return;
        }
        setQuestions(j.questions);
        setPicks({});
        setPhase("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    // `grounded` is derived from props on every render; the callback only
    // needs identity stability per lesson, so it depends on topic alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic],
  );

  const answeredCount = Object.keys(picks).length;
  const correctCount = questions.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);
  const missed = questions.map((q, i) => ({ q, i })).filter(({ q, i }) => picks[i] !== undefined && picks[i] !== q.answer);
  // Distinct concepts only: two missed questions about the same concept name
  // it once (a live run listed the same concept five times).
  const missedTitles = [...new Set(missed.map(({ q }) => titleOf(q.conceptId)))];

  return (
    <section
      className="rounded-xl border border-violet-200 bg-violet-50/40 p-4"
      data-testid="final-check"
      data-phase={phase}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-zinc-900">Final check</h3>
        {phase === "ready" && (
          <span className="text-[11px] tabular-nums text-zinc-500" data-testid="final-check-progress">
            {answeredCount} / {questions.length} answered
          </span>
        )}
      </div>

      {phase === "idle" && (
        <>
          <p className="mt-1 text-[12px] text-zinc-600">
            You have met every concept one at a time. This set pulls the whole lesson together: {Math.min(5, Math.max(3, grounded.length))} harder
            questions, including one that applies the idea to a case the lesson never showed.
          </p>
          <button
            type="button"
            data-testid="final-check-start"
            disabled={grounded.length === 0}
            onClick={() => void start(askedPrompts)}
            className="mt-3 h-9 rounded-lg bg-violet-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
          >
            Ask me the questions
          </button>
          {grounded.length === 0 && (
            <p className="mt-2 text-[11px] text-zinc-500">Open a concept first — the check is written from their verified claims.</p>
          )}
        </>
      )}

      {phase === "loading" && (
        <p className="mt-2 inline-flex items-center gap-2 text-[12px] text-violet-800">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          Writing the closing questions from the verified claims…
        </p>
      )}

      {phase === "error" && (
        <>
          <p className="mt-2 text-[12px] text-amber-800" data-testid="final-check-error">
            Couldn&apos;t write the closing set ({error?.slice(0, 140)}) — the lesson is unchanged.
          </p>
          <button
            type="button"
            onClick={() => void start(askedPrompts)}
            className="mt-2 rounded-lg border border-violet-300 px-3 py-1.5 text-[12px] font-medium text-violet-700 hover:bg-violet-50"
          >
            Try again
          </button>
        </>
      )}

      {phase === "ready" && (
        <>
          <div className="mt-3 flex flex-col gap-4">
            {questions.map((q, i) => {
              const pick = picks[i];
              const answered = pick !== undefined;
              return (
                <div key={`${i}-${q.prompt}`} className="rounded-xl border border-border-subtle bg-white p-4" data-testid="final-check-question">
                  <p className="mb-3 text-[14px] font-medium text-zinc-900">
                    <span className="mr-1.5 text-zinc-400">{i + 1}.</span>
                    {q.prompt}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, oi) => {
                      const isPicked = answered && pick === oi;
                      const isAnswer = answered && oi === q.answer;
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={answered}
                          data-testid="final-check-option"
                          onClick={() => {
                            setPicks((p) => ({ ...p, [i]: oi }));
                            // Same mastery rules as an inline quiz: a first
                            // miss regenerates that concept a different way.
                            onAnswered(q.conceptId, oi === q.answer);
                          }}
                          className={`rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${
                            answered
                              ? isAnswer
                                ? "border-violet-400 bg-violet-50 text-zinc-900"
                                : isPicked
                                  ? "border-red-300 bg-red-50 text-zinc-700"
                                  : "border-border-subtle text-zinc-500"
                              : "border-border-subtle hover:border-violet-300 hover:bg-violet-50/50"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <p className="mt-3 text-[13px] text-zinc-600">
                      {pick === q.answer ? "✓ Correct. " : "✗ Not quite. "}
                      {q.explanation}
                      {onOpenConcept && (
                        <button
                          type="button"
                          onClick={() => onOpenConcept(q.conceptId)}
                          className="ml-1 text-violet-700 underline decoration-dotted hover:decoration-solid"
                        >
                          {titleOf(q.conceptId)}
                        </button>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {answeredCount === questions.length && (
            <div className="mt-4 rounded-xl border border-violet-200 bg-white p-4" data-testid="final-check-score">
              <p className="text-[14px] font-semibold text-zinc-900">
                {correctCount} of {questions.length} correct
              </p>
              <p className="mt-1 text-[12px] text-zinc-600">
                {missed.length === 0
                  ? "Every concept held up under a harder question — the whole map should be violet."
                  : `${missedTitles.join(", ")} ${missedTitles.length === 1 ? "is" : "are"} already being rebuilt a different way — watch the mindmap colour change.`}
              </p>
              <button
                type="button"
                onClick={() => void start([...askedPrompts, ...questions.map((q) => q.prompt)])}
                className="mt-2 rounded-lg border border-violet-300 px-3 py-1.5 text-[12px] font-medium text-violet-700 hover:bg-violet-50"
              >
                Run it again with new questions
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
