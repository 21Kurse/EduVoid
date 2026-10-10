/**
 * Ordered concept-generation scheduler (owner request, Oct 10: the concepts
 * were being generated in parallel — prioritize the first, then the second,
 * and so on).
 *
 * Contract:
 *  1. ONE generation request is in flight at a time. No parallel concept
 *     calls, so the provider is not raced and the lesson fills in a stable,
 *     explainable order.
 *  2. Order is the plan order (foundational -> advanced). After the current
 *     concept finishes, the next ungenerated concept in that order starts.
 *     The lesson therefore completes on its own, in the order the mindmap
 *     shows it.
 *  3. Opening a concept is the one thing that jumps the queue: the learner is
 *     waiting on it, so in-flight work for a different concept is aborted and
 *     the opened concept starts next. A concept that was aborted (or failed)
 *     stays eligible and is picked up again later, still in plan order.
 *  4. Finished concepts are never re-requested (cache); a failed concept can
 *     be retried by reopening it.
 */

export type ScheduleRequest = (
  conceptId: string,
  signal: AbortSignal,
) => Promise<boolean>;

export type ConceptScheduler = {
  open: (conceptId: string) => void;
  pendingCount: () => number;
  dispose: () => void;
};

export function createConceptScheduler(opts: {
  /** Concept ids in prerequisite order (the plan is foundational -> advanced). */
  order: string[];
  /** True when the concept is already generated (client cache). */
  hasConcept: (id: string) => boolean;
  request: ScheduleRequest;
  /** Kept for callers that used to configure a prefetch window. */
  prefetch?: number;
}): ConceptScheduler {
  const { order, hasConcept, request } = opts;
  const inFlight = new Map<string, AbortController>();
  /** Concepts requested but not yet known to be finished. */
  const inFlightOrPending = new Set<string>();
  /** The concept the learner last opened: run it before anything else. */
  let priority: string | null = null;
  let disposed = false;

  function eligible(id: string): boolean {
    return !inFlightOrPending.has(id) && !hasConcept(id);
  }

  /** Highest-priority work: the opened concept, else the earliest in order. */
  function nextId(): string | null {
    if (priority && order.includes(priority) && eligible(priority)) return priority;
    for (const id of order) if (eligible(id)) return id;
    return null;
  }

  /** Run the next concept; called again whenever a request settles. */
  function pump(): void {
    if (disposed || inFlight.size > 0) return;
    const id = nextId();
    if (!id) return;
    if (priority === id) priority = null;
    const ac = new AbortController();
    inFlight.set(id, ac);
    inFlightOrPending.add(id);
    void request(id, ac.signal)
      .then((ok) => {
        if (!ok) inFlightOrPending.delete(id); // failed: a later pass retries it
      })
      .finally(() => {
        inFlight.delete(id);
        pump();
      });
  }

  function open(id: string): void {
    if (disposed || !order.includes(id)) return;
    if (hasConcept(id)) {
      // Already generated: nothing to prioritize and nothing to interrupt —
      // reopening a concept the learner has seen must not disturb the queue.
      if (priority === id) priority = null;
      pump();
      return;
    }
    priority = id;
    // The learner is waiting on this one: drop other in-flight work so it can
    // start immediately. The aborted concept is not lost — it stays eligible
    // and comes back in plan order.
    for (const [running, ac] of [...inFlight]) {
      if (running === id) continue;
      ac.abort();
      inFlight.delete(running);
      inFlightOrPending.delete(running);
    }
    pump();
  }

  return {
    open,
    pendingCount: () => inFlight.size,
    dispose: () => {
      disposed = true;
      for (const [, ac] of inFlight) ac.abort();
      inFlight.clear();
      inFlightOrPending.clear();
      priority = null;
    },
  };
}
