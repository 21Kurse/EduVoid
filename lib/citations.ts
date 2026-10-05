/**
 * Citation plumbing for the claims UI (T8): map claims to their cited
 * passages and sources using only what the SSE events already carry
 * (sources event = metadata, claims event = passages with text + url).
 * Pure functions so they are unit-testable without React.
 */
import type { Contradiction, ExtractedClaim } from "./source.ts";

export type PassageLite = { id: string; text: string; url: string; sourceId: string };
export type SourceLite = { id: string; title: string; url: string; authority: string };

export type CitedPassage = {
  id: string;
  text: string;
  url: string;
  source: { id: string; title: string; url: string; authority: string } | null;
};

export type CitationIndex = {
  passageById: Map<string, PassageLite>;
  sourceById: Map<string, SourceLite>;
};

export function buildCitationIndex(sources: SourceLite[], passages: PassageLite[]): CitationIndex {
  return {
    passageById: new Map(passages.map((p) => [p.id, p])),
    sourceById: new Map(sources.map((s) => [s.id, s])),
  };
}

/** Resolve a claim's cited passages, joining source metadata where known. */
export function claimCitations(claim: ExtractedClaim, index: CitationIndex): CitedPassage[] {
  const out: CitedPassage[] = [];
  for (const pid of claim.passageIds) {
    const p = index.passageById.get(pid);
    if (!p) continue;
    out.push({ ...p, source: index.sourceById.get(p.sourceId) ?? null });
  }
  return out;
}

/** Expand contradictions into display rows with the two claim texts. */
export function contradictionRows(
  contradictions: Contradiction[],
  claims: ExtractedClaim[],
): { a: ExtractedClaim; b: ExtractedClaim; note: string }[] {
  const byId = new Map(claims.map((c) => [c.id, c]));
  return contradictions
    .map((c) => {
      const a = byId.get(c.claimIds[0]);
      const b = byId.get(c.claimIds[1]);
      return a && b ? { a, b, note: c.note } : null;
    })
    .filter((r): r is { a: ExtractedClaim; b: ExtractedClaim; note: string } => r !== null);
}
