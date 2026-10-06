import { describe, expect, it } from "vitest";
import {
  explainerIsClean,
  numberClaims,
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
