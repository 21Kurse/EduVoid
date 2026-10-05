import { describe, expect, it } from "vitest";
import { buildCitationIndex, claimCitations, contradictionRows } from "../lib/citations";
import type { Contradiction, ExtractedClaim } from "../lib/source";

const sources = [
  { id: "src-1", title: "Bayes for beginners", url: "https://example.com/a", authority: "university" },
  { id: "src-2", title: "Statistical reasoning", url: "https://example.com/b", authority: "textbook" },
];
const passages = [
  { id: "p-1", text: "Posterior odds equal prior odds times the likelihood ratio.", url: "https://example.com/a", sourceId: "src-1" },
  { id: "p-2", text: "Bayes' theorem relates conditional probabilities.", url: "https://example.com/b", sourceId: "src-2" },
];
const claims: ExtractedClaim[] = [
  { id: "c-1", text: "Posterior = prior x likelihood ratio.", passageIds: ["p-1"], sourceIds: ["src-1"], status: "supported" },
  { id: "c-2", text: "Bayes relates conditionals.", passageIds: ["p-2", "p-ghost"], sourceIds: ["src-2"], status: "supported" },
  { id: "c-3", text: "Orphan claim.", passageIds: ["p-ghost"], sourceIds: ["src-1"], status: "flagged", flagReason: "verifier: not supported" },
];
const contradictions: Contradiction[] = [
  { claimIds: ["c-1", "c-2"], note: "different scopes" },
  { claimIds: ["c-1", "c-ghost"], note: "dangling" },
];

describe("citations", () => {
  it("resolves a claim's passages with source metadata joined", () => {
    const idx = buildCitationIndex(sources, passages);
    const cited = claimCitations(claims[0], idx);
    expect(cited).toHaveLength(1);
    expect(cited[0].text).toMatch(/likelihood ratio/);
    expect(cited[0].source?.title).toBe("Bayes for beginners");
    expect(cited[0].source?.url).toBe("https://example.com/a");
  });

  it("drops unknown passage ids and claims with no resolvable passages", () => {
    const idx = buildCitationIndex(sources, passages);
    expect(claimCitations(claims[1], idx)).toHaveLength(1); // p-ghost dropped
    expect(claimCitations(claims[2], idx)).toHaveLength(0); // orphan
  });

  it("expands contradictions to claim rows and skips dangling pairs", () => {
    const rows = contradictionRows(contradictions, claims);
    expect(rows).toHaveLength(1);
    expect(rows[0].a.id).toBe("c-1");
    expect(rows[0].b.id).toBe("c-2");
    expect(rows[0].note).toBe("different scopes");
  });
});
