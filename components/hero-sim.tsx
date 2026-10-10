"use client";

/**
 * Hero sim (T10, §5.2 + §13.6): LLM-generated canvas/JS rendered inside a
 * locked-down iframe (sandbox="allow-scripts", CSP-injected srcdoc). A
 * ready message must arrive within the timeout; any error message, missing
 * ready ping, or a failed static check swaps in the paired template sim.
 */
import { useEffect, useRef, useState } from "react";
import {
  HERO_DEFAULT_HEIGHT,
  HERO_READY_TIMEOUT_MS,
  clampHeroHeight,
  wrapHeroCode,
} from "@/lib/hero-sim";
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

export function HeroSim({
  code,
  fallback,
  fallbackFits,
}: {
  code: string;
  fallback: HeroFallback;
  /**
   * Does the paired template sim fit this concept? Decided by the caller with
   * the same deterministic fit signal the "I don't get this" fallback uses
   * (lib/local-adapt.ts). Wrong fit → an unrelated experiment appears under
   * the concept, which is worse than showing no experiment at all.
   */
  fallbackFits: boolean;
}) {
  // "checking" → "live" on a ready ping; anything else → "fallback".
  const [status, setStatus] = useState<"checking" | "live" | "fallback">("checking");
  // The frame follows the demo's real content height (owner feedback: a
  // canvas + sliders demo was clipped at the old fixed height).
  const [height, setHeight] = useState(HERO_DEFAULT_HEIGHT);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { type?: string; status?: string; height?: number } | null;
      if (data?.type !== "hero-sim") return;
      // Height pings carry no verdict — never let one flip the state machine.
      if (data.status === "height") {
        if (typeof data.height === "number") setHeight(clampHeroHeight(data.height));
        return;
      }
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
          {fallbackFits
            ? "The generated demo did not render cleanly — showing the reliable template sim instead."
            : "The generated demo did not render cleanly, and no template simulation fits this concept — it is shown without one."}
        </p>
        {fallbackFits && <Sim component={fallbackComponent(fallback)} seed={7} />}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-2" data-testid="hero-sim">
      <div className="flex items-baseline justify-between px-2 pb-1">
        <p className="text-[11px] uppercase tracking-wide text-violet-500">generated demo</p>
        <p className="text-[10px] text-zinc-400">interactive — drag the controls inside</p>
      </div>
      <iframe
        ref={frameRef}
        title="Hero simulation"
        sandbox="allow-scripts"
        srcDoc={wrapHeroCode(code)}
        className="block w-full rounded-lg border-0"
        style={{ height }}
      />
      {status === "checking" && (
        <p className="px-2 pt-1 text-[11px] text-zinc-400">validating generated demo…</p>
      )}
    </div>
  );
}
