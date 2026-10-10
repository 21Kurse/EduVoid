"use client";

/**
 * Explain-back (§5 item 4): the learner writes the concept in their own words
 * and the grader checks it against THIS concept's verified claims, naming the
 * idea that is missing. Every state is visible: idle → grading → result or an
 * honest error with the reason (§12 — no silent paths).
 */
import { useState } from "react";
import type { Claim } from "@/lib/spec";
import {
  EXPLAIN_BACK_MAX_CHARS,
  EXPLAIN_BACK_MIN_CHARS,
  EXPLAIN_BACK_MAX_CLAIMS,
  pickExplainTask,
  type ExplainBackSummary,
} from "@/lib/explain-back";

const VERDICT_LOOK: Record<string, { icon: string; text: string; row: string }> = {
  covered: { icon: "✓", text: "text-emerald-700", row: "bg-emerald-50/70" },
  partial: { icon: "~", text: "text-amber-700", row: "bg-amber-50/70" },
  missed: { icon: "✗", text: "text-zinc-500", row: "bg-zinc-50" },
};

const GRADE_TIMEOUT_MS = 60_000;

export function ExplainBack({
  topic,
  conceptId,
  conceptTitle,
  summary,
  claims,
  onGraded,
  conceptIndex = 0,
  lessonSeed = "",
}: {
  topic: string;
  conceptId: string;
  conceptTitle: string;
  summary: string;
  claims: Claim[];
  onGraded: (conceptId: string, coverage: { covered: number; partial: number; total: number }) => void;
  /** Position of this concept in the lesson: rotates the task so no two
   * concepts in one lesson ask for the same kind of explanation. */
  conceptIndex?: number;
  /** Lesson topic, so the rotation is stable within a lesson. */
  lessonSeed?: string;
}) {
  const supported = claims.filter((c) => c.status === "supported").slice(0, EXPLAIN_BACK_MAX_CLAIMS);
  // Owner request (Oct 10): every concept asks for a different KIND of
  // explanation (own words / teach a beginner / your own example / predict a
  // case / separate it from a look-alike / find a mistake / one sentence).
  // Deterministic per concept id, so the task is stable across reloads and
  // differs between concepts in the same lesson.
  const task = pickExplainTask(conceptId, conceptIndex, lessonSeed);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainBackSummary | null>(null);
  /** Grading time reported by the server (no client clock read: the query
   * has to stay pure, and the server measures the call it made anyway). */
  const [tookMs, setTookMs] = useState<number | null>(null);

  // Nothing to grade against (no verified claims on this concept): show nothing
  // rather than an empty promise.
  if (supported.length === 0) return null;

  const canSubmit = text.trim().length >= EXPLAIN_BACK_MIN_CHARS && !grading;

  const submit = async () => {
    setGrading(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GRADE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/explain-back", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          topic,
          conceptTitle,
          summary,
          explanation: text.trim(),
          taskId: task.id,
          claims: supported.map((c) => ({ id: c.id, text: c.text })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        summary?: ExplainBackSummary;
        latencyMs?: number;
        detail?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.summary) {
        setError(
          body.error ??
            `Couldn't grade that${body.detail ? ` (${body.detail})` : ""} — your words are still here, try again.`,
        );
        return;
      }
      setResult(body.summary);
      setTookMs(typeof body.latencyMs === "number" ? body.latencyMs : null);
      onGraded(conceptId, {
        covered: body.summary.covered,
        partial: body.summary.partial,
        total: body.summary.total,
      });
    } catch (e) {
      setError(
        controller.signal.aborted
          ? `Grading didn't come back within ${GRADE_TIMEOUT_MS / 1000}s — try again.`
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      clearTimeout(timer);
      setGrading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-4" data-testid="explain-back">
      <button
        type="button"
        data-testid="explain-open"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-[14px] font-medium text-zinc-900">Explain it back</span>
        <span className="text-[11px] text-zinc-400" data-testid="explain-task">
          {task.label} · checked against {supported.length} verified claim
          {supported.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-zinc-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="mb-2 text-[12px] text-zinc-500" data-testid="explain-helper">
            {task.helper} The grader tells you which verified ideas came through and which one
            didn&apos;t.
          </p>
          <textarea
            data-testid="explain-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, EXPLAIN_BACK_MAX_CHARS))}
            rows={4}
            placeholder={task.placeholder(conceptTitle)}
            aria-label={`Your explanation of ${conceptTitle}`}
            className="w-full resize-y rounded-lg border border-border-subtle px-3 py-2 text-[13px] leading-relaxed text-zinc-800 outline-none focus:border-violet-400"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="explain-submit"
              disabled={!canSubmit}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              {grading && (
                <span
                  className="h-3 w-3 animate-spin rounded-full border-2 border-violet-200 border-t-white"
                  data-testid="explain-spinner"
                />
              )}
              {grading ? "Checking your explanation…" : "Check my explanation"}
            </button>
            <span className="text-[11px] text-zinc-400">
              {text.trim().length < EXPLAIN_BACK_MIN_CHARS
                ? `At least ${EXPLAIN_BACK_MIN_CHARS} characters.`
                : `${text.trim().length} / ${EXPLAIN_BACK_MAX_CHARS}`}
            </span>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700" data-testid="explain-error">
              {error}
            </p>
          )}

          {result && (
            <div className="mt-3" data-testid="explain-result" aria-live="polite">
              <p className="text-[13px] text-zinc-800">
                <strong>{result.covered}</strong>
                {result.partial > 0 && <> fully, <strong>{result.partial}</strong> partly</>} of{" "}
                <strong>{result.total}</strong> verified claim{result.total === 1 ? "" : "s"} came through
                {tookMs !== null && <span className="text-zinc-400"> · graded in {Math.round(tookMs / 100) / 10}s</span>}
                .
              </p>
              <ul className="mt-2 space-y-1">
                {result.rows.map((row) => {
                  const look = VERDICT_LOOK[row.verdict] ?? VERDICT_LOOK.missed;
                  return (
                    <li
                      key={row.claimId}
                      data-verdict={row.verdict}
                      className={`flex gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${look.row}`}
                    >
                      <span className={`font-medium ${look.text}`}>{look.icon}</span>
                      <span className="text-zinc-700">
                        {row.text}
                        {row.note && <span className="text-zinc-500"> — {row.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[12px] text-zinc-700" data-testid="explain-gap">
                <span className="font-medium text-zinc-900">Gap:</span> {result.gap}
              </p>
              {result.nudge && (
                <p className="mt-1 text-[12px] text-zinc-600" data-testid="explain-nudge">
                  <span className="font-medium text-zinc-800">Try answering:</span> {result.nudge}
                </p>
              )}
              <button
                type="button"
                data-testid="explain-again"
                onClick={() => setResult(null)}
                className="mt-2 text-[11px] text-violet-700 hover:underline"
              >
                Revise and check again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
