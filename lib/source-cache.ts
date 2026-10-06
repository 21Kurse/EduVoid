/**
 * Verified-source cache (G3 finding 4): lazy concept generation reuses the
 * search + verified-claim result of the initial run instead of re-running
 * search/extraction per opened concept (quota + latency). Best-effort
 * in-memory cache — on a cold serverless instance the fallback re-runs the
 * stages. §4.4 holds in every path: cached results carry VERIFIED claims.
 */
import type { SourceResult } from "./source";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 20;

const cache = new Map<string, { result: SourceResult; ts: number }>();

export function setVerifiedSource(topic: string, result: SourceResult): void {
  cache.set(topic, { result, ts: Date.now() });
  if (cache.size > MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export function getVerifiedSource(topic: string): SourceResult | null {
  const hit = cache.get(topic);
  if (!hit) return null;
  if (Date.now() - hit.ts > TTL_MS) {
    cache.delete(topic);
    return null;
  }
  return hit.result;
}

/** Test helper. */
export function clearVerifiedSourceCache(): void {
  cache.clear();
}
