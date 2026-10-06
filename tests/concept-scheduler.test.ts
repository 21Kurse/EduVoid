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

describe("concept scheduler (G3 finding 4)", () => {
  it("opening one concept triggers exactly its request plus the next prefetch", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b", "c"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    expect(h.requests).toEqual(["a", "b"]);
    expect(s.pendingCount()).toBe(2);
    s.dispose();
  });

  it("never re-requests finished (cached) concepts; revisiting is free", async () => {
    const h = harness();
    const done = new Set(["a"]);
    const s = createConceptScheduler({ order: ["a", "b"], hasConcept: (id) => done.has(id), request: h.request });
    s.open("a"); // cached -> no request for a
    await flush();
    expect(h.requests).toEqual(["b"]); // only the prefetch
    s.open("a"); // revisit: everything cached
    await flush();
    expect(h.requests).toEqual(["b"]);
    s.dispose();
  });

  it("switching concepts aborts in-flight work it switched away from", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b", "c", "d"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    expect(h.requests).toEqual(["a", "b"]);
    s.open("c");
    await flush();
    expect(h.aborted.sort()).toEqual(["a", "b"]);
    expect(h.requests).toEqual(["a", "b", "c", "d"]);
    s.dispose();
  });

  it("keeps in-flight concurrency at 2", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b", "c", "d", "e"], hasConcept: () => false, request: h.request });
    s.open("a");
    s.open("c"); // aborts a/b, starts c + d
    await flush();
    expect(s.pendingCount()).toBe(2);
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

  it("dispose aborts everything", async () => {
    const h = harness();
    const s = createConceptScheduler({ order: ["a", "b"], hasConcept: () => false, request: h.request });
    s.open("a");
    await flush();
    s.dispose();
    expect(h.aborted.sort()).toEqual(["a", "b"]);
    const spy = vi.fn();
    s.open("a");
    expect(spy).not.toHaveBeenCalled();
    expect(s.pendingCount()).toBe(0);
  });
});
