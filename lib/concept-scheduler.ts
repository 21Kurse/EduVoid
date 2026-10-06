/**
 * Lazy concept-generation scheduler (G3 finding 4): the user's open concept
 * is requested first, plus at most the next concept in prerequisite order as
 * a low-priority background prefetch. Total in-flight generation is capped
 * at 2; opening a different concept aborts in-flight work the user switched
 * away from (AbortController); finished concepts are never re-requested
 * (cache), and a failed concept can be retried by reopening it.
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

const MAX_INFLIGHT = 2; // current concept + 1 prefetch (G3 F4: concurrency 1-2)

export function createConceptScheduler(opts: {
  /** Concept ids in prerequisite order (the plan is foundational -> advanced). */
  order: string[];
  /** True when the concept is already generated (client cache). */
  hasConcept: (id: string) => boolean;
  request: ScheduleRequest;
  prefetch?: number;
}): ConceptScheduler {
  const { order, hasConcept, request } = opts;
  const prefetchN = opts.prefetch ?? 1;
  const inFlight = new Map<string, AbortController>();
  const requested = new Set<string>();
  let disposed = false;

  function start(id: string): void {
    if (disposed || requested.has(id) || hasConcept(id)) return;
    requested.add(id);
    const ac = new AbortController();
    inFlight.set(id, ac);
    void request(id, ac.signal)
      .then((ok) => {
        if (!ok) requested.delete(id); // failed: allow a later open to retry
      })
      .finally(() => {
        inFlight.delete(id);
      });
  }

  function prefetchAfter(id: string): void {
    if (inFlight.size >= MAX_INFLIGHT) return;
    const i = order.indexOf(id);
    if (i === -1) return;
    for (let j = i + 1; j < order.length && j <= i + prefetchN; j++) {
      const nid = order[j];
      if (!requested.has(nid) && !hasConcept(nid)) {
        start(nid);
        return;
      }
    }
  }

  function open(id: string): void {
    if (disposed || !order.includes(id)) return;
    // Cancel in-flight requests the user switched away from, EXCEPT the
    // opened concept itself and its prefetch window (reopening the same
    // concept must not abort its own still-valid prefetch).
    const keep = new Set<string>([id]);
    const i = order.indexOf(id);
    for (let j = i + 1; j < order.length && j <= i + prefetchN; j++) keep.add(order[j]);
    for (const [running, ac] of [...inFlight]) {
      if (keep.has(running)) continue;
      ac.abort();
      inFlight.delete(running);
      requested.delete(running);
    }
    start(id);
    prefetchAfter(id);
  }

  return {
    open,
    pendingCount: () => inFlight.size,
    dispose: () => {
      disposed = true;
      for (const [, ac] of inFlight) ac.abort();
      inFlight.clear();
    },
  };
}
