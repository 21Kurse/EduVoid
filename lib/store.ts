"use client";

/**
 * Learning-state store. No accounts, no database (§2): everything lives in
 * localStorage and survives reloads. Implemented with useSyncExternalStore
 * so localStorage is a true external store (no setState-in-effect).
 * T2 stores mastery + selection only; T11 adds deterministic update rules.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { MasteryState } from "./mastery";

const STORAGE_KEY = "eduvoid.state.v1";

export type LearningState = {
  /** conceptId -> mastery state */
  concepts: Record<string, MasteryState>;
  selectedConceptId: string | null;
};

const EMPTY: LearningState = { concepts: {}, selectedConceptId: null };

function parseState(raw: string | null): LearningState {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as LearningState;
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    return {
      concepts: parsed.concepts ?? {},
      selectedConceptId: parsed.selectedConceptId ?? null,
    };
  } catch {
    // Corrupted storage: start clean rather than crash.
    return EMPTY;
  }
}

// Snapshot cache: getSnapshot must return a stable identity for the same
// raw value, or React would loop re-rendering.
let cacheRaw: string | null | undefined;
let cacheState: LearningState = EMPTY;

function getSnapshot(): LearningState {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cacheRaw) return cacheState;
  cacheRaw = raw;
  cacheState = parseState(raw);
  return cacheState;
}

function getServerSnapshot(): LearningState {
  return EMPTY;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Cross-tab sync comes free with the storage event.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateLearningState(
  next: LearningState | ((current: LearningState) => LearningState),
): void {
  if (typeof window === "undefined") return;
  const current = getSnapshot();
  const value =
    typeof next === "function" ? (next as (c: LearningState) => LearningState)(current) : next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full/blocked: keep working in-memory this session. Non-crashing
    // failure path (§12); persistence simply does not update.
  }
  cacheRaw = window.localStorage.getItem(STORAGE_KEY);
  cacheState = value;
  listeners.forEach((l) => l());
}

export function useLearningState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const selectConcept = useCallback((conceptId: string | null) => {
    updateLearningState((s) => ({ ...s, selectedConceptId: conceptId }));
  }, []);
  return { state, selectConcept };
}
