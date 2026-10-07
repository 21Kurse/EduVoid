/**
 * Per-IP rate limiting (AGENTS.md §13.9 abuse and cost protection). Fixed-
 * window counters in memory, bounded in size. Best-effort by design: a cold
 * serverless instance starts empty, but within an instance a single client
 * cannot loop generation routes and burn provider budget. Rate-limited
 * requests get an immediate, explicit 429 (never a silent hang).
 */

export type RateLimitRule = { limit: number; windowMs: number };

/** Per-route budgets. Generous enough for a real lesson, tight enough to cap abuse. */
export const RATE_RULES: Record<string, RateLimitRule> = {
  /** Full setup runs are the expensive path (search + claims + verify + hero). */
  generate: { limit: 6, windowMs: 10 * 60_000 },
  /** Lazy concepts: a lesson opens ~6 and prefetches, plus adaptations. */
  "generate-concept": { limit: 40, windowMs: 10 * 60_000 },
};

/** Hard cap on tracked keys so a rotating-IP flood cannot grow memory. */
const MAX_KEYS = 5000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitDecision =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSec: number; resetAt: number; limit: number };

function evict(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
  if (buckets.size >= MAX_KEYS) {
    // Still full of live windows: drop the soonest-to-expire entries.
    const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < Math.ceil(oldest.length / 4); i++) buckets.delete(oldest[i][0]);
  }
}

/**
 * Consume one unit for `key` under `rule`. `now` is injectable for tests.
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitDecision {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    evict(now);
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1, resetAt: now + rule.windowMs };
  }
  if (existing.count >= rule.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      resetAt: existing.resetAt,
      limit: rule.limit,
    };
  }
  existing.count += 1;
  return { ok: true, remaining: rule.limit - existing.count, resetAt: existing.resetAt };
}

/**
 * Best-effort client identity for rate limiting. Vercel sets
 * `x-forwarded-for`; fall back to other proxy headers, then a shared bucket.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  return "unknown";
}

/**
 * Consume one unit for the request's client under the named route bucket.
 * Returns a ready 429 Response when over budget, or null to proceed. Called
 * BEFORE any streaming starts, so the client gets an explicit error fast.
 */
export function rateLimitGuard(
  headers: Headers,
  bucket: keyof typeof RATE_RULES,
  opts: { rule?: RateLimitRule; now?: number; keyOverride?: string } = {},
): Response | null {
  const rule = opts.rule ?? RATE_RULES[bucket];
  const key = `${bucket}:${opts.keyOverride ?? clientKeyFromHeaders(headers)}`;
  const decision = checkRateLimit(key, rule, opts.now ?? Date.now());
  if (decision.ok) return null;
  const sec = decision.retryAfterSec;
  return Response.json(
    {
      error: `Rate limit reached (max ${decision.limit} requests per ${
        Math.round(rule.windowMs / 60_000)
      } min). This cap protects the demo's API budget — please wait ${sec}s and try again.`,
      retryAfterSec: sec,
    },
    { status: 429, headers: { "retry-after": String(sec) } },
  );
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
