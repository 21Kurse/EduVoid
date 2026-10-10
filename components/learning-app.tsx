"use client";

/**
 * App shell: single-question home -> live run (T6 pipeline) with a visible
 * failure state (the demo-safe "cached run" fallback lives inside LiveLesson, §7).
 */
import { useEffect, useState } from "react";
import { LiveLesson } from "./live-lesson";
import { HOME_EVENT } from "./home-button";

type Phase = "home" | "loading" | "learning" | "error";

export function LearningApp() {
  const [phase, setPhase] = useState<Phase>("home");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The top-left wordmark asks for the question screen. The lesson lives at "/"
  // as a phase, so a link to "/" cannot do this on its own (owner request).
  useEffect(() => {
    const goHome = () => {
      setError(null);
      setPhase("home");
    };
    window.addEventListener(HOME_EVENT, goHome);
    return () => window.removeEventListener(HOME_EVENT, goHome);
  }, []);

  function start(t: string) {
    setTopic(t);
    setPhase("loading");
  }

  if (phase === "home") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <main className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">What do you want to learn?</h1>
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (topic.trim()) start(topic.trim());
            }}
          >
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Bayes' theorem"
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
            Agents search sources, extract claims, plan and generate a verified learning app.
          </p>
        </main>
      </div>
    );
  }

  if (phase === "loading" || phase === "learning") {
    // LiveLesson owns the loading state from here (skeleton -> concepts ->
    // done); onFail is the only way back out to the error phase.
    return <LiveLesson topic={topic} onFail={(d) => { setError(d); setPhase("error"); }} />;
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] text-red-700">Generation failed: {error}</p>
        <button
          type="button"
          onClick={() => setPhase("home")}
          className="rounded-lg border border-border-subtle px-4 py-2 text-[13px] hover:bg-zinc-50"
        >
          Try another topic
        </button>
      </div>
    );
  }

  return <LiveLesson topic={topic} onFail={(d) => { setError(d); setPhase("error"); }} />;
}
