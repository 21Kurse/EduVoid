"use client";

/**
 * Interactive study widgets (quiz, flashcards, sim placeholder) extracted
 * from concept-panel.tsx to keep files small.
 */
import { useState } from "react";
import type { Component } from "@/lib/spec";

export function Quiz({
  questions,
  conceptId,
  onAnswered,
}: {
  questions: Extract<Component, { type: "quiz" }>["questions"];
  conceptId: string;
  onAnswered: (conceptId: string, correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  return (
    <div className="flex flex-col gap-5" data-testid="quiz">
      {questions.map((q) => {
        const choice = picked[q.id];
        const answered = choice !== undefined;
        const correct = choice === q.answer;
        return (
          <div key={q.id} className="rounded-xl border border-border-subtle p-4">
            <p className="mb-3 text-[14px] font-medium text-zinc-900">{q.prompt}</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => {
                const isPicked = answered && choice === i;
                const isAnswer = answered && i === q.answer;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={answered}
                    onClick={() => {
                      setPicked((p) => ({ ...p, [q.id]: i }));
                      onAnswered(conceptId, i === q.answer);
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
                {correct ? "✓ Correct. " : "✗ Not quite. "}
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Flashcards({
  cards,
}: {
  cards: Extract<Component, { type: "flashcards" }>["cards"];
}) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-3" data-testid="flashcards">
      {cards.map((card, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
          className="rounded-xl border border-border-subtle px-4 py-3 text-left text-[13px] transition-colors hover:border-violet-300"
        >
          <span className="font-medium text-zinc-900">{card.front}</span>
          {flipped[i] && <span className="mt-2 block text-zinc-600">{card.back}</span>}
          {!flipped[i] && <span className="mt-1 block text-[11px] text-zinc-400">tap to reveal</span>}
        </button>
      ))}
    </div>
  );
}

export function SimPlaceholder({ prompt }: { prompt: string }) {
  return (
    <div
      className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4 text-[13px] text-zinc-600"
      data-testid="sim-placeholder"
    >
      <p className="mb-1 font-medium text-zinc-800">Simulation (T9)</p>
      <p>{prompt}</p>
      <p className="mt-2 text-[12px] text-zinc-500">
        Interactive sims arrive in T9 — predict-then-reveal, locked until you commit a prediction.
      </p>
    </div>
  );
}

export function UnknownComponent({ type }: { type: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
      Couldn&apos;t render this component (type: {type}) — skipped safely.
    </div>
  );
}
