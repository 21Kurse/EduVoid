"use client";

/**
 * Concept panel (§5): explainer with KaTeX, quizzes, flashcards, sim
 * placeholders. Live mode adds per-concept generating/failed states with
 * retry; the verify badge lights up in T7.
 */
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Component, CurriculumSpec } from "@/lib/spec";
import type { LearningState } from "@/lib/store";
import type { ConceptStatus } from "./concept-status";
import { Quiz, Flashcards, UnknownComponent } from "./widgets";
import { Sim } from "./sims";
import { HeroSim } from "./hero-sim";

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

/**
 * Explainer with KaTeX and clickable inline citation markers (G3 finding 2):
 * the post-processor emits `[n](#claim-<id>)` links; they render as
 * superscript buttons that scroll to + highlight the claim in the panel.
 */
function Explainer({ markdown, onCite }: { markdown: string; onCite?: (claimId: string) => void }) {
  return (
    <div className="prose-void max-w-none text-[15px] leading-relaxed text-zinc-700" data-testid="explainer">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("#claim-")) {
              const id = decodeURIComponent(href.slice("#claim-".length));
              return (
                <sup>
                  <button
                    type="button"
                    data-claim-marker={id}
                    onClick={() => onCite?.(id)}
                    className="ml-0.5 rounded bg-violet-50 px-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100"
                  >
                    {children}
                  </button>
                </sup>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
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
  hero = null,
  onAnswered,
  onDontGet,
  adaptation = null,
  claimsNode = null,
  onCite,
  onRetry,
}: {
  spec: CurriculumSpec;
  learning: LearningState;
  conceptStatus?: ConceptStatus;
  verify?: { supported: number; total: number; sources: number } | null;
  hero?: { conceptId: string; code: string; fallback: { template: string; values: Record<string, number | string | boolean>; predictPrompt: string } } | null;
  onAnswered: (conceptId: string, correct: boolean) => void;
  onDontGet?: (conceptId: string) => void;
  adaptation?: string | null;
  /** Mobile claims section, rendered inline below the explainer (G3 F1). */
  claimsNode?: ReactNode;
  onCite?: (claimId: string) => void;
  onRetry?: (concept: { id: string; title: string; summary: string }) => void;
}) {
  const concept = spec.concepts.find((c) => c.id === learning.selectedConceptId) ?? null;

  return (
    <div className="flex flex-col gap-4" data-testid="concept-panel">
      <div className="flex flex-col gap-4">
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

            {adaptation && (
              <div
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[13px] text-violet-800"
                data-testid="adaptation-banner"
              >
                ↻ {adaptation}
              </div>
            )}

            {onDontGet && concept.components.length > 0 && (
              <div>
                <button
                  type="button"
                  data-testid="dont-get"
                  onClick={() => onDontGet(concept.id)}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-[12px] text-zinc-600 transition-colors hover:border-violet-300 hover:bg-violet-50"
                >
                  I don&apos;t get this
                </button>
              </div>
            )}

            {verify && verify.total > 0 && (
              <div>
                <VerifyBadge supported={verify.supported} total={verify.total} sources={verify.sources} />
              </div>
            )}

            {hero && hero.conceptId === concept.id && <HeroSim code={hero.code} fallback={hero.fallback} />}

            {concept.components.length === 0 && !conceptStatus[concept.id]?.ok && (
              <div className="rounded-xl border border-border-subtle bg-zinc-50 p-4 text-[13px] text-zinc-500" data-testid="concept-generating">
                {conceptStatus[concept.id] && !conceptStatus[concept.id].ok && !conceptStatus[concept.id].loading ? (
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
                  // G3 F1: on mobile the claims section sits right below
                  // the explainer; on desktop the sticky aside is used.
                  return [
                    <Explainer key={i} markdown={comp.markdown} onCite={onCite} />,
                    ...(claimsNode ? [<div key={`${i}-claims`} className="lg:hidden">{claimsNode}</div>] : []),
                  ];
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
