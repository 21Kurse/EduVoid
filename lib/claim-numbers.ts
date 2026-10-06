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

  // Collapse doubled spaces left behind by removals.
  out = out.replace(/[ \t]{2,}/g, " ");
  return { markdown: out, resolved, stripped };
}

/** True when the post-processed explainer has no resolvable leftovers. */
export function explainerIsClean(markdown: string): boolean {
  return !/\[\[[a-z0-9-]+\]\]/i.test(markdown) && !/\bclaim\s+\d+\b/i.test(markdown) && !/\[\d+\](?!\(#claim-)/.test(markdown);
}
