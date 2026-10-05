"use client";

/**
 * Predict-then-reveal sims (T9, §5.2 + §13.6): hand-built templates only —
 * the LLM supplies parameters and the prediction prompt, never sim code.
 * Each sim is LOCKED behind a committed prediction, then compares the
 * user's prediction against the outcome.
 */
import { useMemo, useState } from "react";
import type { Component } from "@/lib/spec";
import { binomialSpread, clamp, fringeCount, interferenceCurve, twoStateCounts } from "@/lib/sim-math";

type SimComponent = Extract<Component, { type: "sim" }>;

function SimShell({ prompt, children }: { prompt: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4" data-testid="sim">
      <p className="mb-3 text-[13px] font-medium text-zinc-900">{prompt}</p>
      {children}
    </div>
  );
}

function TwoStateSim({ values, prompt, seed }: { values: Record<string, number | string | boolean>; prompt: string; seed: number }) {
  const num = (k: string, dflt: number) => {
    const v = Number(values[k]);
    return Number.isFinite(v) ? v : dflt;
  };
  const p = clamp(num("p", 0.5), 0.05, 0.95);
  const n = Math.round(clamp(num("n", 50), 10, 200));
  const [prediction, setPrediction] = useState("");
  const [committed, setCommitted] = useState<number | null>(null);
  const outcome = useMemo(() => twoStateCounts(p, n, seed), [p, n, seed]);
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
        <button type="button" onClick={() => { setCommitted(null); setPrediction(""); }} className="text-[11px] text-violet-700 hover:underline">
          Run again with a new prediction
        </button>
      </div>
    </SimShell>
  );
}

const SLIT_OPTIONS = ["Two bright bands", "Alternating bright and dark fringes", "One central band", "A uniform smear"] as const;

function DoubleSlitSim({ values, prompt }: { values: Record<string, number | string | boolean>; prompt: string; seed: number }) {
  const num = (k: string, dflt: number) => {
    const v = Number(values[k]);
    return Number.isFinite(v) ? v : dflt;
  };
  const d = clamp(num("d", 2), 0.5, 5);
  const lambda = clamp(num("lambda", 1), 0.25, 2);
  const [picked, setPicked] = useState<number | null>(null);
  const curve = useMemo(() => interferenceCurve(d, lambda), [d, lambda]);
  const fringes = fringeCount(d, lambda);
  const max = Math.max(...curve.map((c) => c.i));
  const path = curve
    .map((c, k) => `${k === 0 ? "M" : "L"} ${(c.x + 8) * 25} ${60 - (c.i / max) * 52}`)
    .join(" ");

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

  return (
    <SimShell prompt={prompt}>
      <svg viewBox="0 0 400 64" className="h-16 w-full" data-testid="sim-outcome" role="img" aria-label="Simulated double-slit intensity pattern">
        <line x1="0" y1="60" x2="400" y2="60" stroke="#d4d4d8" strokeWidth="1" />
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth="1.5" />
      </svg>
      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[12px] text-zinc-700">
        You predicted <strong>{SLIT_OPTIONS[picked]}</strong>. The screen shows{" "}
        <strong>{fringes} alternating fringes</strong> whose spacing is λ/d —{" "}
        {picked === 1 ? "interference, as you called." : "interference, not particle-like bands: each electron behaves as if it goes through both slits."}
      </p>
      <button type="button" onClick={() => setPicked(null)} className="mt-1 text-[11px] text-violet-700 hover:underline">
        Predict again
      </button>
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
