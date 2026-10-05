"use client";

/**
 * Concept panel (§5): explainer with KaTeX, quizzes, flashcards, sim
 * placeholders. Live mode adds per-concept generating/failed states with
 * retry; the verify badge lights up in T7.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Claim, Component, CurriculumSpec } from "@/lib/spec";
import type { LearningState } from "@/lib/store";
import { Quiz, Flashcards, UnknownComponent } from "./widgets";
import { Sim } from "./sims";

export function VerifyBadge({
  supported,
  total,
  sources,
}: {
  supported: number;
  total: number;
  sources: number;
}) {
  return (
    <span
      className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
      data-testid="verify-badge"
      title="Claims verified against source passages by the pipeline verifier"
    >
      ✓ verified against {sources} source{sources === 1 ? "" : "s"} · {supported}/{total} claims supported
    </span>
  );
}

/** Stable numeric seed from a concept id so sim runs are reproducible. */
function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ClaimChips({ claims }: { claims: Claim[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {claims.map((c) => (
        <span
          key={c.id}
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            c.status === "flagged" ? "bg-red-50 text-red-700" : "bg-violet-50 text-violet-700"
          }`}
        >
          {c.status === "flagged" ? "⚠ flagged" : "✓"} claim · {c.passageIds.length} passage
          {c.passageIds.length === 1 ? "" : "s"}
          {c.status === "flagged" && c.flagReason ? ` · ${c.flagReason}` : ""}
        </span>
      ))}
    </div>
  );
}

function Explainer({ markdown }: { markdown: string }) {
  return (
    <div className="prose-void max-w-none text-[15px] leading-relaxed text-zinc-700" data-testid="explainer">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function ConceptPanel({
  spec,
  learning,
  conceptStatus = {},
  verify = null,
  onAnswered,
  onRetry,
}: {
  spec: CurriculumSpec;
  learning: LearningState;
  conceptStatus?: Record<string, { ok: boolean; detail?: string }>;
  verify?: { supported: number; total: number; sources: number } | null;
  onAnswered: (conceptId: string, correct: boolean) => void;
  onRetry?: (concept: { id: string; title: string; summary: string }) => void;
}) {
  const concept = spec.concepts.find((c) => c.id === learning.selectedConceptId) ?? null;

  return (
    <div
      className="flex h-full flex-col overflow-y-auto border-l border-border-subtle bg-white"
      data-testid="concept-panel"
    >
      <div className="flex flex-col gap-4 p-6">
        {!concept ? (
          <div className="flex flex-1 items-center justify-center py-24 text-center text-[14px] text-zinc-400">
            Select a concept on the map to start.
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{concept.title}</h2>
              <p className="mt-1 text-[14px] text-zinc-500">{concept.summary}</p>
            </div>

            {verify && verify.total > 0 && (
              <div>
                <VerifyBadge supported={verify.supported} total={verify.total} sources={verify.sources} />
              </div>
            )}

            <ClaimChips claims={concept.claims} />

            {concept.components.length === 0 && !conceptStatus[concept.id]?.ok && (
              <div className="rounded-xl border border-border-subtle bg-zinc-50 p-4 text-[13px] text-zinc-500" data-testid="concept-generating">
                {conceptStatus[concept.id] && !conceptStatus[concept.id].ok ? (
                  <>
                    <p className="mb-2 text-red-700">
                      Couldn&apos;t generate this concept{conceptStatus[concept.id].detail ? ` (${conceptStatus[concept.id].detail})` : ""}.
                    </p>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={() => onRetry(concept)}
                        className="rounded-lg border border-violet-300 px-3 py-1.5 text-[12px] font-medium text-violet-700 hover:bg-violet-50"
                      >
                        Retry generation
                      </button>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-500" />
                    Generating this concept…
                  </span>
                )}
              </div>
            )}

            {concept.components.map((comp: Component, i: number) => {
              switch (comp.type) {
                case "explainer":
                  return <Explainer key={i} markdown={comp.markdown} />;
                case "quiz":
                  return <Quiz key={i} questions={comp.questions} conceptId={concept.id} onAnswered={onAnswered} />;
                case "flashcards":
                  return <Flashcards key={i} cards={comp.cards} />;
                case "sim":
                  return <Sim key={i} component={comp} seed={seedFrom(concept.id)} />;
                default:
                  return <UnknownComponent key={i} type={(comp as { type?: string }).type ?? "unknown"} />;
              }
            })}
          </>
        )}
      </div>
    </div>
  );
}
