import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FINAL_CHECK_MAX,
  FINAL_CHECK_SYSTEM,
  assembleFinalCheck,
  finalCheckPrompt,
  runFinalCheck,
  type FinalCheckConcept,
} from "../lib/final-check";

const CONCEPTS: FinalCheckConcept[] = [
  {
    id: "conditional-probability",
    title: "Conditional probability",
    summary: "Probability of A given B has occurred.",
    claims: [
      { id: "cl-1", text: "P(A|B) = P(A and B) / P(B) for P(B) > 0." },
      { id: "cl-2", text: "Bayes' theorem follows from the definition of conditional probability." },
    ],
  },
  {
    id: "base-rates",
    title: "Base rates",
    summary: "Rare conditions make false positives dominate.",
    claims: [{ id: "cl-3", text: "With a 1% prior and 5% false-positive rate, most positives are false alarms." }],
  },
];

function q(conceptId: string, prompt: string, extra: Partial<{ options: string[]; answer: number; explanation: string }> = {}) {
  return {
    conceptId,
    prompt,
    options: extra.options ?? ["a", "b", "c", "d"],
    answer: extra.answer ?? 1,
    explanation: extra.explanation ?? "because the rule says so",
  };
}

const ENV_KEYS = ["LLM_MODEL_DEFAULT", "LLM_BASE_URL", "LLM_API_KEY"] as const;
function withLlmEnv(fn: () => Promise<void>): Promise<void> {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, {
    LLM_MODEL_DEFAULT: "mock-model",
    LLM_BASE_URL: "http://mock",
    LLM_API_KEY: "mock-key",
  });
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("final check prompt", () => {
  it("carries the topic, every concept id, its claims, and the questions already asked", () => {
    const p = finalCheckPrompt("Bayes' theorem", CONCEPTS, ["What is P(A|B)?", "Why do base rates matter?"]);
    expect(p).toContain('Topic: "Bayes\' theorem"');
    expect(p).toContain("[conditional-probability]");
    expect(p).toContain("[base-rates]");
    expect(p).toContain("P(A|B) = P(A and B) / P(B)");
    expect(p).toContain("never repeat or paraphrase");
    expect(p).toContain("What is P(A|B)?");
  });

  it("asks for a lesson-spanning, harder set and forbids repeats in the system prompt", () => {
    expect(FINAL_CHECK_SYSTEM).toMatch(/never reuse a question/i);
    expect(FINAL_CHECK_SYSTEM).toMatch(/apply the idea to a case the lesson never showed/i);
    expect(FINAL_CHECK_SYSTEM).toContain('"conceptId"');
  });
});

describe("deterministic assembly", () => {
  it("drops questions about unknown concepts, malformed items, and empty prompts", () => {
    const out = assembleFinalCheck(
      {
        questions: [
          q("conditional-probability", "Which identity links joint and conditional probability?"),
          q("no-such-concept", "Which identity links joint and conditional probability?"),
          q("base-rates", "   "),
          q("base-rates", "With a 1% prior, how many positives are real?", { options: ["a"], answer: 0 }),
          q("base-rates", "With a 1% prior, how many positives are real?", { answer: 7 }),
          q("base-rates", "With a 1% prior, how many positives are real?", { explanation: "  " }),
        ],
      },
      CONCEPTS,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.conceptId).toBe("conditional-probability");
  });

  it("never repeats a question the lesson already asked (verbatim or paraphrased)", () => {
    const out = assembleFinalCheck(
      {
        questions: [
          q("base-rates", "What is conditional probability?"),
          q("base-rates", "In a population of 1000 with a 1% prior, how many positive tests are real cases?"),
        ],
      },
      CONCEPTS,
      ["What is conditional probability?"],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.prompt).toContain("1000");
  });

  it("keeps numeric drills that differ only in their numbers apart", () => {
    const out = assembleFinalCheck(
      {
        questions: [
          q("base-rates", "With a prior of 0.01, what is the posterior?"),
          q("base-rates", "With a prior of 0.2, what is the posterior?"),
        ],
      },
      CONCEPTS,
    );
    expect(out).toHaveLength(2);
  });

  it("caps the set and preserves the model's order (hardest first)", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      q("base-rates", `Scenario ${i + 1}: a 1% prior with a 5% false-positive rate — what is the posterior?`),
    );
    const out = assembleFinalCheck({ questions: many }, CONCEPTS);
    expect(out).toHaveLength(FINAL_CHECK_MAX);
    expect(out[0]!.prompt).toContain("Scenario 1");
  });
});

describe("runFinalCheck", () => {
  it("fails visibly, never silently, when no model is configured", async () => {
    const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
    for (const [k] of saved) delete process.env[k];
    try {
      const r = await runFinalCheck("Bayes' theorem", CONCEPTS);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/no-config|not configured|missing/i);
    } finally {
      for (const [k, v] of saved) if (v !== undefined) process.env[k] = v;
    }
  });

  it("returns the assembled set from one model call, grounded on the given claims", async () =>
    withLlmEnv(async () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    conceptId: "conditional-probability",
                    prompt: "A test is 90% sensitive. What does that number mean here?",
                    options: ["P(B|A) for the condition A", "P(A|B) for the test B", "P(B)", "P(A)"],
                    answer: 0,
                    explanation: "Sensitivity is the probability of a positive test given the condition.",
                  },
                  {
                    conceptId: "base-rates",
                    prompt: "A new condition affects 1 in 10,000. Which way does its posterior move?",
                    options: ["Down", "Up", "Unchanged", "Cannot tell"],
                    answer: 0,
                    explanation: "A rarer prior lowers the posterior.",
                  },
                ],
              }),
            },
          },
        ],
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          ),
        ),
      );
      const r = await runFinalCheck("Bayes' theorem", CONCEPTS, { timeoutMs: 5000 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.questions).toHaveLength(2);
        expect(r.questions.map((x) => x.conceptId)).toEqual(["conditional-probability", "base-rates"]);
      }
      // The request really carried the verified claims (grounding, §4.4).
      const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body)) as {
        messages: { role: string; content: string }[];
      };
      expect(body.messages[body.messages.length - 1]!.content).toContain("P(A|B) = P(A and B) / P(B)");
      vi.unstubAllGlobals();
    }));

  it("reports a visible failure when every generated question duplicates one already asked", async () =>
    withLlmEnv(async () => {
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({ questions: [q("base-rates", "What is conditional probability?")] }),
            },
          },
        ],
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          ),
        ),
      );
      const r = await runFinalCheck("Bayes' theorem", CONCEPTS, {
        timeoutMs: 5000,
        avoidPrompts: ["What is conditional probability?"],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.detail).toMatch(/malformed or repeated/i);
      vi.unstubAllGlobals();
    }));
});
