import { describe, expect, it } from "vitest";
import {
  binomialSpread,
  fringeCount,
  interferenceCurve,
  interferenceIntensity,
  twoStateCounts,
} from "../lib/sim-math";

describe("two-state sim", () => {
  it("sums to n and is deterministic under a fixed seed", () => {
    const r1 = twoStateCounts(0.3, 50, 7);
    const r2 = twoStateCounts(0.3, 50, 7);
    expect(r1.a + r1.b).toBe(50);
    expect(r1).toEqual(r2);
  });

  it("concentrates near n*p for the seeded run", () => {
    const { a } = twoStateCounts(0.5, 2000, 42);
    const spread = binomialSpread(0.5, 2000);
    expect(Math.abs(a - 1000)).toBeLessThan(spread);
  });

  it("clamps impossible probabilities and non-positive shots", () => {
    const r = twoStateCounts(7, -3, 1);
    expect(r.a + r.b).toBe(1); // shots clamped to 1
    expect(r.b).toBe(0); // p clamped to 1 -> always A
  });
});

describe("double-slit sim", () => {
  it("peaks at the center and stays within [0, 1]", () => {
    expect(interferenceIntensity(0, 2, 1)).toBeCloseTo(1);
    const curve = interferenceCurve(2, 1);
    for (const { i } of curve) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(1.0000001);
    }
  });

  it("more slit separation gives more fringes", () => {
    expect(fringeCount(1, 1)).toBeLessThan(fringeCount(3, 1));
    expect(fringeCount(3, 1)).toBeLessThan(fringeCount(5, 1));
  });

  it("longer wavelength gives fewer fringes", () => {
    expect(fringeCount(2, 2)).toBeLessThan(fringeCount(2, 0.5));
  });

  it("fringes decay outward from the central peak under the envelope", () => {
    // The sinc envelope makes fringe maxima shrink with distance from the
    // center — the visible pattern is a central bright fringe with
    // progressively dimmer side fringes.
    const d = 2;
    const lambda = 1;
    const i0 = interferenceIntensity(0, d, lambda);
    const i1 = interferenceIntensity(lambda / d, d, lambda);
    const i2 = interferenceIntensity((2 * lambda) / d, d, lambda);
    expect(i0).toBeCloseTo(1);
    expect(i1).toBeLessThan(i0);
    expect(i2).toBeLessThan(i1);
  });

  it("pattern is symmetric about the center", () => {
    const curve = interferenceCurve(3, 0.8);
    for (const { x, i } of curve) {
      expect(Math.abs(i - interferenceIntensity(-x, 3, 0.8))).toBeLessThan(1e-12);
    }
  });
});
