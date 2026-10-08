import { describe, expect, it } from "vitest";
import {
  binomialSpread,
  doubleSlitPath,
  envelopeCurve,
  envelopeIntensity,
  fringeCount,
  interferenceCurve,
  interferenceIntensity,
  twoStateCounts,
  twoStatePath,
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

  it("path reveals the same seeded run one shot at a time", () => {
    const path = twoStatePath(0.3, 40, 7);
    expect(path).toHaveLength(40);
    expect(path).toEqual(twoStatePath(0.3, 40, 7)); // deterministic
    // The running count after every prefix equals the batch count for that n,
    // which is what lets the lab reveal dots without diverging from the reveal.
    for (let k = 1; k <= 40; k++) {
      const running = path.slice(0, k).filter(Boolean).length;
      expect(running).toBe(twoStateCounts(0.3, k, 7).a);
    }
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

  it("the envelope is what remains in the dark fringes when paths are resolved", () => {
    const d = 2;
    const lambda = 1;
    const darkFringe = lambda / (2 * d); // cos^2 = 0 here
    expect(interferenceIntensity(darkFringe, d, lambda)).toBeLessThan(0.001);
    // The single-slit spread at the same position is near its maximum — this
    // is why the which-path pattern is two broad bands, not darkness.
    expect(envelopeIntensity(darkFringe, d, lambda)).toBeGreaterThan(0.9);
    // And with no detector, nothing ever reaches the envelope there.
    expect(interferenceIntensity(darkFringe, d, lambda)).toBeLessThan(
      envelopeIntensity(darkFringe, d, lambda) / 100,
    );
  });

  it("envelope curve is symmetric, bounded, and fringe-free", () => {
    const curve = envelopeCurve(2, 1);
    const center = interferenceIntensity(0, 2, 1);
    expect(center).toBeCloseTo(1);
    for (const { x, i } of curve) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(1.0000001);
      expect(Math.abs(i - envelopeIntensity(-x, 2, 1))).toBeLessThan(1e-12);
    }
  });
});

describe("double-slit single-shot path (lab)", () => {
  const shareIn = (xs: number[], lo: number, hi: number) =>
    xs.filter((x) => x >= lo && x <= hi).length / xs.length;
  const DARK_FRINGE = 0.25; // lambda/(2d) for d=2, lambda=1

  it("is deterministic, bounded, and returns exactly n shots", () => {
    const xs = doubleSlitPath(2, 1, 50, 9);
    expect(xs).toHaveLength(50);
    expect(xs).toEqual(doubleSlitPath(2, 1, 50, 9));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(-8);
      expect(x).toBeLessThanOrEqual(8);
    }
  });

  it("with the detector on, electrons land where interference forbids", () => {
    const n = 3000;
    const seed = 5;
    const interference = doubleSlitPath(2, 1, n, seed);
    const whichPath = doubleSlitPath(2, 1, n, seed, { whichPath: true });
    // The first dark fringe: interference mode barely lands there, while the
    // envelope (detector on) concentrates a real share of shots.
    const dark = shareIn(interference, DARK_FRINGE - 0.05, DARK_FRINGE + 0.05);
    const bright = shareIn(whichPath, DARK_FRINGE - 0.05, DARK_FRINGE + 0.05);
    expect(dark).toBeLessThan(0.01);
    expect(bright).toBeGreaterThan(0.03);
    expect(bright).toBeGreaterThan(dark * 5);
  });

  it("interference mode clusters around the central maximum", () => {
    const xs = doubleSlitPath(2, 1, 2000, 3);
    const central = shareIn(xs, -0.25, 0.25);
    const outer = shareIn(xs, 4, 8);
    expect(central).toBeGreaterThan(outer);
    expect(central).toBeGreaterThan(0.2);
  });
});
