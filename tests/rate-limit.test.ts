import { beforeEach, describe, expect, it } from "vitest";
import {
  RATE_RULES,
  checkRateLimit,
  clientKeyFromHeaders,
  rateLimitGuard,
  resetRateLimits,
} from "../lib/rate-limit";

const rule = { limit: 3, windowMs: 60_000 };

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  it("allows up to the limit, then refuses with a retry hint", () => {
    const t0 = 1_000_000;
    expect(checkRateLimit("k", rule, t0).ok).toBe(true);
    expect(checkRateLimit("k", rule, t0).ok).toBe(true);
    expect(checkRateLimit("k", rule, t0).ok).toBe(true);
    const fourth = checkRateLimit("k", rule, t0);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.limit).toBe(3);
      expect(fourth.retryAfterSec).toBe(60);
    }
  });

  it("resets after the window and keeps clients independent", () => {
    const t0 = 5_000;
    for (let i = 0; i < 3; i++) checkRateLimit("a", rule, t0);
    expect(checkRateLimit("a", rule, t0).ok).toBe(false);
    // A different client is unaffected.
    expect(checkRateLimit("b", rule, t0).ok).toBe(true);
    // After the window the original client is allowed again.
    expect(checkRateLimit("a", rule, t0 + 60_000).ok).toBe(true);
  });

  it("applies a real per-route budget by default", () => {
    expect(RATE_RULES.generate.limit).toBeGreaterThan(0);
    expect(RATE_RULES["generate-concept"].limit).toBeGreaterThan(0);
    expect(RATE_RULES["generate-concept"]!.windowMs).toBe(RATE_RULES.generate!.windowMs);
  });
});

describe("clientKeyFromHeaders", () => {
  it("takes the first x-forwarded-for entry", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("rateLimitGuard", () => {
  it("returns a clear 429 response, never a silent hang", async () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4" });
    for (let i = 0; i < 3; i++) {
      expect(rateLimitGuard(headers, "generate", { rule })).toBeNull();
    }
    const res = rateLimitGuard(headers, "generate", { rule });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("retry-after")).toBeTruthy();
    const body = (await res!.json()) as { error?: string; retryAfterSec?: number };
    expect(body.error).toMatch(/rate limit/i);
    expect(body.retryAfterSec).toBeGreaterThan(0);
  });

  it("budgets routes separately for the same client", () => {
    const headers = new Headers({ "x-forwarded-for": "5.5.5.5" });
    for (let i = 0; i < 3; i++) rateLimitGuard(headers, "generate", { rule });
    expect(rateLimitGuard(headers, "generate", { rule })?.status).toBe(429);
    // The concept route has its own bucket, so it is still allowed.
    expect(rateLimitGuard(headers, "generate-concept", { rule })).toBeNull();
  });
});
