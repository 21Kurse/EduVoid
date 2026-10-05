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
import { useLearningState } from "@/lib/store";
import { Mindmap } from "./mindmap";
import { ConceptPanel } from "./concept-panel";
import { ActivityPanel, type ActivityFeed } from "./activity-panel";
import { ClaimsList } from "./claims-list";
import type { HeroFallback } from "./hero-sim";

type ConceptStatus = Record<string, { ok: boolean; detail?: string }>;

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
  const { state, selectConcept } = useLearningState();
  const specRef = useRef<CurriculumSpec | null>(null);

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
          if (e.ok && e.components && specRef.current) {
            const concepts: Concept[] = specRef.current.concepts.map((c) =>
              c.id === e.conceptId ? { ...c, components: e.components ?? [] } : c,
            );
            specRef.current = { ...specRef.current, concepts };
            setSpec(specRef.current);
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
    [topic, push, selectConcept, onFail],
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
        if (r.ok && r.components && specRef.current) {
          const concepts = specRef.current.concepts.map((c) =>
            c.id === concept.id ? { ...c, components: r.components ?? [] } : c,
          );
          specRef.current = { ...specRef.current, concepts };
          setSpec(specRef.current);
          push(`Retry succeeded for “${concept.id}”`);
        }
      });
    },
    [topic, push],
  );

  const feed: ActivityFeed = useMemo(
    () => ({
      stage,
      messages,
      sources,
      claimsExtracted: claims.length,
      claimsRejected,
      conceptsDone: Object.values(conceptStatus).filter((s) => s.ok).length,
      conceptsTotal: spec?.concepts.length ?? 0,
    }),
    [stage, messages, sources, claims, claimsRejected, conceptStatus, spec],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-[12px]">
        <span className="font-medium text-zinc-700">{topic}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700" data-testid="live-badge">
          live generation{done ? " · done" : " · running"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[46vh] border-b border-border-subtle lg:h-auto lg:flex-1 lg:border-b-0">
          {spec ? (
            <Mindmap spec={spec} learning={state} onSelect={selectConcept} />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-zinc-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-500" />
                {stage}…
              </span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 right-3 lg:right-auto">
            <ActivityPanel feed={feed} />
          </div>
        </div>
        <div className="min-h-0 flex-1 lg:max-w-[46%]">
          <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
            {spec && (
              <ConceptPanel
                spec={spec}
                learning={state}
                conceptStatus={conceptStatus}
                verify={verify}
                hero={hero}
                onAnswered={() => undefined}
                onRetry={onRetry}
              />
            )}
            <ClaimsList claims={claims} contradictions={contradictions} passages={passages} sources={sources} />
          </div>
        </div>
      </div>
    </div>
  );
}
