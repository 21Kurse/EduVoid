"use client";

/**
 * Concept panel (§5): explainer with KaTeX, quizzes, flashcards, and
 * (in T9) predict-then-reveal sims. Cited-claim UI lands in T8 — for now
 * claims render as labeled chips.
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Claim, Component, CurriculumSpec } from "@/lib/spec";
import type { LearningState } from "@/lib/store";

function FixtureBanner() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800"
      data-testid="fixture-banner"
    >
      <strong>Fixture mode</strong> — content is a hand-written placeholder
      run (labeled passages), not live generation.
    </div>
  );
}

function ClaimChips({ claims }: { claims: Claim[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {claims.map((c) => (
        <span
          key={c.id}
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            c.status === "flagged"
              ? "bg-red-50 text-red-700"
              : "bg-violet-50 text-violet-700"
          }`}
        >
          {c.status === "flagged" ? "⚠ flagged" : "✓"} claim ·{" "}
          {c.passageIds.length} passage{c.passageIds.length === 1 ? "" : "s"}
          {c.status === "flagged" && c.flagReason ? ` · ${c.flagReason}` : ""}
        </span>
      ))}
    </div>
  );
}

function Explainer({ markdown }: { markdown: string }) {
  return (
    <div
      className="prose-void max-w-none text-[15px] leading-relaxed text-zinc-700"
      data-testid="explainer"
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function Quiz({
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
            <p className="mb-3 text-[14px] font-medium text-zinc-900">
              {q.prompt}
            </p>
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

function Flashcards({
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
          {flipped[i] && (
            <span className="mt-2 block text-zinc-600">{card.back}</span>
          )}
          {!flipped[i] && (
            <span className="mt-1 block text-[11px] text-zinc-400">
              tap to reveal
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function SimPlaceholder({ prompt }: { prompt: string }) {
  return (
    <div
      className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4 text-[13px] text-zinc-600"
      data-testid="sim-placeholder"
    >
      <p className="mb-1 font-medium text-zinc-800">Simulation (T9)</p>
      <p>{prompt}</p>
      <p className="mt-2 text-[12px] text-zinc-500">
        Interactive sims arrive in T9 — predict-then-reveal, locked until you
        commit a prediction.
      </p>
    </div>
  );
}

function UnknownComponent({ type }: { type: string }) {
  // Visible, non-crashing failure path for any future unknown type (§12).
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
      Couldn&apos;t render this component (type: {type}) — skipped safely.
    </div>
  );
}

export function ConceptPanel({
  spec,
  learning,
  onAnswered,
}: {
  spec: CurriculumSpec;
  learning: LearningState;
  onAnswered: (conceptId: string, correct: boolean) => void;
}) {
  const concept =
    spec.concepts.find((c) => c.id === learning.selectedConceptId) ?? null;

  return (
    <div
      className="flex h-full flex-col overflow-y-auto border-l border-border-subtle bg-white"
      data-testid="concept-panel"
    >
      <div className="flex flex-col gap-4 p-6">
        <FixtureBanner />
        {!concept ? (
          <div className="flex flex-1 items-center justify-center py-24 text-center text-[14px] text-zinc-400">
            Select a concept on the map to start.
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                {concept.title}
              </h2>
              <p className="mt-1 text-[14px] text-zinc-500">
                {concept.summary}
              </p>
            </div>

            <ClaimChips claims={concept.claims} />

            {concept.components.map((comp, i) => {
              switch (comp.type) {
                case "explainer":
                  return <Explainer key={i} markdown={comp.markdown} />;
                case "quiz":
                  return (
                    <Quiz
                      key={i}
                      questions={comp.questions}
                      conceptId={concept.id}
                      onAnswered={onAnswered}
                    />
                  );
                case "flashcards":
                  return <Flashcards key={i} cards={comp.cards} />;
                case "sim":
                  return <SimPlaceholder key={i} prompt={comp.predictPrompt} />;
                default:
                  return (
                    <UnknownComponent
                      key={i}
                      type={(comp as { type?: string }).type ?? "unknown"}
                    />
                  );
              }
            })}
          </>
        )}
      </div>
    </div>
  );
}
