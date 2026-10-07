import { describe, expect, it } from "vitest";
import sampleQuestions from "../data/eval/questions.json";
import { buildEvalCsv, parseEvalQuestions } from "../lib/eval";
import { addAnswer, finishPart, findRecord, upsertRecord } from "../lib/eval-store";

/** The bundled SAMPLE file always validates (guards hand-edits). */
const parsed = parseEvalQuestions(sampleQuestions);
if (!parsed) throw new Error("bundled sample eval questions failed to validate");
const sample = parsed;

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

    it("bundled sample: labeled, 2 questions, includes a transfer item", () => {
      expect(sample.notice).toBeDefined();
      expect(sample.pre.length + sample.post.length).toBe(2);
      const all = [...sample.pre, ...sample.post];
      expect(all.some((q) => /transfer/i.test(q.prompt))).toBe(true);
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
