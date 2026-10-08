import { describe, expect, it } from "vitest";
import bundledQuestions from "../data/eval/questions.json";
import { buildEvalCsv, parseEvalQuestions } from "../lib/eval";
import { addAnswer, finishPart, findRecord, upsertRecord } from "../lib/eval-store";

/** The bundled owner file always validates and is not the sample (guards hand-edits). */
const parsed = parseEvalQuestions(bundledQuestions);
if (!parsed) throw new Error("bundled eval questions failed to validate");
const bundled = parsed;

describe("eval mode (T13)", () => {
  describe("question file schema", () => {
    it("accepts a valid owner-shaped file and labels it non-sample", () => {
      const qs = parseEvalQuestions({
        title: "Real exam",
        pre: [
          {
            id: "q1",
            kind: "mcq",
            prompt: "P",
            options: ["a", "b"],
            answer: 1,
            explanation: "e",
          },
        ],
        post: [
          {
            id: "q2",
            kind: "mcq",
            prompt: "P",
            options: ["a", "b"],
            answer: 0,
            explanation: "e",
          },
        ],
      });
      expect(qs).not.toBeNull();
      expect(qs!.notice).toBeUndefined();
    });

    it("rejects malformed and out-of-range files", () => {
      expect(parseEvalQuestions(null)).toBeNull();
      expect(parseEvalQuestions({})).toBeNull();
      expect(
        parseEvalQuestions({
          title: "T",
          pre: [{ id: "x", kind: "mcq", prompt: "p", options: ["a"], answer: 0, explanation: "e" }],
          post: [],
        }),
      ).toBeNull();
      expect(
        parseEvalQuestions({
          title: "T",
          pre: [{ id: "x", kind: "mcq", prompt: "p", options: ["a", "b"], answer: 5, explanation: "e" }],
          post: [{ id: "y", kind: "mcq", prompt: "p", options: ["a", "b"], answer: 0, explanation: "e" }],
        }),
      ).toBeNull();
    });

    it("bundled file is the real external instrument, not a labelled sample", () => {
      // The real file carries NO `notice` key; that key is what raises the SAMPLE banner in
      // components/test-mode.tsx, so this asserts the banner stays off in the shipped app.
      expect(bundledQuestions).not.toHaveProperty("notice");
      expect(bundled.notice).toBeUndefined();
    });

    it("bundled file: paired parts of 3+ items each with unique ids and in-range keys", () => {
      expect(bundled.pre.length).toBeGreaterThanOrEqual(3);
      expect(bundled.post.length).toBeGreaterThanOrEqual(3);
      expect(bundled.pre.length).toBe(bundled.post.length);

      const ids = [...bundled.pre, ...bundled.post].map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);

      for (const q of [...bundled.pre, ...bundled.post]) {
        expect(q.kind).toBe("mcq");
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.prompt.trim().length).toBeGreaterThan(0);
        expect(q.explanation.trim().length).toBeGreaterThan(0);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
    });

    it("both parts contain a transfer item (applying the idea to a new setup)", () => {
      // Transfer items are marked in the id (see data/eval/procedure.md §3) so the prompt text
      // stays the source's own; each part needs at least one.
      const isTransfer = (q: { id: string }) => /transfer/i.test(q.id);
      expect(bundled.pre.some(isTransfer)).toBe(true);
      expect(bundled.post.some(isTransfer)).toBe(true);
      expect(bundled.pre.filter(isTransfer).length).toBe(
        bundled.post.filter(isTransfer).length,
      );
    });
  });

  describe("CSV export", () => {
    it("round-trips per-participant pre/post rows with timestamps", () => {
      const record = {
        name: "P1",
        pre: {
          answers: [{ questionId: "sample-pre-1", correct: false, elapsedSec: 9 }],
          startedAt: 1759500000000,
          finishedAt: 1759500000000 + 12_000,
        },
        post: {
          answers: [{ questionId: "sample-post-1", correct: true, elapsedSec: 7 }],
          startedAt: 1759503600000,
          finishedAt: 1759503600000 + 8_000,
        },
      };
      const csv = buildEvalCsv([record], 1759503700000);
      const rows = csv.trim().split("\n");
      expect(rows.length).toBe(3);
      expect(rows[0]).toContain("participant,part,started_at,finished_at");
      expect(rows[1]).toContain("P1,pre,");
      expect(rows[1]).toContain(",1,0,0.000,");
      expect(rows[2]).toContain("P1,post,");
      expect(rows[2]).toContain(",1,1,1.000,");
      expect(rows[1].split(",").length).toBe(8);
      expect(rows[1]).toContain("2025-10-03T14:00:00.000Z");
      expect(rows[1]).toContain("2025-10-03T14:00:12.000Z");
    });

    it("escapes commas/quotes in fields", () => {
      const record = {
        name: 'P,"2"',
        pre: { answers: [], startedAt: 0, finishedAt: 0 },
        post: { answers: [], startedAt: 0, finishedAt: 0 },
      };
      const csv = buildEvalCsv([record], 0);
      expect(csv).toContain('"P,""2""",pre');
    });
  });

  describe("participant store reducers", () => {
    it("upsert → answer → finish produces a complete resumable record", () => {
      const t0 = 1000;
      const s1 = upsertRecord([], "P1", "pre", t0);
      const s2 = addAnswer(s1, "P1", "pre", { questionId: "sample-pre-1", correct: true, elapsedSec: 5 }, 2000);
      const s3 = finishPart(s2, "P1", "pre", 3000);
      const rec = findRecord(s3, "P1")!;
      expect(rec.pre.startedAt).toBe(1000);
      expect(rec.pre.finishedAt).toBe(3000);
      expect(rec.pre.answers).toEqual([
        { questionId: "sample-pre-1", correct: true, elapsedSec: 5 },
      ]);
      expect(rec.post.startedAt).toBe(0);
      expect(rec.post.finishedAt).toBeNull();
    });

    it("re-answering a question replaces the earlier answer (resume-safe)", () => {
      const s1 = upsertRecord([], "P1", "pre", 1000);
      const s2 = addAnswer(s1, "P1", "pre", { questionId: "q", correct: false, elapsedSec: 1 }, 2000);
      const s3 = addAnswer(s2, "P1", "pre", { questionId: "q", correct: true, elapsedSec: 2 }, 3000);
      expect(findRecord(s3, "P1")!.pre.answers).toEqual([{ questionId: "q", correct: true, elapsedSec: 2 }]);
    });

    it("records are independent and upsert never resets an existing part", () => {
      const s1 = upsertRecord([], "P1", "pre", 1000);
      const s2 = addAnswer(s1, "P1", "pre", { questionId: "q", correct: true, elapsedSec: 3 }, 2000);
      const s3 = upsertRecord(s2, "P1", "pre", 5000);
      expect(findRecord(s3, "P1")!.pre.startedAt).toBe(1000);
      expect(findRecord(s3, "P1")!.pre.answers).toHaveLength(1);
      const s4 = upsertRecord(s3, "P2", "pre", 6000);
      expect(findRecord(s4, "P2")!.pre.startedAt).toBe(6000);
      expect(findRecord(s4, "P1")!.pre.answers).toHaveLength(1);
    });
  });
});
