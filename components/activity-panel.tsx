"use client";

/**
 * Agent-activity panel (§13.10): the "not just a wrapper" demo asset.
 * Collapsible; shows stage, sources found, claims extracted/rejected,
 * and the live message feed from the pipeline.
 */

import { useState } from "react";

export type ActivityFeed = {
  stage: string;
  messages: string[];
  sources: { id: string; title: string; url: string; authority: string }[];
  claimsExtracted: number;
  claimsRejected: number;
  conceptsDone: number;
  conceptsTotal: number;
};

export function ActivityPanel({ feed }: { feed: ActivityFeed }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto rounded-xl border border-border-subtle bg-white/95 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-zinc-700"
        aria-expanded={open}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            feed.stage === "done" ? "bg-emerald-500" : "animate-pulse bg-violet-500"
          }`}
        />
        Agents: {feed.stage}
        <span className="text-zinc-400">
          · {feed.sources.length} sources · {feed.claimsExtracted} claims
          {feed.claimsRejected > 0 ? ` · ${feed.claimsRejected} rejected` : ""}
        </span>
        <span className="ml-auto text-zinc-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border-subtle px-3 py-2 text-[12px]">
          <p className="mb-1 text-zinc-500">
            Concepts done: {feed.conceptsDone}/{feed.conceptsTotal}
          </p>
          <ul className="mb-2 space-y-1">
            {feed.sources.map((s) => (
              <li key={s.id} className="truncate text-zinc-600">
                <span className="text-zinc-400">[{s.authority}]</span>{" "}
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-violet-700">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
          <ol className="space-y-0.5 text-zinc-500">
            {feed.messages.slice(-12).map((m, i) => (
              <li key={i}>· {m}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
