"use client";

/**
 * Hero sim (T10, §5.2 + §13.6): LLM-generated canvas/JS rendered inside a
 * locked-down iframe (sandbox="allow-scripts", CSP-injected srcdoc). A
 * ready message must arrive within the timeout; any error message, missing
 * ready ping, or a failed static check swaps in the paired template sim.
 */
import { useEffect, useRef, useState } from "react";
import { HERO_READY_TIMEOUT_MS, wrapHeroCode } from "@/lib/hero-sim";
import { simTemplateOrDefault } from "@/lib/sim-templates";
import { Sim } from "./sims";
import type { Component } from "@/lib/spec";

export type HeroFallback = {
  template: string;
  values: Record<string, number | string | boolean>;
  predictPrompt: string;
};

function fallbackComponent(f: HeroFallback): Extract<Component, { type: "sim" }> {
  // A reserved template id (older captures) renders as the implemented
  // two-state sim, never as a placeholder — the fallback must always work.
  return {
    type: "sim",
    template: simTemplateOrDefault(f.template),
    params: { values: f.values },
    predictPrompt: f.predictPrompt,
  };
}

export function HeroSim({ code, fallback }: { code: string; fallback: HeroFallback }) {
  // "checking" → "live" on a ready ping; anything else → "fallback".
  const [status, setStatus] = useState<"checking" | "live" | "fallback">("checking");
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { type?: string; status?: string } | null;
      if (data?.type !== "hero-sim") return;
      if (data.status === "ready") setStatus("live");
      else setStatus("fallback");
    };
    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "checking" ? "fallback" : s));
    }, HERO_READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [code]);

  if (status === "fallback") {
    return (
      <div data-testid="hero-fallback">
        <p className="mb-2 text-[11px] text-zinc-400">
          The generated demo did not render cleanly — showing the reliable template sim instead.
        </p>
        <Sim component={fallbackComponent(fallback)} seed={7} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-2" data-testid="hero-sim">
      <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-violet-500">generated demo</p>
      <iframe
        ref={frameRef}
        title="Hero simulation"
        sandbox="allow-scripts"
        srcDoc={wrapHeroCode(code)}
        className="h-56 w-full rounded-lg border-0"
      />
      {status === "checking" && (
        <p className="px-2 pt-1 text-[11px] text-zinc-400">validating generated demo…</p>
      )}
    </div>
  );
}
