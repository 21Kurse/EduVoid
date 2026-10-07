/**
 * Browser storage for eval participants (T13, §6): per-participant pre/post
 * records with timestamps, under a dedicated key. Shares lib/store.ts
 * conventions (useSyncExternalStore over localStorage, robust parse, never
 * crash). Eval records never touch the in-app learning-state key
 * `eduvoid.state.v1` — the two systems stay separate in code and storage.
 */
import { useCallback, useSyncExternalStore } from "react";

const EVAL_STORAGE_KEY = "eduvoid.eval.v1";

/** One answered external question (timestamps logged per §6). */
export type RecordedAnswer = {
  questionId: string;
  correct: boolean;
  /** Seconds the question was on screen before answering. */
  elapsedSec: number;
};

type Part = {
  answers: RecordedAnswer[];
  startedAt: number;
  finishedAt: number | null;
};

export type EvalRecord = {
  /** Owner-typed participant label (e.g. "P1"). No accounts (§2). */
  name: string;
  pre: Part;
  post: Part;
};

export type EvalStore = EvalRecord[];

function emptyPart(): Part {
  return { answers: [], startedAt: 0, finishedAt: null };
}

/** Starts (or resumes) a record; both parts always exist so the CSV
 * export and UI can read them unconditionally. */
export function upsertRecord(
  store: EvalStore,
  name: string,
  part: "pre" | "post",
  now: number,
): EvalStore {
  const freshPart = (): Part => ({ answers: [], startedAt: now, finishedAt: null });
  const i = store.findIndex((r) => r.name === name);
  if (i === -1) {
    const rec: EvalRecord = { name, pre: emptyPart(), post: emptyPart() };
    rec[part] = freshPart();
    return [...store, rec];
  }
  const rec = store[i]!;
  const updated: EvalRecord = { ...rec };
  // Resuming a part never resets its startedAt or answers.
  if (updated[part].startedAt === 0) updated[part] = freshPart();
  const next = store.slice();
  next[i] = updated;
  return next;
}

/** Appends an answer with its completion timestamp. */
export function addAnswer(
  store: EvalStore,
  name: string,
  part: "pre" | "post",
  answer: RecordedAnswer,
  now: number,
): EvalStore {
  return store.map((r) =>
    r.name === name
      ? {
          ...r,
          [part]: {
            ...r[part],
            answers: [...r[part].answers.filter((a) => a.questionId !== answer.questionId), answer],
            finishedAt: now,
          },
        }
      : r,
  );
}

/** Closes the named part end-to-end. */
export function finishPart(store: EvalStore, name: string, part: "pre" | "post", now: number): EvalStore {
  return store.map((r) =>
    r.name === name ? { ...r, [part]: { ...r[part], finishedAt: now } } : r,
  );
}

export function findRecord(store: EvalStore, name: string): EvalRecord | null {
  return store.find((r) => r.name === name) ?? null;
}

function parseStore(raw: string | null): EvalStore {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: EvalStore = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Partial<EvalRecord>;
      if (typeof r.name !== "string") continue;
      const part = (p: unknown): Part => {
        const obj = (p ?? {}) as Partial<Part>;
        return {
          answers: Array.isArray(obj.answers)
            ? obj.answers.filter(
                (a): a is RecordedAnswer =>
                  typeof a === "object" &&
                  a !== null &&
                  typeof (a as RecordedAnswer).questionId === "string" &&
                  typeof (a as RecordedAnswer).correct === "boolean" &&
                  typeof (a as RecordedAnswer).elapsedSec === "number",
              )
            : [],
          startedAt: typeof obj.startedAt === "number" ? obj.startedAt : 0,
          finishedAt: typeof obj.finishedAt === "number" ? obj.finishedAt : null,
        };
      };
      out.push({ name: r.name, pre: part(r.pre), post: part(r.post) });
    }
    return out;
  } catch {
    return [];
  }
}

let cacheRaw: string | null | undefined;
let cacheStore: EvalStore = [];

// Stable empty identity: getSnapshot/getServerSnapshot must return the
// same reference for the same value or React loops (same as lib/store.ts).
const EMPTY: EvalStore = [];

function getSnapshot(): EvalStore {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(EVAL_STORAGE_KEY);
  if (raw === cacheRaw) return cacheStore;
  cacheRaw = raw;
  cacheStore = parseStore(raw);
  return cacheStore;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === EVAL_STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): EvalStore {
  return EMPTY;
}

/** Per-participant answer state for the active part (resumable). */
export function readPart(store: EvalStore, name: string, part: "pre" | "post") {
  const rec = findRecord(store, name);
  if (!rec) return { answers: {} as Record<string, RecordedAnswer>, startedAt: 0 };
  const answers: Record<string, RecordedAnswer> = {};
  for (const a of rec[part].answers) answers[a.questionId] = a;
  return { answers, startedAt: rec[part].startedAt };
}

export function updateEvalStore(next: EvalStore | ((cur: EvalStore) => EvalStore)): void {
  if (typeof window === "undefined") return;
  const current = getSnapshot();
  const value = typeof next === "function" ? next(current) : next;
  try {
    window.localStorage.setItem(EVAL_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full/blocked: keep working in-memory this session (§12).
  }
  cacheRaw = window.localStorage.getItem(EVAL_STORAGE_KEY);
  cacheStore = value;
  listeners.forEach((l) => l());
}

export function useEvalStore() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const save = useCallback(
    (next: EvalStore | ((cur: EvalStore) => EvalStore)) => updateEvalStore(next),
    [],
  );
  return { store, save };
}
