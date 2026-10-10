import { describe, expect, it } from "vitest";
import {
  explainerIsClean,
  numberClaims,
  paragraphize,
  postProcessExplainer,
} from "../lib/claim-numbers";

const claims = [{ id: "claim-a-1" }, { id: "claim-a-2" }, { id: "claim-a-3" }];

describe("numberClaims (G3 finding 2)", () => {
  it("numbers claims 1..n in display order", () => {
    const numbers = numberClaims(claims);
    expect([...numbers.entries()]).toEqual([
      ["claim-a-1", 1],
      ["claim-a-2", 2],
      ["claim-a-3", 3],
    ]);
  });
});

describe("postProcessExplainer (G3 finding 2)", () => {
  it("converts known [[claim-id]] markers to numbered links", () => {
    const numbers = numberClaims(claims);
    const r = postProcessExplainer("States add. [[claim-a-2]] More text.", numbers);
    expect(r.markdown).toContain("[2](#claim-claim-a-2)");
    expect(r.resolved).toBe(1);
    expect(r.stripped).toBe(0);
  });

  it("strips markers for claims not assigned to this concept", () => {
    const numbers = numberClaims(claims);
    const r = postProcessExplainer("A [[claim-other-9]] B", numbers);
    expect(r.markdown).toBe("A B"); // marker stripped, doubled space collapsed
    expect(r.resolved).toBe(0);
    expect(r.stripped).toBe(1);
  });

  it("strips raw 'claim N' prose and bare [N] brackets", () => {
    const numbers = numberClaims(claims);
    const r = postProcessExplainer(
      "This holds per claim 9 and also [7] in the notes.",
      numbers,
    );
    expect(r.markdown).not.toMatch(/claim\s+9/i);
    expect(r.markdown).not.toMatch(/\[7\]/);
    expect(r.stripped).toBe(2);
  });

  it("keeps its own marker links when stripping bare [N] brackets", () => {
    const numbers = numberClaims(claims);
    const r = postProcessExplainer("X [[claim-a-1]] Y", numbers);
    expect(r.markdown).toContain("[1](#claim-claim-a-1)");
    expect(explainerIsClean(r.markdown)).toBe(true);
  });

  it("invariant: after processing, no raw claim N text or unresolved marker survives", () => {
    const numbers = numberClaims(claims);
    const dirty =
      "Facts [[claim-a-3]] and [[claim-zzz]] hold; see claim 12 or [4] for details.";
    const r = postProcessExplainer(dirty, numbers);
    expect(explainerIsClean(r.markdown)).toBe(true);
    expect(r.markdown).toContain("[3](#claim-claim-a-3)");
    expect(r.resolved).toBe(1);
  });
});

const WALL =
  "Light arrives as discrete packets called photons. Each photon carries energy proportional to its frequency. " +
  "When a photon hits a metal surface it can transfer that energy to one electron. The electron escapes only if " +
  "the energy exceeds the work function of the metal. Extra energy becomes kinetic energy of the ejected electron. " +
  "Brighter light means more photons rather than more energetic ones.";

describe("paragraphize (readability pass)", () => {
  it("breaks a long single-block explainer into short paragraphs", () => {
    const out = paragraphize(WALL);
    const paragraphs = out.split("\n\n");
    expect(paragraphs.length).toBeGreaterThan(2);
    for (const p of paragraphs) expect(p.length).toBeGreaterThan(10);
    // Only whitespace moved: the words and their order are untouched.
    expect(out.replace(/\s+/g, " ")).toBe(WALL.replace(/\s+/g, " "));
  });

  it("leaves structure the model wrote of its own alone", () => {
    expect(paragraphize("First paragraph.\n\nSecond paragraph.")).toBe("First paragraph.\n\nSecond paragraph.");
    expect(paragraphize(WALL.replace(" ", "\n"))).toContain("\n");
    expect(paragraphize("# Heading\n" + WALL)).toContain("# Heading\n" + WALL.slice(0, 20));
  });

  it("leaves short explainers alone — one clean paragraph is fine", () => {
    const short = "Photons carry energy proportional to frequency. That is the whole idea.";
    expect(paragraphize(short)).toBe(short);
  });

  it("does not split after an abbreviation", () => {
    const text =
      "Energy is quantised, i.e. it comes in lumps. A photon transfers that lump to one electron in the metal. " +
      "If the lump is smaller than the work function nothing is ejected at all. Bright light of low frequency " +
      "still ejects nothing, which the wave picture cannot explain.";
    const out = paragraphize(text);
    expect(out).toContain("i.e. it comes in lumps.");
  });

  it("applies to a generated explainer through postProcessExplainer", () => {
    const r = postProcessExplainer(`${WALL} [[claim-a-1]]`, numberClaims(claims));
    expect(r.markdown).toContain("[1](#claim-claim-a-1)");
    expect(r.markdown.split("\n\n").length).toBeGreaterThan(2);
  });
});
