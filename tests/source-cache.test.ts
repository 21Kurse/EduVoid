import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearVerifiedSourceCache,
  getVerifiedSource,
  setVerifiedSource,
} from "../lib/source-cache";
import type { SourceResult } from "../lib/source";

function result(topic: string): SourceResult {
  return {
    topic,
    sources: [],
    claims: [],
    contradictions: [],
    timings: { searchMs: 1, extractionMs: 0, claimsMs: 1, totalMs: 2 },
  };
}

afterEach(() => {
  clearVerifiedSourceCache();
  vi.useRealTimers();
});

describe("verified-source cache (G3 finding 4)", () => {
  it("round-trips a verified result per topic", () => {
    setVerifiedSource("t1", result("t1"));
    expect(getVerifiedSource("t1")?.topic).toBe("t1");
    expect(getVerifiedSource("other")).toBeNull();
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    setVerifiedSource("t1", result("t1"));
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(getVerifiedSource("t1")).toBeNull();
  });

  it("evicts the oldest entry beyond the capacity", () => {
    for (let i = 0; i < 21; i++) setVerifiedSource(`t${i}`, result(`t${i}`));
    expect(getVerifiedSource("t0")).toBeNull(); // oldest evicted
    expect(getVerifiedSource("t20")?.topic).toBe("t20");
  });
});
