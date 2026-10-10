/**
 * Claim display numbering (G3 finding 2): claims are numbered 1..n per
 * concept in display order, and the explainer's inline citation markers use
 * the same numbers. Pure functions so the mapping is testable.
 *
 * The generator is instructed to append [[claim-id]] markers; this module
 * converts known markers to display-number links and strips everything
 * unresolved, so no raw "claim N" text can survive into the UI.
 */

import type { Claim } from "./spec";

/** claimId -> display number (1-based, per concept, in display order). */
export type ClaimNumbers = Map<string, number>;

export function numberClaims(claims: Pick<Claim, "id">[]): ClaimNumbers {
  return new Map(claims.map((c, i) => [c.id, i + 1]));
}

/** Words whose trailing period is not a sentence end. */
const ABBREVIATION = /\b(?:e\.g|i\.e|vs|etc|cf|ca|Fig|Eq|Dr|Mr|Ms|No|approx|resp)\.$/i;

/**
 * Readability pass (owner request, Oct 10: write simple, build intuition).
 * The flash model sometimes returns the whole explanation as one unbroken
 * block — 700+ characters with no blank line — which renders as a wall of
 * text. When, and only when, the model gave no structure of its own (no blank
 * lines, no line breaks, no headings, no code fence) and the text is long
 * enough to need it, group sentences into short paragraphs.
 *
 * Deliberately conservative: existing structure always wins, so an explainer
 * with paragraphs, lists or headings is returned exactly as written. Pure and
 * deterministic; it only moves whitespace, never edits words.
 */
export function paragraphize(markdown: string): string {
  const text = markdown.trim();
  if (text.includes("\n\n") || text.includes("\n")) return markdown;
  if (text.includes("```") || /^#{1,6}\s/m.test(text)) return markdown;
  if (text.length < 300) return markdown;

  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9$])/).filter((s) => s.trim().length > 0);
  if (sentences.length < 4) return markdown;

  // A split after an abbreviation (e.g. atlases, i.e. ...) is glued back.
  const merged: string[] = [];
  for (const s of sentences) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && ABBREVIATION.test(prev)) merged[merged.length - 1] = `${prev} ${s}`;
    else merged.push(s);
  }

  const perParagraph = merged.length > 8 ? 3 : 2;
  const paragraphs: string[] = [];
  for (let i = 0; i < merged.length; i += perParagraph) {
    paragraphs.push(merged.slice(i, i + perParagraph).join(" "));
  }
  return paragraphs.join("\n\n");
}

/**
 * Rewrite the explainer markdown:
 * - `[[claim-id]]` markers for claims in `numbers` become
 *   `[n](#claim-<id>)` links (rendered as clickable superscripts).
 * - Every unresolved marker is stripped: unknown `[[...]]` tokens, prose
 *   references like "claim 9", and bare `[9]` brackets that do not belong
 *   to a generated marker link.
 * The output never contains a raw "claim N" reference or an unresolved
 * marker, so the UI can assert on that invariant.
 */
export function postProcessExplainer(
  markdown: string,
  numbers: ClaimNumbers,
): { markdown: string; resolved: number; stripped: number } {
  let resolved = 0;
  let stripped = 0;

  let out = markdown.replace(/\[\[([a-z0-9-]+)\]\]/gi, (_m, id: string) => {
    const n = numbers.get(id);
    if (n === undefined) {
      stripped += 1;
      return "";
    }
    resolved += 1;
    return `[${n}](#claim-${id})`;
  });

  // Legacy/stray prose references from earlier prompts: "claim 9", "(claim 9)".
  out = out.replace(/\(?\bclaim\s+\d+\b\)?\s*/gi, () => {
    stripped += 1;
    return "";
  });

  // Bare bracketed numbers, but never the marker links we just emitted
  // (`[3](#claim-...)`) and not markdown reference links we did not write.
  out = out.replace(/\[(\d+)\](?!\(#claim-)/g, () => {
    stripped += 1;
    return "";
  });

  // Collapse doubled spaces left behind by removals, then break up a wall of
  // text if the model gave no structure of its own.
  out = out.replace(/[ \t]{2,}/g, " ");
  out = paragraphize(out);
  return { markdown: out, resolved, stripped };
}

/** True when the post-processed explainer has no resolvable leftovers. */
export function explainerIsClean(markdown: string): boolean {
  return !/\[\[[a-z0-9-]+\]\]/i.test(markdown) && !/\bclaim\s+\d+\b/i.test(markdown) && !/\[\d+\](?!\(#claim-)/.test(markdown);
}
