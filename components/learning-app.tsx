"use client";

/**
 * App shell (T2): single-question home -> loading -> learning view.
 * Runs entirely from the fixture — no live API calls (T2 acceptance).
 */

import { useEffect, useState } from "react";
import { curriculumSpecSchema, type CurriculumSpec } from "@/lib/spec";
import { useLearningState } from "@/lib/store";
import fixtureJson from "@/fixtures/qm-superposition.json";
import { Mindmap } from "./mindmap";
import { ConceptPanel } from "./concept-panel";

type Phase = "home" | "loading" | "learning";

const LOAD_STEPS = [
  "Searching sources",
  "Extracting claims",
  "Planning concepts",
  "Generating content",
  "Verifying against passages",
];

function LoadingView({ topic }: { topic: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, LOAD_STEPS.length - 1)),
      600,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-violet-600" />
      <p className="text-[15px] text-zinc-700">
        Building your learning app for &ldquo;{topic}&rdquo;
      </p>
      <p
        className="rounded-lg bg-amber-50 px-3 py-1 text-[12px] text-amber-700"
        data-testid="fixture-banner-loading"
      >
        Fixture run — placeholder content, not live generation
      </p>
      <div className="flex flex-col gap-1.5 text-[13px]">
        {LOAD_STEPS.map((s, i) => (
          <p
            key={s}
            className={
              i < step
                ? "text-zinc-400 line-through"
                : i === step
                  ? "text-zinc-900"
                  : "text-zinc-300"
            }
          >
            {s}&hellip;
          </p>
        ))}
      </div>
    </div>
  );
}

export function LearningApp() {
  const [phase, setPhase] = useState<Phase>("home");
  const [topic, setTopic] = useState("");
  const [spec, setSpec] = useState<CurriculumSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { state, selectConcept } = useLearningState();

  async function start(t: string) {
    setTopic(t);
    setPhase("loading");
    setError(null);
    try {
      // T2 runs from the committed fixture, bundled at build time — no live
      // API calls. The live pipeline replaces this path in T6.
      const parsed = curriculumSpecSchema.safeParse(fixtureJson);
      if (!parsed.success) {
        throw new Error("fixture failed schema validation");
      }
      // Small delay so the staged loading UX is visible (fixture loads instantly).
      await new Promise((r) => setTimeout(r, 1800));
      setSpec(parsed.data);
      setPhase("learning");
      selectConcept(parsed.data.concepts[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    }
  }

  if (phase === "home") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <main className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            What do you want to learn?
          </h1>
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (topic.trim()) void start(topic.trim());
            }}
          >
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. quantum superposition"
              className="h-12 flex-1 rounded-xl border border-border-subtle px-4 text-[15px] outline-none placeholder:text-zinc-400 focus:border-violet-400"
              aria-label="Topic"
            />
            <button
              type="submit"
              disabled={!topic.trim()}
              className="h-12 rounded-xl bg-violet-600 px-5 text-[14px] font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
            >
              Learn
            </button>
          </form>
          <p className="text-[12px] text-zinc-400">
            Demo build: any topic starts the quantum-superposition fixture run.
          </p>
        </main>
      </div>
    );
  }

  if (phase === "loading") {
    if (error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[15px] text-red-700">
            Couldn&apos;t build the app ({error}).
          </p>
          <button
            type="button"
            onClick={() => setPhase("home")}
            className="rounded-lg border border-border-subtle px-4 py-2 text-[13px] hover:bg-zinc-50"
          >
            Back
          </button>
        </div>
      );
    }
    return <LoadingView topic={topic} />;
  }

  if (!spec) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="h-[46vh] border-b border-border-subtle lg:h-auto lg:flex-1 lg:border-b-0">
        <Mindmap spec={spec} learning={state} onSelect={selectConcept} />
      </div>
      <div className="min-h-0 flex-1 lg:max-w-[46%]">
        <ConceptPanel
          spec={spec}
          learning={state}
          onAnswered={() => undefined}
        />
      </div>
    </div>
  );
}
