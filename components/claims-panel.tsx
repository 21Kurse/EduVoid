"use client";

/**
 * Sources & claims panel (G3 finding 1): claims for the CURRENT concept
 * only, numbered 1..n in display order (G3 finding 2), each collapsed to a
 * one-line statement with a status icon; expanding shows the supporting
 * passage text and a source link. Contradictions involving this concept's
 * claims render as explicit "sources disagree" rows (§4.1).
 *
 * variant "panel": sticky right column on desktop (always open).
 * variant "inline": collapsible section below the explainer on mobile.
 */
import { useEffect, useRef, useState } from "react";
import {
  buildCitationIndex,
  claimCitations,
  contradictionRows,
} from "@/lib/citations";
import type { Contradiction, ExtractedClaim } from "@/lib/source";

type Props = {
  claims: ExtractedClaim[];
  allClaims: ExtractedClaim[];
  contradictions: Contradiction[];
  passages: { id: string; text: string; url: string; sourceId: string }[];
  sources: { id: string; title: string; url: string; authority: string }[];
  highlightClaim: string | null;
  variant: "panel" | "inline";
};

export function ClaimsPanel({
  claims,
  allClaims,
  contradictions,
  passages,
  sources,
  highlightClaim,
  variant,
}: Props) {
  const [openState, setOpenState] = useState(false);
  const [openClaim, setOpenClaim] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Panel variant is always open; inline opens on toggle or when a citation
  // marker is clicked (no setState-in-effect: derived from props).
  const open = variant === "panel" || openState || highlightClaim !== null;
  const index = buildCitationIndex(sources, passages);
  const ownIds = new Set(claims.map((c) => c.id));
  const rows = contradictionRows(contradictions, allClaims).filter(
    (r) => ownIds.has(r.a.id) || ownIds.has(r.b.id),
  );
  const flagged = claims.filter((c) => c.status === "flagged").length;

  // A clicked inline marker scrolls to the claim row in whichever instance
  // is actually visible (desktop aside vs mobile inline section).
  useEffect(() => {
    if (!highlightClaim || (variant === "inline" && !open)) return;
    const el = listRef.current?.querySelector(
      `[data-claim-row="${highlightClaim}"]`,
    ) as HTMLElement | null;
    if (el && el.offsetParent !== null) el.scrollIntoView({ block: "nearest" });
  }, [highlightClaim, open, variant]);

  return (
    <div
      className="rounded-xl border border-border-subtle bg-white"
      data-testid={`claims-${variant}`}
    >
      {variant === "inline" ? (
        <button
          type="button"
          onClick={() => setOpenState((o) => !o)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-zinc-700"
          aria-expanded={open}
          data-testid="claims-toggle"
        >
          Sources &amp; claims
          <span className="text-[11px] font-normal text-zinc-400">
            {claims.length} claims{flagged > 0 ? ` · ${flagged} flagged` : ""}
          </span>
          <span className="ml-auto text-zinc-400">{open ? "▾" : "▸"}</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-zinc-700">
          Sources &amp; claims
          <span className="text-[11px] font-normal text-zinc-400">
            {claims.length} claims{flagged > 0 ? ` · ${flagged} flagged` : ""}
          </span>
        </div>
      )}
      {open && (
        <div
          ref={listRef}
          className="space-y-2 border-t border-border-subtle px-3 py-3 text-[12px]"
        >
          {claims.length === 0 && (
            <p className="px-1 py-2 text-zinc-400">
              No claims were grounded for this concept yet.
            </p>
          )}
          {rows.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  <span className="font-medium">⚠ sources disagree:</span> {r.note}
                  <p className="mt-1 text-zinc-700">“{r.a.text}”</p>
                  <p className="text-zinc-700">vs “{r.b.text}”</p>
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-1.5">
            {claims.map((c, i) => {
              const cited = claimCitations(c, index);
              const expanded = openClaim === c.id;
              const highlighted = highlightClaim === c.id;
              return (
                <li
                  key={c.id}
                  data-claim-row={c.id}
                  className={`rounded-lg border transition-shadow ${
                    highlighted ? "border-violet-400 ring-2 ring-violet-200" : "border-border-subtle"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenClaim(expanded ? null : c.id)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left"
                    aria-expanded={expanded}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-medium text-zinc-600">
                      {i + 1}
                    </span>
                    <span className={c.status === "flagged" ? "text-red-600" : "text-emerald-600"}>
                      {c.status === "flagged" ? "✗" : "✓"}
                    </span>
                    <span className="flex-1 text-zinc-700">{c.text}</span>
                    <span className="text-zinc-400">{expanded ? "▾" : "▸"}</span>
                  </button>
                  {expanded && (
                    <div className="space-y-2 border-t border-border-subtle px-3 py-2">
                      {c.status === "flagged" && c.flagReason && (
                        <p className="rounded bg-red-50 px-2 py-1 text-red-700">flagged: {c.flagReason}</p>
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
