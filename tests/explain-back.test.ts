import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExplainBackPrompt,
  gradeExplanation,
  GRADER_SYSTEM,
  summarizeExplainBack,
  type ExplainBackClaim,
} from "../lib/explain-back";

const CLAIMS: ExplainBackClaim[] = [
  { id: "c1", text: "A qubit state is a weighted combination of |0> and |1>." },
  { id: "c2", text: "The Born rule gives the measurement probabilities." },
  { id: "c3", text: "Measurement updates the state." },
];

const ENV_KEYS = ["LLM_MODEL_DEFAULT", "LLM_MODEL_GRADER", "LLM_BASE_URL", "LLM_API_KEY"] as const;

function withLlmEnv(fn: () => Promise<void>): Promise<void> {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, {
    LLM_MODEL_DEFAULT: "mock-model",
    LLM_BASE_URL: "https://mock.example/v1",
    LLM_API_KEY: "mock-key",
  });
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

afterEach(() => vi.unstubAllGlobals());

function okResponse(content: object) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
  });
}

const INPUT = {
  topic: "quantum superposition",
  conceptTitle: "The Born rule",
  summary: "Probabilities from amplitudes.",
  claims: CLAIMS,
  explanation: "The state is a mix of 0 and 1 and squaring the amplitude gives the chance of each outcome.",
};

describe("buildExplainBackPrompt", () => {
  it("carries every claim id, every claim text, and the learner's own words", () => {
    const prompt = buildExplainBackPrompt(INPUT);
    for (const c of CLAIMS) {
      expect(prompt).toContain(`[${c.id}]`);
      expect(prompt).toContain(c.text);
    }
    expect(prompt).toContain(INPUT.explanation);
    expect(prompt).toContain(INPUT.conceptTitle);
  });

  it("tells the grader to treat the learner text as data and grade only the listed claims", () => {
    expect(GRADER_SYSTEM).toMatch(/data to grade/i);
    expect(GRADER_SYSTEM).toMatch(/Do not add facts/i);
    expect(GRADER_SYSTEM).toMatch(/covered[\s\S]*partial[\s\S]*missed/);
  });
});

describe("summarizeExplainBack", () => {
  it("counts verdicts, treats a partial as half, and closes with no gaps when all claims land", () => {
    const s = summarizeExplainBack(
      {
        coverage: [
          { claimId: "c1", verdict: "covered" },
          { claimId: "c2", verdict: "covered" },
          { claimId: "c3", verdict: "covered", note: " brief but right " },
        ],
        gap: "",
      },
      CLAIMS,
    );
    expect([s.total, s.covered, s.partial, s.missed]).toEqual([3, 3, 0, 0]);
    expect(s.score).toBe(1);
    expect(s.gap).toMatch(/Nothing missed/);
    expect(s.nudge).toBeNull();
    expect(s.rows.map((r) => r.text)).toEqual(CLAIMS.map((c) => c.text));
    expect(s.rows[2].note).toBe("brief but right");
  });

  it("ignores invented ids, keeps the first verdict for duplicates, and treats gaps as missed", () => {
    const s = summarizeExplainBack(
      {
        coverage: [
          { claimId: "c1", verdict: "partial", note: "vague" },
          { claimId: "c1", verdict: "covered" }, // duplicate: first wins
          { claimId: "made-up", verdict: "covered" }, // hallucinated id: ignored
        ],
        gap: "  The Born rule is missing.  ",
        nudge: "  What does squaring the amplitude give you?  ",
      },
      CLAIMS,
    );
    expect(s.rows.map((r) => r.verdict)).toEqual(["partial", "missed", "missed"]);
    expect([s.covered, s.partial, s.missed]).toEqual([0, 1, 2]);
    expect(s.score).toBeCloseTo(0.5 / 3);
    expect(s.gap).toBe("The Born rule is missing.");
    expect(s.nudge).toBe("What does squaring the amplitude give you?");
  });

  it("falls back to an honest gap sentence when the model returns none", () => {
    const s = summarizeExplainBack(
      { coverage: [{ claimId: "c1", verdict: "covered" }], gap: "   " },
      CLAIMS,
    );
    expect(s.gap).toMatch(/didn't come through/);
    expect(s.nudge).toBeNull();
  });
});

describe("gradeExplanation", () => {
  it("returns the deterministic summary of the model's verdicts", () =>
    withLlmEnv(async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({
            coverage: [
              { claimId: "c1", verdict: "covered" },
              { claimId: "c2", verdict: "covered" },
              { claimId: "c3", verdict: "partial", note: "near miss" },
              { claimId: "c9", verdict: "covered" }, // not in the lesson: ignored
            ],
            gap: "Explain what measurement does to the state.",
            nudge: "What happens if you measure again immediately?",
          }),
        ),
      );
      const r = await gradeExplanation(INPUT);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect([r.summary.covered, r.summary.partial, r.summary.missed]).toEqual([2, 1, 0]);
        expect(r.summary.score).toBeCloseTo(5 / 6);
        expect(r.summary.nudge).toMatch(/measure again/);
        expect(r.model).toBe("mock-model");
      }
    }));

  it("routes through LLM_MODEL_GRADER and sends the claims with the request", () =>
    withLlmEnv(async () => {
      process.env.LLM_MODEL_GRADER = "strong-grader";
      const fetchMock = vi
        .fn()
        .mockResolvedValue(okResponse({ coverage: [], gap: "", nudge: "" }));
      vi.stubGlobal("fetch", fetchMock);
      await gradeExplanation(INPUT);
      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.model).toBe("strong-grader");
      const sent = JSON.stringify(body.messages);
      expect(sent).toContain("[c2]");
      expect(sent).toContain("The Born rule gives the measurement probabilities.");
    }));

  it("fails visibly instead of throwing when the provider rejects the call", () =>
    withLlmEnv(async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 400 })));
      const r = await gradeExplanation(INPUT);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/transport: LLM HTTP 400/);
    }));

  it("fails visibly when the model keeps returning prose instead of JSON", () =>
    withLlmEnv(async () => {
      // A fresh Response per attempt: each retry re-reads the body.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: "Sure! Looks good to me." } }] }), {
            status: 200,
          }),
        ),
      );
      const r = await gradeExplanation(INPUT);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/^schema:/);
    }));
});
