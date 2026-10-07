"use client";

/**
 * One external eval question (T13): pick an option, no correctness
 * feedback until the part ends — deliberately unlike the in-app generated
 * quizzes, so eval answers measure knowledge, not UI coaching.
 */
import type { EvalQuestion } from "@/lib/eval";

export function EvalQuestionView({
  q,
  picked,
  onPick,
}: {
  q: EvalQuestion;
  picked: number | null;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="test-question" data-question-id={q.id}>
      <p className="text-[15px] font-medium text-zinc-900">{q.prompt}</p>
      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            data-testid="test-option"
            onClick={() => onPick(i)}
            className={`rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${
              picked === i
                ? "border-violet-500 bg-violet-50 text-zinc-900"
                : "border-border-subtle hover:border-violet-300 hover:bg-violet-50/50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
