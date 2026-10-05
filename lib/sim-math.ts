/**
 * Pure simulation math for the hand-built predict-then-reveal sims (T9,
 * §13.6). No React, no DOM — fully unit-testable. Seeded RNG keeps tests
 * deterministic; all params are clamped so LLM-supplied values can never
 * break the template.
 */

/** Deterministic PRNG (mulberry32) so sim outcomes are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Outcome counts for n shots of a two-state system with P(A) = p. */
export function twoStateCounts(
  p: number,
  n: number,
  seed = 1,
): { a: number; b: number } {
  const prob = clamp(Number.isFinite(p) ? p : 0.5, 0, 1);
  const shots = Math.max(1, Math.round(n) || 1);
  const rng = mulberry32(seed);
  let a = 0;
  for (let i = 0; i < shots; i++) if (rng() < prob) a++;
  return { a, b: shots - a };
}

/** Typical 95% spread of a binomial count — for the prediction comparison. */
export function binomialSpread(p: number, n: number): number {
  const prob = clamp(Number.isFinite(p) ? p : 0.5, 0, 1);
  return 2 * Math.sqrt(n * prob * (1 - prob));
}

/**
 * Double-slit intensity at screen position x (slit separation d, wavelength
 * lambda, slit width a = d/4): interference cos^2 term under a sinc^2
 * single-slit envelope. L = 1 in these arbitrary units.
 */
export function interferenceIntensity(x: number, d: number, lambda: number): number {
  const phase = (Math.PI * d * x) / lambda;
  const envPhase = (Math.PI * (d / 4) * x) / lambda;
  const cos2 = Math.cos(phase) ** 2;
  const env = envPhase === 0 ? 1 : (Math.sin(envPhase) / envPhase) ** 2;
  return cos2 * env;
}

export type CurvePoint = { x: number; i: number };

/** Sampled intensity curve over [-halfWidth, halfWidth]. */
export function interferenceCurve(
  d: number,
  lambda: number,
  points = 161,
  halfWidth = 8,
): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let k = 0; k < points; k++) {
    const x = -halfWidth + (2 * halfWidth * k) / (points - 1);
    out.push({ x, i: interferenceIntensity(x, d, lambda) });
  }
  return out;
}

/** Number of interference maxima (fringes) visible within the window. */
export function fringeCount(d: number, lambda: number, halfWidth = 8): number {
  // Maxima of cos^2 occur every pi in phase: spacing dx = lambda/d.
  const spacing = lambda / clamp(d, 0.25, 5);
  return Math.max(1, Math.floor((2 * halfWidth) / spacing));
}
