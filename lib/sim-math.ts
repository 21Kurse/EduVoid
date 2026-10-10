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

/**
 * The same n shots, in order, as single outcomes (T9 lab: "measure one at a
 * time"). Revealing them one by one shows the running frequency converging
 * on p — the Born rule as an experience, not a sentence. Shares the exact
 * mulberry32 sequence of twoStateCounts, so the running count always equals
 * twoStateCounts(p, k, seed).a after k reveals.
 */
export function twoStatePath(p: number, n: number, seed = 1): boolean[] {
  const prob = clamp(Number.isFinite(p) ? p : 0.5, 0, 1);
  const shots = Math.max(1, Math.round(n) || 1);
  const rng = mulberry32(seed);
  const out: boolean[] = [];
  for (let i = 0; i < shots; i++) out.push(rng() < prob);
  return out;
}

/** Typical 95% spread of a binomial count — for the prediction comparison. */
export function binomialSpread(p: number, n: number): number {
  const prob = clamp(Number.isFinite(p) ? p : 0.5, 0, 1);
  return 2 * Math.sqrt(n * prob * (1 - prob));
}

/** Slit separation / wavelength ranges the templates clamp to. */
export const SLIT_D_MIN = 0.5;
export const SLIT_D_MAX = 5;
export const SLIT_LAMBDA_MIN = 0.25;
export const SLIT_LAMBDA_MAX = 2;

/** Clamped (d, lambda) — one place so every pattern agrees on the ranges. */
function slitParams(d: number, lambda: number): [number, number] {
  return [
    clamp(Number.isFinite(d) ? d : 2, SLIT_D_MIN, SLIT_D_MAX),
    clamp(Number.isFinite(lambda) ? lambda : 1, SLIT_LAMBDA_MIN, SLIT_LAMBDA_MAX),
  ];
}

/**
 * Single-slit intensity envelope at screen position x (slit width a = d/4),
 * the sinc^2 term alone. This is what remains when a which-path detector
 * resolves the two paths: each slit's own spread, with no fringes (T9 lab).
 */
export function envelopeIntensity(x: number, d: number, lambda: number): number {
  const [dd, lam] = slitParams(d, lambda);
  const envPhase = (Math.PI * (dd / 4) * x) / lam;
  return envPhase === 0 ? 1 : (Math.sin(envPhase) / envPhase) ** 2;
}

/**
 * Double-slit intensity at screen position x (slit separation d, wavelength
 * lambda, slit width a = d/4): interference cos^2 term under a sinc^2
 * single-slit envelope. L = 1 in these arbitrary units.
 */
export function interferenceIntensity(x: number, d: number, lambda: number): number {
  const [dd, lam] = slitParams(d, lambda);
  const phase = (Math.PI * dd * x) / lam;
  return Math.cos(phase) ** 2 * envelopeIntensity(x, dd, lam);
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
  const [dd, lam] = slitParams(d, lambda);
  const spacing = lam / dd;
  return Math.max(1, Math.floor((2 * halfWidth) / spacing));
}

/** Sampled envelope curve — the no-interference (which-path) screen. */
export function envelopeCurve(
  d: number,
  lambda: number,
  points = 161,
  halfWidth = 8,
): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let k = 0; k < points; k++) {
    const x = -halfWidth + (2 * halfWidth * k) / (points - 1);
    out.push({ x, i: envelopeIntensity(x, d, lambda) });
  }
  return out;
}

/**
 * Single-electron landing positions, in shot order, sampled from the screen
 * intensity by inverse CDF over a fixed grid (deterministic under `seed`).
 * With `whichPath: true` the samples follow the envelope instead — the lab's
 * fringe build-up visibly stops happening.
 */
export function doubleSlitPath(
  d: number,
  lambda: number,
  n: number,
  seed = 1,
  opts: { whichPath?: boolean; halfWidth?: number; gridPoints?: number } = {},
): number[] {
  const [dd, lam] = slitParams(d, lambda);
  const shots = Math.max(1, Math.round(n) || 1);
  const halfWidth = opts.halfWidth ?? 8;
  const points = Math.max(32, opts.gridPoints ?? 401);
  const intensity = opts.whichPath ? envelopeIntensity : interferenceIntensity;

  const xs: number[] = [];
  const cdf: number[] = [];
  let acc = 0;
  for (let k = 0; k < points; k++) {
    const x = -halfWidth + (2 * halfWidth * k) / (points - 1);
    xs.push(x);
    acc += intensity(x, dd, lam);
    cdf.push(acc);
  }
  if (acc <= 0) return new Array(shots).fill(0);

  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let s = 0; s < shots; s++) {
    const target = rng() * acc;
    // First grid index whose cumulative weight reaches the target…
    let lo = 0;
    let hi = points - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    // …then interpolate inside that cell so positions are not quantized.
    const i1 = lo;
    const i0 = Math.max(0, lo - 1);
    const c0 = cdf[i0];
    const c1 = cdf[i1];
    const frac = c1 > c0 ? clamp((target - c0) / (c1 - c0), 0, 1) : 0;
    out.push(xs[i0] + (xs[i1] - xs[i0]) * frac);
  }
  return out;
}

/* ------------------------------------------------------------------------- *
 * Bayes-update template (owner request, Oct 10: tailor the app to Bayes and
 * make the hand-built sims match). Deterministic and exact — no RNG: the
 * frequency-grid visual draws a population of `population` people, so the
 * counts must always add up to the population.
 * ------------------------------------------------------------------------- */

/** Ranges every Bayes-template value is clamped to (the sliders use the same). */
export const BAYES_PRIOR_MIN = 0.01;
export const BAYES_PRIOR_MAX = 0.6;
export const BAYES_SENSITIVITY_MIN = 0.5;
export const BAYES_SENSITIVITY_MAX = 0.99;
export const BAYES_FP_MIN = 0.01;
export const BAYES_FP_MAX = 0.5;

/**
 * Posterior P(A|B) = P(B|A)P(A) / [P(B|A)P(A) + P(B|¬A)P(¬A)] — the exact
 * quantity the lesson is about. Clamped so a degenerate model output can
 * never produce NaN or divide by zero.
 */
export function bayesPosterior(prior: number, sensitivity: number, falsePositive: number): number {
  const p = clamp(Number.isFinite(prior) ? prior : 0.01, BAYES_PRIOR_MIN, BAYES_PRIOR_MAX);
  const s = clamp(Number.isFinite(sensitivity) ? sensitivity : 0.9, BAYES_SENSITIVITY_MIN, BAYES_SENSITIVITY_MAX);
  const f = clamp(Number.isFinite(falsePositive) ? falsePositive : 0.05, BAYES_FP_MIN, BAYES_FP_MAX);
  const denom = s * p + f * (1 - p);
  return denom > 0 ? (s * p) / denom : 0;
}

export type BayesCounts = {
  /** has the condition AND tests positive */
  tp: number;
  /** has the condition, missed by the test */
  fn: number;
  /** healthy, but flags positive (false alarm) */
  fp: number;
  /** healthy and tests negative */
  tn: number;
  /** everyone who tests positive (tp + fp) */
  positives: number;
  /** share of positive results that are real, from the counts themselves */
  posterior: number;
};

/**
 * Integer counts for a population of `population` people — the numbers the
 * frequency grid draws. Grouped in a fixed order (tp, fn, fp, tn) so the
 * same inputs always produce the same picture, and the counts always sum to
 * the population exactly.
 */
export function bayesCounts(
  prior: number,
  sensitivity: number,
  falsePositive: number,
  population = 1000,
): BayesCounts {
  const n = Math.max(100, Math.round(Number.isFinite(population) ? population : 1000));
  const p = clamp(Number.isFinite(prior) ? prior : 0.01, BAYES_PRIOR_MIN, BAYES_PRIOR_MAX);
  const s = clamp(Number.isFinite(sensitivity) ? sensitivity : 0.9, BAYES_SENSITIVITY_MIN, BAYES_SENSITIVITY_MAX);
  const f = clamp(Number.isFinite(falsePositive) ? falsePositive : 0.05, BAYES_FP_MIN, BAYES_FP_MAX);
  const sick = Math.round(p * n);
  const tp = Math.min(sick, Math.round(sick * s));
  const fn = sick - tp;
  const healthy = n - sick;
  const fp = Math.round(healthy * f);
  const tn = healthy - fp;
  const positives = tp + fp;
  return { tp, fn, fp, tn, positives, posterior: positives > 0 ? tp / positives : 0 };
}
