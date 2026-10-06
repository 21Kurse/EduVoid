"use client";

/**
 * Live lesson view (T6): consumes the /api/generate stream. The mindmap
 * skeleton renders as soon as the plan arrives; concepts fill in as their
 * generations complete; the activity panel tracks every stage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runLiveGeneration, retryConcept } from "@/lib/live-client";
import type { PipelineEvent } from "@/lib/pipeline-events";
import { curriculumSpecSchema, type Concept, type CurriculumSpec } from "@/lib/spec";
import type { SourceResult } from "@/lib/source";
import { mergeConcept } from "@/lib/merge-concept";
import { useLearningState } from "@/lib/store";
import { useAdaptive } from "@/lib/use-adaptive";
import { LessonMap } from "./lesson-map";
import { ConceptPanel } from "./concept-panel";
import { ClaimsPanel } from "./claims-panel";
import { buildActivityFeed, type ActivityFeed } from "./activity-panel";
import type { ConceptStatus } from "./concept-status";
import type { HeroFallback } from "./hero-sim";

export function LiveLesson({ topic, onFail }: { topic: string; onFail: (detail: string) => void }) {
  const [spec, setSpec] = useState<CurriculumSpec | null>(null);
  const [stage, setStage] = useState("connecting");
  const [messages, setMessages] = useState<string[]>([]);
  const [sources, setSources] = useState<ActivityFeed["sources"]>([]);
  const [claims, setClaims] = useState<SourceResult["claims"]>([]);
  const [passages, setPassages] = useState<{ id: string; text: string; url: string; sourceId: string }[]>([]);
  const [contradictions, setContradictions] = useState<SourceResult["contradictions"]>([]);
  const [conceptStatus, setConceptStatus] = useState<ConceptStatus>({});
  const [claimsRejected, setClaimsRejected] = useState(0);
  const [verify, setVerify] = useState<{ supported: number; total: number; sources: number } | null>(null);
  const [hero, setHero] = useState<{ conceptId: string; code: string; fallback: HeroFallback } | null>(null);
  const [done, setDone] = useState(false);
  const [highlightClaim, setHighlightClaim] = useState<string | null>(null);
  const { state, selectConcept } = useLearningState();
  const specRef = useRef<CurriculumSpec | null>(null);

  /** Patch one concept in the spec (components and/or claims), by id.
   * mergeConcept changes only the named concept and never leaks an unknown
   * id into the spec (G3 finding 3). */
  const patchConcept = useCallback(
    (conceptId: string, patch: { components?: Concept["components"]; claims?: Concept["claims"] }) => {
      if (!specRef.current) return;
      const next = mergeConcept(specRef.current, conceptId, patch);
      if (!next) return;
      specRef.current = next;
      setSpec(next);
    },
    [],
  );

  const push = useCallback((m: string) => {
    setMessages((ms) => [...ms.slice(-30), m]);
  }, []);

  const onEvent = useCallback(
    (e: PipelineEvent) => {
      switch (e.type) {
        case "status":
          setStage(e.stage);
          push(e.message);
          break;
        case "sources":
          setSources(e.sources);
          push(`Found ${e.sources.length} sources`);
          break;
        case "skeleton": {
          const parsed = curriculumSpecSchema.safeParse({
            topic,
            level: e.level,
            concepts: e.concepts.map((c) => ({ ...c, claims: [], components: [] })),
            edges: e.edges,
            sources: [],
          });
          if (parsed.success) {
            specRef.current = parsed.data;
            setSpec(parsed.data);
            setStage("generate");
            push(`Planned ${e.concepts.length} concepts`);
            const first = e.concepts[0]?.id;
            if (first) selectConcept(first);
          } else {
            // §12: no silent failure paths — surface and stop.
            const issue = parsed.error.issues[0];
            const detail = `skeleton failed validation: ${issue?.path.join(".")} ${issue?.message}`;
            console.error(detail, parsed.error.issues);
            onFail(detail);
          }
          break;
        }
        case "concept": {
          setConceptStatus((s) => ({ ...s, [e.conceptId]: { ok: e.ok, detail: e.detail } }));
          if (e.ok && e.components) {
            patchConcept(e.conceptId, { components: e.components, claims: e.claims });
            push(`Generated “${e.conceptId}” (${Math.round(e.latencyMs / 100) / 10}s)`);
          } else if (!e.ok) {
            push(`FAILED “${e.conceptId}”: ${e.detail ?? "unknown"}`);
          }
          break;
        }
        case "claims":
          setClaims(e.claims);
          setPassages(e.passages);
          setContradictions(e.contradictions);
          setClaimsRejected(e.claims.filter((c) => c.status === "flagged").length);
          push(`Extracted ${e.claims.length} claims, ${e.contradictions.length} contradictions`);
          break;
        case "verified":
          setVerify({ supported: e.supported, total: e.total, sources: e.sources });
          setClaimsRejected(e.flagged);
          // Patch claim statuses with the verifier's final verdicts (T8).
          if (e.verdicts.length > 0) {
            const byId = new Map(e.verdicts.map((v) => [v.id, v]));
            setClaims((cs) =>
              cs.map((c) => {
                const v = byId.get(c.id);
                return v ? { ...c, status: v.status, flagReason: v.flagReason ?? c.flagReason } : c;
              }),
            );
          }
          push(
            e.flagged > 0
              ? `Verifier: ${e.supported}/${e.total} claims supported, ${e.flagged} flagged`
              : `Verifier: ${e.supported}/${e.total} claims supported`,
          );
          break;
        case "hero":
          if (e.ok && e.code && e.fallback) {
            setHero({ conceptId: e.conceptId, code: e.code, fallback: e.fallback });
            push(`Generated demo for “${e.conceptId}”`);
          } else {
            push(`Generated demo failed (${e.detail ?? "unknown"}) — template fallback available`);
          }
          break;
        case "error":
          push(`ERROR: ${e.detail}`);
          onFail(e.detail);
          break;
        case "done":
          setDone(true);
          setStage("done");
          break;
      }
    },
    [topic, push, selectConcept, onFail, patchConcept],
  );

  // Kick off generation exactly once per mounted lesson (run-once effect;
  // topic and onEvent are stable for the lifetime of this component).
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runLiveGeneration(topic, onEvent).catch((e: unknown) => {
      onFail(e instanceof Error ? e.message : String(e));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRetry = useCallback(
    (concept: { id: string; title: string; summary: string }) => {
      push(`Retrying “${concept.id}”…`);
      void retryConcept(topic, concept).then((r) => {
        setConceptStatus((s) => ({ ...s, [concept.id]: { ok: r.ok, detail: r.detail } }));
        if (r.ok && r.components) {
          patchConcept(concept.id, { components: r.components, claims: r.claims });
          push(`Retry succeeded for “${concept.id}”`);
        }
      });
    },
    [topic, push, patchConcept],
  );

  // T11 adaptive loop (§6): mastery events → store, failed concepts
  // regenerate in the next modality with a visible one-line reason.
  const getConcept = useCallback(
    (id: string) => specRef.current?.concepts.find((c) => c.id === id),
    [],
  );
  const onRegenerated = useCallback(
    (conceptId: string, components: Concept["components"], claims?: Concept["claims"]) => {
      patchConcept(conceptId, { components, claims });
    },
    [patchConcept],
  );
  const { onAnswered, onDontGet, adaptations } = useAdaptive({ topic, getConcept, onRegenerated, push });

  const feed: ActivityFeed = useMemo(
    () =>
      buildActivityFeed(stage, messages, sources, claims.length, claimsRejected, conceptStatus, spec?.concepts.length ?? 0),
    [stage, messages, sources, claims, claimsRejected, conceptStatus, spec],
  );

  const selectedConcept = spec?.concepts.find((c) => c.id === state.selectedConceptId) ?? null;
  const claimsFor = (variant: "panel" | "inline") =>
    spec && selectedConcept ? (
      <ClaimsPanel
        claims={selectedConcept.claims}
        allClaims={claims}
        contradictions={contradictions}
        passages={passages}
        sources={sources}
        highlightClaim={highlightClaim}
        variant={variant}
      />
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-[12px]">
        <span className="font-medium text-zinc-700">{topic}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700" data-testid="live-badge">
          live generation{done ? " · done" : " · running"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <LessonMap spec={spec} stage={stage} learning={state} onSelect={selectConcept} feed={feed} />
        <div className="min-h-0 flex-1 overflow-y-auto lg:max-w-[52%] lg:border-l lg:border-border-subtle lg:bg-white">
          <div className="flex flex-col gap-3 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-4 lg:p-6">
            {spec && (
              <ConceptPanel
                spec={spec}
                learning={state}
                conceptStatus={conceptStatus}
                verify={verify}
                hero={hero}
                onAnswered={onAnswered}
                onDontGet={onDontGet}
                adaptation={
                  state.selectedConceptId ? (adaptations[state.selectedConceptId] ?? null) : null
                }
                claimsNode={claimsFor("inline")}
                onCite={setHighlightClaim}
                onRetry={onRetry}
              />
            )}
            <aside className="hidden lg:block" data-testid="claims-aside">
              <div className="sticky top-0 max-h-[calc(100vh-5rem)] overflow-y-auto">
                {claimsFor("panel")}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
