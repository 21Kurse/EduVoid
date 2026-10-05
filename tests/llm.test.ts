import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { complete, extractJson, modelForRole } from "../lib/llm";

const toySchema = z.object({
  topic: z.string().min(1),
  count: z.number().int().nonnegative(),
});

const ENV_KEYS = [
  "LLM_MODEL_DEFAULT",
  "LLM_MODEL_PLANNER",
  "LLM_MODEL_GENERATOR",
  "LLM_MODEL_VERIFIER",
  "LLM_MODEL_GRADER",
  "LLM_BASE_URL",
  "LLM_API_KEY",
] as const;

function withEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => Promise<void>) {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  return fn().finally(() => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function llmResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
  });
}

describe("modelForRole", () => {
  it("prefers the role-specific model over the default", () =>
    withEnv({ LLM_MODEL_PLANNER: "planner-x", LLM_MODEL_DEFAULT: "default-y" }, async () => {
      expect(modelForRole("planner")).toBe("planner-x");
      expect(modelForRole("generator")).toBe("default-y");
    }));

  it("returns null when nothing is configured (never invents an ID)", () =>
    withEnv({}, async () => {
      expect(modelForRole("verifier")).toBeNull();
    }));
});

describe("extractJson", () => {
  it("parses fenced JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("parses JSON embedded in prose", () => {
    expect(extractJson('Sure! Here it is: {"a":[1,2]} hope that helps')).toEqual({
      a: [1, 2],
    });
  });
  it("returns null when no JSON exists", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("complete()", () => {
  it("fails with no-config and never calls fetch when env is missing", () =>
    withEnv({}, async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const result = await complete({
        role: "generator",
        system: "s",
        messages: [{ role: "user", content: "hi" }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("no-config");
        expect(result.model).toBeNull();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    }));

  it("routes each role to its configured model in the request body", () =>
    withEnv(
      {
        LLM_MODEL_PLANNER: "model-planner",
        LLM_MODEL_DEFAULT: "model-default",
        LLM_BASE_URL: "https://llm.example/v1",
        LLM_API_KEY: "k",
      },
      async () => {
        const fetchMock = vi.fn().mockImplementation(() =>
          Promise.resolve(llmResponse('{"topic":"qm","count":1}')),
        );
        vi.stubGlobal("fetch", fetchMock);
        const base = {
          system: "s",
          messages: [{ role: "user" as const, content: "go" }],
          schema: toySchema,
        };
        const planner = await complete({ ...base, role: "planner" });
        const grader = await complete({ ...base, role: "grader" });
        expect(planner.ok).toBe(true);
        expect(grader.ok).toBe(true);
        const bodies = fetchMock.mock.calls.map(
          (c) => JSON.parse(String(c[1]?.body)) as { model: string },
        );
        expect(bodies[0].model).toBe("model-planner");
        expect(bodies[1].model).toBe("model-default");
        // Auth header + correct endpoint path
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(String(url)).toBe("https://llm.example/v1/chat/completions");
        expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
      },
    ));

  it("succeeds on valid JSON on the first attempt", () =>
    withEnv(
      { LLM_MODEL_DEFAULT: "m", LLM_BASE_URL: "https://x.example/v1", LLM_API_KEY: "k" },
      async () => {
        const fetchMock = vi.fn().mockResolvedValue(llmResponse('```json\n{"topic":"qm","count":3}\n```'));
        vi.stubGlobal("fetch", fetchMock);
        const result = await complete({
          role: "planner",
          system: "s",
          messages: [{ role: "user", content: "plan" }],
          schema: toySchema,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data).toEqual({ topic: "qm", count: 3 });
          expect(result.attempts).toBe(1);
        }
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
    ));

  it("retries with the validation error appended, then succeeds", () =>
    withEnv(
      { LLM_MODEL_DEFAULT: "m", LLM_BASE_URL: "https://x.example/v1", LLM_API_KEY: "k" },
      async () => {
        const responses = ['{"topic":"qm"}', '{"topic":"qm","count":2}'];
        let calls = 0;
        const bodies: string[] = [];
        const fetchMock = vi.fn().mockImplementation((_url, init) => {
          bodies.push(String(init?.body ?? ""));
          const content = responses[Math.min(calls, responses.length - 1)];
          calls += 1;
          return Promise.resolve(llmResponse(content));
        });
        vi.stubGlobal("fetch", fetchMock);
        const result = await complete({
          role: "verifier",
          system: "s",
          messages: [{ role: "user", content: "v" }],
          schema: toySchema,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data).toEqual({ topic: "qm", count: 2 });
          expect(result.attempts).toBe(2);
        }
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(bodies[1]).toMatch(/failed validation/);
        expect(bodies[1]).toMatch(/count/);
      },
    ));

  it("returns a schema error after exhausting retries (never throws)", () =>
    withEnv(
      { LLM_MODEL_DEFAULT: "m", LLM_BASE_URL: "https://x.example/v1", LLM_API_KEY: "k" },
      async () => {
        // A fresh Response per call: a Response body can only be read once.
        const fetchMock = vi
          .fn()
          .mockImplementation(() => Promise.resolve(llmResponse("not json at all")));
        vi.stubGlobal("fetch", fetchMock);
        const result = await complete({
          role: "generator",
          system: "s",
          messages: [{ role: "user", content: "g" }],
          schema: toySchema,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBe("schema");
          expect(result.attempts).toBe(3); // initial + 2 retries (§3)
        }
        expect(fetchMock).toHaveBeenCalledTimes(3);
      },
    ));

  it("surfaces transport errors safely", () =>
    withEnv(
      { LLM_MODEL_DEFAULT: "m", LLM_BASE_URL: "https://x.example/v1", LLM_API_KEY: "k" },
      async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
        vi.stubGlobal("fetch", fetchMock);
        const result = await complete({
          role: "grader",
          system: "s",
          messages: [{ role: "user", content: "g" }],
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBe("transport");
          expect(result.detail).toMatch(/boom/);
        }
      },
    ));

  it("surfaces HTTP errors as transport failures", () =>
    withEnv(
      { LLM_MODEL_DEFAULT: "m", LLM_BASE_URL: "https://x.example/v1", LLM_API_KEY: "k" },
      async () => {
        // Fresh Response per call (bodies are single-read); 429 is retryable,
        // so the bounded rate-limit budget (baseMs=1 keeps the test fast)
        // must exhaust before the transport error surfaces.
        const fetchMock = vi
          .fn()
          .mockImplementation(() => Promise.resolve(new Response("rate limited", { status: 429 })));
        vi.stubGlobal("fetch", fetchMock);
        const result = await complete({
          role: "generator",
          system: "s",
          messages: [{ role: "user", content: "g" }],
          rateLimit: { baseMs: 1, maxRetries: 3 },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBe("transport");
          expect(result.detail).toMatch(/429/);
        }
        expect(fetchMock).toHaveBeenCalledTimes(4); // 1 + 3 rate-limit retries
      },
    ));

  it("recovers after a 429 with backoff and succeeds", () =>
    withEnv(
      { LLM_MODEL_DEFAULT: "m", LLM_BASE_URL: "https://x.example/v1", LLM_API_KEY: "k" },
      async () => {
        let calls = 0;
        const fetchMock = vi.fn().mockImplementation(() => {
          calls += 1;
          if (calls === 1) return Promise.resolve(new Response("rate limited", { status: 429 }));
          return Promise.resolve(llmResponse('{"topic":"qm","count":7}'));
        });
        vi.stubGlobal("fetch", fetchMock);
        const result = await complete({
          role: "planner",
          system: "s",
          messages: [{ role: "user", content: "p" }],
          schema: toySchema,
          rateLimit: { baseMs: 1, maxRetries: 3 },
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual({ topic: "qm", count: 7 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    ));
});
