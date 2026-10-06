"use client";

/**
 * Lazy concept loader (G3 finding 4): requests the concept the user opens,
 * plus at most the next concept in prerequisite order as a background
 * prefetch (scheduler caps in-flight at 2). Switching concepts aborts
 * in-flight requests via AbortController; finished concepts are cached in
 * the spec so revisiting is instant; failures set a visible per-concept
 * state with retry (§12).
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { createConceptScheduler, type ConceptScheduler } from "./concept-scheduler";
import { retryConcept } from "./live-client";
import type { Concept, CurriculumSpec } from "./spec";
import type { ConceptStatus } from "../components/concept-status";

type Status = Dispatch<SetStateAction<ConceptStatus>>;

export function useConceptLoader({
  topic,
  getSpec,
  patchConcept,
  push,
  setConceptStatus,
}: {
  topic: string;
  getSpec: () => CurriculumSpec | null;
  patchConcept: (
    conceptId: string,
    patch: { components?: Concept["components"]; claims?: Concept["claims"] },
  ) => void;
  push: (m: string) => void;
  setConceptStatus: Status;
}) {
  const schedulerRef = useRef<ConceptScheduler | null>(null);

  // Unmount: abort every in-flight generation request.
  useEffect(() => () => schedulerRef.current?.dispose(), []);

  const request = useCallback(
    async (id: string, signal: AbortSignal): Promise<boolean> => {
      const concept = getSpec()?.concepts.find((c) => c.id === id);
      if (!concept) return false;
      setConceptStatus((s) => ({ ...s, [id]: { ok: false, loading: true } }));
      push(`Generating “${id}”…`);
      try {
        const r = await retryConcept(
          topic,
          { id: concept.id, title: concept.title, summary: concept.summary },
          undefined,
          signal,
        );
        if (r.ok && r.components) {
          patchConcept(id, { components: r.components, claims: r.claims });
          setConceptStatus((s) => ({ ...s, [id]: { ok: true } }));
          push(`Generated “${id}”`);
          return true;
        }
        setConceptStatus((s) => ({ ...s, [id]: { ok: false, detail: r.detail ?? "unknown" } }));
        push(`FAILED “${id}”: ${r.detail ?? "unknown"}`);
        return false;
      } catch (e) {
        if (signal.aborted) {
          // Switched away: clear the loading marker; not a failure (§12).
          setConceptStatus((s) => {
            const next = { ...s };
            delete next[id];
            return next;
          });
          return false;
        }
        const detail = e instanceof Error ? e.message : String(e);
        setConceptStatus((s) => ({ ...s, [id]: { ok: false, detail } }));
        push(`FAILED “${id}”: ${detail}`);
        return false;
      }
    },
    [topic, getSpec, patchConcept, push, setConceptStatus],
  );

  /** Create the scheduler for a freshly planned run (skeleton event). */
  const buildScheduler = useCallback(
    (order: string[]) => {
      schedulerRef.current?.dispose();
      schedulerRef.current = createConceptScheduler({
        order,
        hasConcept: (id) =>
          Boolean(getSpec()?.concepts.find((c) => c.id === id && c.components.length > 0)),
        request,
      });
    },
    [getSpec, request],
  );

  const openConcept = useCallback((id: string | null) => {
    if (id) schedulerRef.current?.open(id);
  }, []);

  return { buildScheduler, openConcept };
}
