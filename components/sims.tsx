"use client";

/**
 * Predict-then-reveal sims (T9, §5.2 + §13.6): hand-built templates only —
 * the LLM supplies parameters and the prediction prompt, never sim code.
 * Each sim is LOCKED behind a committed prediction, then compares the
 * user's prediction against the outcome.
 *
 * Owner request (Oct 8: "make it more interactive"): after the reveal, each
 * sim unlocks an explore lab — sliders for the preparation/geometry and
 * single-shot firing so the learner builds the statistics themselves:
 *  - two-state: measure one system at a time and watch the running frequency
 *    converge on the preparation (the Born rule as an experience);
 *  - double-slit: fire one electron at a time and watch fringes build up,
 *    then switch the which-path detector on and watch them stop building.
 * All math is pure and seeded (lib/sim-math.ts); no model, no network.
 */
import { useMemo, useState } from "react";
import type { Component } from "@/lib/spec";
import {
  binomialSpread,
  clamp,
  doubleSlitPath,
  envelopeCurve,
  fringeCount,
  interferenceCurve,
  twoStateCounts,
  twoStatePath,
} from "@/lib/sim-math";

type SimComponent = Extract<Component, { type: "sim" }>;

function SimShell({ prompt, children }: { prompt: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4" data-testid="sim">
      <p className="mb-3 text-[13px] font-medium text-zinc-900">{prompt}</p>
      {children}
    </div>
  );
}

/** One labelled range input for the explore labs. */
function LabSlider({
  testId,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  testId: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-700">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-violet-600"
      />
    </div>
  );
}

function LabButton({
  testId,
  onClick,
  children,
}: {
  testId: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="rounded-lg border border-border-subtle bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:bg-violet-50"
    >
      {children}
    </button>
  );
}

function TwoStateSim({
  values,
  prompt,
  seed,
}: {
  values: Record<string, number | string | boolean>;
  prompt: string;
  seed: number;
}) {
  const num = (k: string, dflt: number) => {
    const v = Number(values[k]);
    return Number.isFinite(v) ? v : dflt;
  };
  const p = clamp(num("p", 0.5), 0.05, 0.95);
  const n = Math.round(clamp(num("n", 50), 10, 200));
  const [prediction, setPrediction] = useState("");
  const [committed, setCommitted] = useState<number | null>(null);
  // Explore lab (unlocked only after the prediction is committed).
  const [labP, setLabP] = useState(p);
  const [labN, setLabN] = useState(clamp(n, 20, 200));
  const [revealed, setRevealed] = useState(0);
  const outcome = useMemo(() => twoStateCounts(p, n, seed), [p, n, seed]);
  const labPath = useMemo(() => twoStatePath(labP, labN, seed + 1), [labP, labN, seed]);
  const valid = prediction !== "" && Number(prediction) >= 0 && Number(prediction) <= n;

  if (committed === null) {
    return (
      <SimShell prompt={prompt}>
        <p className="mb-2 text-[12px] text-zinc-600">
          {n} identical systems are prepared in the same superposition and measured one by one.
          {p !== 0.5 && " The preparation weights the two outcomes unequally."}
        </p>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            value={prediction}
            onChange={(e) => setPrediction(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={`0–${n}`}
            aria-label="Your prediction: how many land in state A"
            className="h-9 w-24 rounded-lg border border-border-subtle px-3 text-[13px] outline-none focus:border-violet-400"
          />
          <button
            type="button"
            disabled={!valid}
            onClick={() => setCommitted(Number(prediction))}
            className="h-9 rounded-lg bg-violet-600 px-4 text-[13px] font-medium text-white disabled:opacity-40"
          >
            Commit prediction
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">The sim stays locked until you commit.</p>
      </SimShell>
    );
  }

  const spread = binomialSpread(p, n);
  const off = Math.abs(committed - outcome.a);
  const pctA = Math.round((outcome.a / n) * 100);
  const shown = labPath.slice(0, revealed);
  const labA = shown.filter(Boolean).length;
  const labPct = revealed > 0 ? Math.round((labA / revealed) * 100) : 0;
  const targetPct = Math.round(labP * 100);
  // Typical binomial spread at this sample size (2σ in counts).
  const labSpread = binomialSpread(labP, revealed);
  const spreadPts = revealed > 0 ? Math.round((labSpread / revealed) * 100) : 0;
  const withinSpread = revealed > 0 && Math.abs(labA - labP * revealed) <= labSpread;
  return (
    <SimShell prompt={prompt}>
      <div className="space-y-2" data-testid="sim-outcome">
        <div>
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>State A — {outcome.a} of {n}</span>
            <span>State B — {outcome.b} of {n}</span>
          </div>
          <div className="mt-1 flex h-4 overflow-hidden rounded">
            <div className="bg-violet-600" style={{ width: `${pctA}%` }} />
            <div className="flex-1 bg-zinc-300" />
          </div>
        </div>
        <p className="rounded-lg bg-white px-3 py-2 text-[12px] text-zinc-700">
          You predicted <strong>{committed}</strong>; the run gave <strong>{outcome.a}</strong>. Expected
          ≈ {Math.round(p * n)} with a typical spread of ±{Math.round(spread)} —{" "}
          {off <= spread ? "your guess was within one typical spread." : "outside one typical spread — randomness is lumpy at small n."}
        </p>
        <button type="button" onClick={() => { setCommitted(null); setPrediction(""); setRevealed(0); }} className="text-[11px] text-violet-700 hover:underline">
          Run again with a new prediction
        </button>
      </div>

      <div className="mt-4 border-t border-violet-200 pt-3" data-testid="sim-lab">
        <p className="text-[12px] font-medium text-zinc-800">Now measure them yourself</p>
        <p className="mb-3 mt-0.5 text-[11px] text-zinc-500">
          Change the preparation, then reveal the measurements one at a time — each outcome is
          random, but the running frequency settles on the preparation.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabSlider
            testId="slider-p"
            label="Preparation P(A)"
            value={labP}
            min={0.05}
            max={0.95}
            step={0.05}
            display={`${targetPct}%`}
            onChange={(v) => { setLabP(v); setRevealed(0); }}
          />
          <LabSlider
            testId="slider-n"
            label="Systems prepared"
            value={labN}
            min={20}
            max={200}
            step={10}
            display={String(labN)}
            onChange={(v) => { setLabN(v); setRevealed(0); }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LabButton testId="measure-one" onClick={() => setRevealed((r) => Math.min(labPath.length, r + 1))}>
            Measure one
          </LabButton>
          <LabButton testId="measure-ten" onClick={() => setRevealed((r) => Math.min(labPath.length, r + 10))}>
            +10
          </LabButton>
          <LabButton testId="measure-all" onClick={() => setRevealed(labPath.length)}>
            Fire all {labN}
          </LabButton>
          <LabButton testId="lab-reset" onClick={() => setRevealed(0)}>
            Reset
          </LabButton>
          <span className="ml-auto text-[12px] text-zinc-600" data-testid="lab-count">
            A {labA} / {revealed}
            {revealed > 0 && <> · {labPct}%</>}
          </span>
        </div>
        <div className="mt-2 flex min-h-[10px] flex-wrap gap-1" data-testid="shots-strip" aria-label={`${revealed} measured systems`}>
          {shown.map((isA, i) => (
            <span
              key={i}
              className={`inline-block h-2 w-2 rounded-full ${isA ? "bg-violet-600" : "bg-zinc-300"}`}
            />
          ))}
        </div>
        {revealed > 0 && (
          <p className="mt-2 text-[11px] text-zinc-500" data-testid="lab-note">
            {labA} of {revealed} landed in A — {labPct}% against a preparation of {targetPct}%. At this
            sample size the typical fluctuation is ±{spreadPts} points, so the run is{" "}
            {withinSpread
              ? revealed >= 100
                ? "pinned to the preparation: single outcomes stay unpredictable, the frequency does not."
                : "consistent with the preparation — more shots tighten it."
              : revealed >= labPath.length
                ? "outside the typical spread — this batch hit an unlucky stretch; a larger batch pulls the frequency back."
                : "unusually far off; keep measuring."}
          </p>
        )}
      </div>
    </SimShell>
  );
}

const SLIT_OPTIONS = ["Two bright bands", "Alternating bright and dark fringes", "One central band", "A uniform smear"] as const;

/** SVG path for an intensity curve inside the 400-wide lab viewBox. */
function toCurvePath(curve: { x: number; i: number }[], baseline: number, height: number): string {
  const max = Math.max(...curve.map((c) => c.i), 1e-9);
  return curve
    .map((c, k) => `${k === 0 ? "M" : "L"} ${(c.x + 8) * 25} ${baseline - (c.i / max) * height}`)
    .join(" ");
}

function DoubleSlitSim({ values, prompt, seed }: { values: Record<string, number | string | boolean>; prompt: string; seed: number }) {
  const num = (k: string, dflt: number) => {
    const v = Number(values[k]);
    return Number.isFinite(v) ? v : dflt;
  };
  const d = clamp(num("d", 2), 0.5, 5);
  const lambda = clamp(num("lambda", 1), 0.25, 2);
  const [picked, setPicked] = useState<number | null>(null);
  // Explore lab (unlocked only after the prediction is committed).
  const [labD, setLabD] = useState(d);
  const [labLambda, setLabLambda] = useState(lambda);
  const [whichPath, setWhichPath] = useState(false);
  const [revealed, setRevealed] = useState(0);
  // The reveal stays frozen on the setup the learner predicted against…
  const revealCurve = useMemo(() => interferenceCurve(d, lambda), [d, lambda]);
  const revealFringes = fringeCount(d, lambda);
  const revealPath = toCurvePath(revealCurve, 60, 52);
  // …while the lab screen follows the sliders and the which-path detector.
  const curve = useMemo(
    () => (whichPath ? envelopeCurve(labD, labLambda) : interferenceCurve(labD, labLambda)),
    [labD, labLambda, whichPath],
  );
  const labPath = useMemo(
    () => doubleSlitPath(labD, labLambda, 300, seed + 2, { whichPath }),
    [labD, labLambda, whichPath, seed],
  );
  const fringes = fringeCount(labD, labLambda);
  const labCurvePath = toCurvePath(curve, 56, 46);

  if (picked === null) {
    return (
      <SimShell prompt={prompt}>
        <p className="mb-2 text-[12px] text-zinc-600">
          Electrons fire one at a time at a barrier with <strong>two</strong> slits open (separation d = {d}, wavelength λ = {lambda}). Where they land is recorded.
        </p>
        <div className="flex flex-col gap-2">
          {SLIT_OPTIONS.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPicked(i)}
              className="rounded-lg border border-border-subtle bg-white px-3 py-2 text-left text-[12px] hover:border-violet-400"
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">Commit a prediction to run the sim.</p>
      </SimShell>
    );
  }

  const shown = labPath.slice(0, revealed);
  return (
    <SimShell prompt={prompt}>
      <svg viewBox="0 0 400 64" className="h-16 w-full" data-testid="sim-outcome" role="img" aria-label="Simulated double-slit intensity pattern">
        <line x1="0" y1="60" x2="400" y2="60" stroke="#d4d4d8" strokeWidth="1" />
        <path d={revealPath} fill="none" stroke="#7c3aed" strokeWidth="1.5" />
      </svg>
      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[12px] text-zinc-700">
        You predicted <strong>{SLIT_OPTIONS[picked]}</strong>. The screen shows{" "}
        <strong>{revealFringes} alternating fringes</strong> whose spacing is λ/d —{" "}
        {picked === 1 ? "interference, as you called." : "interference, not particle-like bands: each electron behaves as if it goes through both slits."}
      </p>
      <button type="button" onClick={() => { setPicked(null); setRevealed(0); setWhichPath(false); }} className="mt-1 text-[11px] text-violet-700 hover:underline">
        Predict again
      </button>

      <div className="mt-4 border-t border-violet-200 pt-3" data-testid="sim-lab">
        <p className="text-[12px] font-medium text-zinc-800">Now fire the electrons yourself</p>
        <p className="mb-3 mt-0.5 text-[11px] text-zinc-500">
          Send electrons through one at a time: each lands in a definite place, but the marks build
          fringes. Then turn on the which-path detector and try again.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabSlider
            testId="slider-d"
            label="Slit separation d"
            value={labD}
            min={0.5}
            max={5}
            step={0.1}
            display={labD.toFixed(1)}
            onChange={(v) => { setLabD(v); setRevealed(0); }}
          />
          <LabSlider
            testId="slider-lambda"
            label="Wavelength λ"
            value={labLambda}
            min={0.25}
            max={2}
            step={0.05}
            display={labLambda.toFixed(2)}
            onChange={(v) => { setLabLambda(v); setRevealed(0); }}
          />
        </div>
        <svg viewBox="0 0 400 76" className="mt-3 h-20 w-full" data-testid="lab-screen" role="img" aria-label={`${whichPath ? "which-path" : "interference"} screen with ${revealed} electron landing marks`}>
          <line x1="0" y1="58" x2="400" y2="58" stroke="#e4e4e7" strokeWidth="1" />
          <path d={labCurvePath} fill="none" stroke={whichPath ? "#f59e0b" : "#7c3aed"} strokeWidth="1.2" opacity={0.9} />
          <g data-testid="shots-strip">
            {shown.map((x, i) => (
              <circle
                key={i}
                cx={(x + 8) * 25}
                cy={63 + (i % 3) * 4.5}
                r={1.3}
                fill={whichPath ? "#b45309" : "#7c3aed"}
                opacity={0.8}
              />
            ))}
          </g>
        </svg>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="which-path"
            aria-pressed={whichPath}
            onClick={() => { setWhichPath((w) => !w); setRevealed(0); }}
            className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors ${
              whichPath
                ? "border-amber-300 bg-amber-100 text-amber-900"
                : "border-border-subtle bg-white text-zinc-700 hover:border-amber-300"
            }`}
          >
            {whichPath ? "◉" : "○"} Which-path detector: {whichPath ? "ON" : "OFF"}
          </button>
          <LabButton testId="fire-one" onClick={() => setRevealed((r) => Math.min(labPath.length, r + 1))}>
            Fire one
          </LabButton>
          <LabButton testId="fire-25" onClick={() => setRevealed((r) => Math.min(labPath.length, r + 25))}>
            +25
          </LabButton>
          <LabButton testId="fire-all" onClick={() => setRevealed(labPath.length)}>
            Fire all 300
          </LabButton>
          <LabButton testId="lab-reset" onClick={() => setRevealed(0)}>
            Reset
          </LabButton>
          <span className="ml-auto text-[12px] text-zinc-600" data-testid="lab-count">
            {revealed} / 300 electrons
          </span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500" data-testid="which-path-note">
          {whichPath
            ? `Detector ON: recording which slit each electron used destroys the interference — the marks follow two single-slit spreads and no fringes build.`
            : `Detector OFF: no path information leaks out, the two routes combine — bright fringes where the waves reinforce, dark bands where they cancel. ≈ ${fringes} across this screen, spacing ∝ λ/d.`}
        </p>
      </div>
    </SimShell>
  );
}

export function Sim({ component, seed }: { component: SimComponent; seed: number }) {
  if (component.template === "two-state-prob") return <TwoStateSim values={component.params.values} prompt={component.predictPrompt} seed={seed} />;
  if (component.template === "double-slit") return <DoubleSlitSim values={component.params.values} prompt={component.predictPrompt} seed={seed} />;
  return (
    <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4 text-[13px] text-zinc-600" data-testid="sim-placeholder">
      {component.predictPrompt}
      <p className="mt-1 text-[11px] text-zinc-400">Sim template “{component.template}” coming soon.</p>
    </div>
  );
}
