"use client";

/**
 * Claims & citations view (T8): every extracted claim expands to its cited
 * passage text plus a source link that opens in a new tab. Contradictions
 * render as explicit "sources disagree" rows (§4.1). Flagged claims show
 * the verifier's reason — the honest-failure demo moment.
 */
import { useState } from "react";
import {
  buildCitationIndex,
  claimCitations,
  contradictionRows,
  type CitationIndex,
} from "@/lib/citations";
import type { Contradiction, ExtractedClaim } from "@/lib/source";

type Props = {
  claims: ExtractedClaim[];
  contradictions: Contradiction[];
  passages: { id: string; text: string; url: string; sourceId: string }[];
  sources: { id: string; title: string; url: string; authority: string }[];
};

export function ClaimsList({ claims, contradictions, passages, sources }: Props) {
  const [open, setOpen] = useState(false);
  const [openClaim, setOpenClaim] = useState<string | null>(null);
  const index: CitationIndex = buildCitationIndex(sources, passages);
  const rows = contradictionRows(contradictions, claims);
  const flagged = claims.filter((c) => c.status === "flagged").length;

  return (
    <div className="rounded-xl border border-border-subtle bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-zinc-700"
        aria-expanded={open}
      >
        Claims &amp; citations
        <span className="text-[11px] font-normal text-zinc-400">
          {claims.length} claims{flagged > 0 ? ` · ${flagged} flagged` : ""}
          {rows.length > 0 ? ` · ${rows.length} disagreements` : ""}
        </span>
        <span className="ml-auto text-zinc-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto border-t border-border-subtle px-4 py-3 text-[12px]">
          {rows.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800"
                >
                  <span className="font-medium">⚠ sources disagree:</span> {r.note}
                  <p className="mt-1 text-zinc-700">“{r.a.text}”</p>
                  <p className="text-zinc-700">vs “{r.b.text}”</p>
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-1.5">
            {claims.map((c) => {
              const cited = claimCitations(c, index);
              const expanded = openClaim === c.id;
              return (
                <li key={c.id} className="rounded-lg border border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setOpenClaim(expanded ? null : c.id)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left"
                    aria-expanded={expanded}
                  >
                    <span className={c.status === "flagged" ? "text-red-600" : "text-emerald-600"}>
                      {c.status === "flagged" ? "✗" : "✓"}
                    </span>
                    <span className="flex-1 text-zinc-700">{c.text}</span>
                    <span className="text-zinc-400">{expanded ? "▾" : "▸"}</span>
                  </button>
                  {expanded && (
                    <div className="space-y-2 border-t border-border-subtle px-3 py-2">
                      {c.status === "flagged" && c.flagReason && (
                        <p className="rounded bg-red-50 px-2 py-1 text-red-700">
                          flagged: {c.flagReason}
                        </p>
                      )}
                      {cited.length === 0 && (
                        <p className="text-zinc-400">No passage available for this claim.</p>
                      )}
                      {cited.map((p) => (
                        <div key={p.id}>
                          <p className="text-zinc-600">“{p.text}”</p>
                          {p.source && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-violet-700 underline-offset-2 hover:underline"
                            >
                              [{p.source.authority}] {p.source.title} ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
