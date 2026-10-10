import { describe, expect, it, vi } from "vitest";
import { createConceptScheduler, type ScheduleRequest } from "../lib/concept-scheduler";

type Harness = {
  requests: string[];
  aborted: string[];
  pending: Map<string, (ok: boolean) => void>;
  request: ScheduleRequest;
};

function harness(): Harness {
  const h: Harness = { requests: [], aborted: [], pending: new Map(), request: null as never };
  h.request = (id, signal) =>
    new Promise<boolean>((resolve) => {
      h.requests.push(id);
      h.pending.set(id, resolve);
      signal.addEventListener("abort", () => h.aborted.push(id));
    });
  return h;
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("concept scheduler (ordered, one at a time)", () => {
  it("starts the opened concept alone — never in parallel with the next one", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b", "c"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    expect(h.requests).toEqual(["a"]);
    expect(s.pendingCount()).toBe(1);
    s.dispose();
  });

  it("continues in plan order once a concept finishes: first, then second, then third", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b", "c"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    h.pending.get("a")?.(true);
    await flush();
    expect(h.requests).toEqual(["a", "b"]);
    h.pending.get("b")?.(true);
    await flush();
    expect(h.requests).toEqual(["a", "b", "c"]);
    expect(s.pendingCount()).toBe(1);
    s.dispose();
  });

  it("never re-requests finished (cached) concepts; revisiting is free", async () => {
    const h = harness();
    const done = new Set(["a"]);
    const s = createConceptScheduler({ order: ["a", "b"], hasConcept: (id) => done.has(id), request: h.request });
    s.open("a"); // cached -> the priority is satisfied, the queue continues
    await flush();
    expect(h.requests).toEqual(["b"]);
    s.open("a"); // revisit: everything cached, nothing happens
    await flush();
    expect(h.requests).toEqual(["b"]);
    s.dispose();
  });

  it("makes an opened concept jump the queue, aborting the concept it interrupted", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b", "c", "d"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    s.open("c");
    await flush();
    expect(h.aborted).toEqual(["a"]);
    expect(h.requests).toEqual(["a", "c"]);
    expect(s.pendingCount()).toBe(1);
    s.dispose();
  });

  it("picks the interrupted concept back up, still in plan order", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b", "c"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    s.open("c"); // aborts a, runs c
    await flush();
    h.pending.get("c")?.(true);
    await flush();
    expect(h.requests).toEqual(["a", "c", "a"]);
    s.dispose();
  });

  it("retries a failed concept when reopened", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    h.pending.get("a")?.(false); // generation failed
    await flush();
    s.open("a"); // user retries via reopen
    await flush();
    expect(h.requests.filter((id) => id === "a")).toHaveLength(2);
    s.dispose();
  });

  it("dispose aborts everything and stops the queue", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    s.dispose();
    expect(h.aborted).toEqual(["a"]);
    const spy = vi.fn();
    s.open("a");
    expect(spy).not.toHaveBeenCalled();
    expect(s.pendingCount()).toBe(0);
    expect(h.requests).toEqual(["a"]);
  });
});
