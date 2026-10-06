"use client";

/**
 * T11 adaptive loop glue (§6, §13.7, §13.12): deterministic mastery events
 * into the persisted store, regeneration in the next modality of the cycle,
 * and the visible one-line reason. All rules live in lib/mastery.ts; this
 * hook only wires them to the UI.
 */
import { useCallback, useRef, useState } from "react";
import { retryConcept } from "./live-client";
import {
  adaptReason,
  applyMasteryEvent,
  nextModality,
  type MasteryEvent,
  type Modality,
} from "./mastery";
import type { Concept } from "./spec";
import { readLearningState, updateLearningState } from "./store";

type ConceptLite = { id: string; title: string; summary: string };

export function useAdaptive({
  topic,
  getConcept,
  onRegenerated,
  push,
}: {
  topic: string;
  getConcept: (id: string) => ConceptLite | undefined;
  onRegenerated: (
    conceptId: string,
    components: Concept["components"],
    claims?: Concept["claims"],
  ) => void;
  push: (m: string) => void;
}): {
  onAnswered: (conceptId: string, correct: boolean) => void;
  onDontGet: (conceptId: string) => void;
  adaptations: Record<string, string>;
} {
  const [adaptations, setAdaptations] = useState<Record<string, string>>({});
  const adaptingRef = useRef<Set<string>>(new Set());

  const record = useCallback((conceptId: string, event: MasteryEvent) => {
    updateLearningState((s) => ({
      ...s,
      concepts: { ...s.concepts, [conceptId]: applyMasteryEvent(s.concepts[conceptId], event) },
    }));
  }, []);

  const regenerate = useCallback(
    (concept: ConceptLite, missed: boolean) => {
      if (adaptingRef.current.has(concept.id)) return;
      adaptingRef.current.add(concept.id);
      const history = readLearningState().concepts[concept.id]?.modalityHistory ?? [];
      const modality: Modality = nextModality(history);
      record(concept.id, { type: "regenerated", modality });
      const reason = adaptReason(modality, missed);
      setAdaptations((a) => ({ ...a, [concept.id]: reason }));
      push(`Adapting “${concept.id}” → ${modality}`);
      void retryConcept(topic, concept, modality).then((r) => {
        adaptingRef.current.delete(concept.id);
        if (r.ok && r.components) {
          onRegenerated(concept.id, r.components, r.claims);
          push(`Adapted “${concept.id}” as ${modality}`);
        } else {
          // §12 + G3 F3: visible, HONEST failure — replace the promise with
          // what actually happened and keep the original content shown.
          const detail = (r.detail ?? "unknown").slice(0, 140);
          setAdaptations((a) => ({
            ...a,
            [concept.id]: `Regeneration as ${modality} failed (${detail}) — showing the original content.`,
          }));
          push(`Adaptation failed for “${concept.id}” (${detail})`);
        }
      });
    },
    [topic, record, onRegenerated, push],
  );

  const onAnswered = useCallback(
    (conceptId: string, correct: boolean) => {
      record(conceptId, { type: "quiz", correct });
      if (correct) return;
      // §6: a failed concept regenerates in a different modality — once per
      // concept, on the first miss (history still empty). Later misses only
      // keep dropping mastery; "I don't get this" stays available.
      const concept = getConcept(conceptId);
      if (!concept) return;
      const history = readLearningState().concepts[conceptId]?.modalityHistory ?? [];
      if (history.length === 0) regenerate(concept, true);
    },
    [record, getConcept, regenerate],
  );

  const onDontGet = useCallback(
    (conceptId: string) => {
      const concept = getConcept(conceptId);
      if (!concept) return;
      record(conceptId, { type: "dont-get" });
      regenerate(concept, false);
    },
    [record, getConcept, regenerate],
  );

  return { onAnswered, onDontGet, adaptations };
}
