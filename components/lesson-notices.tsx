"use client";

/**
 * Notice surfaces for hardened failure paths (T14):
 *  - CachedRunBanner: labels the demo-safe cached run. The phrase "cached run"
 *    is exact and must never be presented as live (§7, §15.3).
 *  - TopicRefusedPanel: the friendly, non-crashing refusal for harmful topics
 *    (§13.9) — no lesson is generated for a refused topic.
 */
import Link from "next/link";
import { CACHED_RUN_LABEL } from "@/lib/cached-run";

export function CachedRunBanner({ capturedAt }: { capturedAt: string }) {
  const when = capturedAt ? new Date(capturedAt).toLocaleString() : "an earlier session";
  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900"
      data-testid="cached-run-banner"
    >
      <span className="font-semibold">{CACHED_RUN_LABEL}</span> — live generation was unavailable, so
      this is a previous verified run for the demo topic (captured {when}). Not live.
    </div>
  );
}

export function TopicRefusedPanel({ topic, message }: { topic: string; message: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* No live badge here: a refused topic never starts a generation run. */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-[12px]">
        <span className="font-medium text-zinc-700">{topic}</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div
          className="max-w-lg rounded-2xl border border-border-subtle bg-white p-6 text-center"
          data-testid="topic-refused"
        >
          <p className="text-[15px] font-medium text-zinc-900">Let&apos;s pick a different topic</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{message}</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg border border-border-subtle px-4 py-2 text-[13px] transition-colors hover:bg-zinc-50"
            data-testid="refusal-home-link"
          >
            Try another topic
          </Link>
        </div>
      </div>
    </div>
  );
}
