"use client";

/**
 * T11 adaptive loop glue (§6, §13.7, §13.12): deterministic mastery events
 * into the persisted store, regeneration in the next modality of the cycle,
 * and the visible one-line reason. All rules live in lib/mastery.ts; this
 * hook only wires them to the UI.
 *
 * Owner feedback (Oct 8): clicking "I don't get this" used to print a promise
 * ("here it is as a simulation") and then nothing visibly changed — when the
 * provider answered 502, the only trace was a failure sentence. Now:
 *  1. a spinner state is exposed while the regeneration is in flight,
 *  2. the one-line reason is shown only once the new presentation is on
 *     screen (never as a promise),
 *  3. on failure or timeout a deterministic template sim is built locally
 *     (§13.6 hand-built templates, no model call), so the click always
 *     delivers a visibly different modality,
 *  4. if not even a template fits, the honest failure message says so.
 */
import { useCallback, useRef, useState } from "react";
import { retryConcept } from "./live-client";
import { LOCAL_FALLBACK_REASON, localSimAdaptation } from "./local-adapt";
import {
  adaptReason,
  applyMasteryEvent,
  deliveredModality,
  nextModality,
  type MasteryEvent,
  type Modality,
} from "./mastery";
import type { Concept } from "./spec";
import { readLearningState, updateLearningState } from "./store";

/** Give up on a hanging regeneration; the local template takes over. */
const ADAPT_TIMEOUT_MS = 30_000;

export function useAdaptive({
  topic,
  getConcept,
  onRegenerated,
  push,
  avoidPromptsFor,
}: {
  topic: string;
  getConcept: (id: string) => Concept | undefined;
  onRegenerated: (
    conceptId: string,
    components: Concept["components"],
    claims?: Concept["claims"],
  ) => void;
  push: (m: string) => void;
  /** Quiz prompts to avoid for the concept being regenerated. */
  avoidPromptsFor?: (conceptId: string) => string[];
}): {
  onAnswered: (conceptId: string, correct: boolean) => void;
  onDontGet: (conceptId: string) => void;
  adaptations: Record<string, string>;
  adapting: Record<string, boolean>;
} {
  const [adaptations, setAdaptations] = useState<Record<string, string>>({});
  const [adapting, setAdapting] = useState<Record<string, boolean>>({});
  const adaptingRef = useRef<Set<string>>(new Set());

  const record = useCallback((conceptId: string, event: MasteryEvent) => {
    updateLearningState((s) => ({
      ...s,
      concepts: { ...s.concepts, [conceptId]: applyMasteryEvent(s.concepts[conceptId], event) },
    }));
  }, []);

  const explain = useCallback((conceptId: string, message: string) => {
    setAdaptations((a) => ({ ...a, [conceptId]: message }));
  }, []);

  const regenerate = useCallback(
    (concept: Concept, missed: boolean) => {
      if (adaptingRef.current.has(concept.id)) return;
      adaptingRef.current.add(concept.id);
      setAdapting((a) => ({ ...a, [concept.id]: true }));
      // Drop the previous explanation: it described content we are replacing.
      setAdaptations((a) => {
        if (!(concept.id in a)) return a;
        const next = { ...a };
        delete next[concept.id];
        return next;
      });

      const history = readLearningState().concepts[concept.id]?.modalityHistory ?? [];
      const modality: Modality = nextModality(history);
      // What was on screen before the call, so the reason line can name what
      // the learner actually sees afterwards (see deliveredModality).
      const before = concept.components;
      push(`Adapting “${concept.id}” → ${modality}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ADAPT_TIMEOUT_MS);

      /** No model available: build the modality from the hand-built templates. */
      const fallback = (detail: string) => {
        const local = localSimAdaptation(concept, topic);
        if (local) {
          onRegenerated(concept.id, local, concept.claims);
          record(concept.id, { type: "regenerated", modality: "sim" });
          explain(concept.id, LOCAL_FALLBACK_REASON);
          push(`Built a template simulation for “${concept.id}” locally (${detail})`);
          return;
        }
        // §12 + G3 F3: visible, HONEST failure — say what happened and keep
        // the original content shown.
        explain(
          concept.id,
          `Couldn't regenerate this one (${detail.slice(0, 140)}) — showing the original content.`,
        );
        push(`Adaptation failed for “${concept.id}” (${detail})`);
      };

      void (async () => {
        try {
          const r = await retryConcept(
            topic,
            { id: concept.id, title: concept.title, summary: concept.summary },
            modality,
            controller.signal,
            avoidPromptsFor?.(concept.id) ?? [],
          );
          if (r.ok && r.components) {
            onRegenerated(concept.id, r.components, r.claims);
            record(concept.id, { type: "regenerated", modality });
            const delivered = deliveredModality(before, r.components, modality);
            explain(concept.id, adaptReason(delivered, missed));
            push(
              delivered === modality
                ? `Adapted “${concept.id}” as ${modality}`
                : `Adapted “${concept.id}” → asked for ${modality}, delivered ${delivered}`,
            );
            return;
          }
          fallback(r.detail ?? "unknown");
        } catch (e) {
          fallback(
            controller.signal.aborted
              ? `timed out after ${ADAPT_TIMEOUT_MS / 1000}s`
              : e instanceof Error
                ? e.message
                : String(e),
          );
        } finally {
          clearTimeout(timer);
          adaptingRef.current.delete(concept.id);
          setAdapting((a) => {
            if (!(concept.id in a)) return a;
            const next = { ...a };
            delete next[concept.id];
            return next;
          });
        }
      })();
    },
    [topic, record, onRegenerated, push, explain, avoidPromptsFor],
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

  return { onAnswered, onDontGet, adaptations, adapting };
}
