/**
 * G1 model spike (AGENTS.md section 3, amendment 4) — NVIDIA NIM edition.
 *
 *   npm run spike                        # all candidates, all roles
 *   npm run spike -- --model <id>        # one candidate only
 *
 * Reads .env.local. For each candidate model and each role (planner,
 * verifier) it measures, numbers only:
 *   - JSON validity on the REAL CurriculumSpec schema over 10 runs (after retries)
 *   - verifier catches out of 10 planted errors (passage-level judging)
 *   - median/max latency per call, tokens per call (answer vs reasoning)
 *   - any 429/rate-limit hits
 *
 * Reasoning models: <think> blocks are stripped before JSON parsing, a
 * reasoning_effort/thinking parameter is attempted (removed automatically
 * if the API rejects it), and reasoning vs answer tokens are logged.
 * Never prints key values; exit 1 with setup help when unconfigured.
 */

import fs from "node:fs";
import path from "node:path";
import { complete } from "../lib/llm.ts";
import {
  PLANTED_ERRORS,
  SPEC_SYSTEM,
  VERIFY_SYSTEM,
  specProbeSchema,
  specUserPrompt,
  verdictSchema,
  verifyMessages,
} from "../lib/spike-data.ts";

function loadEnvLocal(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

/** Candidates — every ID taken verbatim from GET /v1/models (2026-10-04).
 *  Probe-verified as served for this account: nano-omni 200, lightning 200,
 *  muse-glimmer 200, super-120b 200. (ultra-253b/deepseek-flash excluded:
 *  404-not-provisioned / indefinite hang — see BLOCKERS.md.) */
const CANDIDATES = {
  reasoning: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  fast: "nvidia/nemotron-3.5-lightning-30b-a3b",
  strong: "nvidia/nemotron-3-super-120b-a12b",
} as const;

const RUNS = 10;
const TOPICS = ["bayes theorem", "fourier transform", "photosynthesis", "supply and demand", "plate tectonics"];

const THINK_OFF = { chat_template_kwargs: { thinking: false } };
const REASONING_EFFORT_LOW = { reasoning_effort: "low" };

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

type ProbeResult = {
  label: string;
  jsonValid: number;
  retriesUsed: number;
  latencyMedianMs: number;
  latencyMaxMs: number;
  tokensMedian: number;
  reasoningTokensMedian: number;
  rateLimited: number;
  verifierCaught: number | null;
  verifierLatencyMs: number | null;
  errors: string[];
};

function tokenSummary(usage: { completionTokens?: number; reasoningTokens?: number } | undefined): {
  total: number;
  reasoning: number;
} {
  return {
    total: usage?.completionTokens ?? 0,
    reasoning: usage?.reasoningTokens ?? 0,
  };
}

async function probeModel(label: string, model: string, role: "planner" | "verifier"): Promise<ProbeResult> {
  const result: ProbeResult = {
    label,
    jsonValid: 0,
    retriesUsed: 0,
    latencyMedianMs: 0,
    latencyMaxMs: 0,
    tokensMedian: 0,
    reasoningTokensMedian: 0,
    rateLimited: 0,
    verifierCaught: null,
    verifierLatencyMs: null,
    errors: [],
  };
  const latencies: number[] = [];
  const tokens: number[] = [];
  const reasoningTokens: number[] = [];

  // Probe (a): CurriculumSpec JSON validity, sequential to be gentle on limits.
  for (let i = 1; i <= RUNS; i++) {
    const topic = TOPICS[i % TOPICS.length];
    const r = await complete({
      role,
      modelOverride: model,
      system: SPEC_SYSTEM,
      messages: [{ role: "user", content: specUserPrompt(topic) }],
      schema: specProbeSchema,
      temperature: 0.7,
      maxTokens: 1500,
      bodyExtras: { ...THINK_OFF, ...REASONING_EFFORT_LOW },
      rateLimit: { baseMs: 2000, maxRetries: 4 },
      timeoutMs: 60_000,
    });
    if (r.ok) {
      result.jsonValid += 1;
      result.retriesUsed += r.attempts - 1;
      latencies.push(r.latencyMs);
      const t = tokenSummary(r.usage);
      tokens.push(t.total);
      reasoningTokens.push(t.reasoning);
    } else {
      if (r.status === 429) result.rateLimited += 1;
      result.errors.push(`run ${i}: ${r.reason}${r.status ? ` HTTP ${r.status}` : ""}: ${r.detail.slice(0, 120)}`);
    }
  }

  // Probe (b): planted-error verifier pass.
  const v = await complete({
    role: "verifier",
    modelOverride: model,
    system: VERIFY_SYSTEM,
    messages: verifyMessages(),
    schema: verdictSchema,
    temperature: 0,
    maxTokens: 1200,
    bodyExtras: { ...THINK_OFF, ...REASONING_EFFORT_LOW },
    rateLimit: { baseMs: 2000, maxRetries: 4 },
    timeoutMs: 60_000,
  });
  if (v.ok) {
    const verdicts = new Map(v.data.verdicts.map((x) => [x.id, x.supported]));
    result.verifierCaught = PLANTED_ERRORS.filter((e) => {
      const verdict = verdicts.get(e.id);
      return verdict === "unsupported" || verdict === "contradicted";
    }).length;
    result.verifierLatencyMs = v.latencyMs;
    const t = tokenSummary(v.usage);
    tokens.push(t.total);
    reasoningTokens.push(t.reasoning);
  } else {
    if (v.status === 429) result.rateLimited += 1;
    result.errors.push(`verifier: ${v.reason}${v.status ? ` HTTP ${v.status}` : ""}: ${v.detail.slice(0, 120)}`);
  }

  result.latencyMedianMs = median(latencies);
  result.latencyMaxMs = latencies.length ? Math.max(...latencies) : 0;
  result.tokensMedian = median(tokens);
  result.reasoningTokensMedian = median(reasoningTokens);
  return result;
}

async function main(): Promise<number> {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--model");
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : undefined;

  const hasTransport = Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY);
  console.log("== EduVoid G1 model spike (NVIDIA NIM) ==");
  console.log("transport: " + (hasTransport ? String(process.env.LLM_BASE_URL) : "(unset)"));
  if (!hasTransport) {
    console.error("Missing LLM_BASE_URL / LLM_API_KEY in .env.local (see .env.example).");
    return 1;
  }

  const entries = Object.entries(CANDIDATES).filter(([k]) => !only || k === only || CANDIDATES[k as keyof typeof CANDIDATES] === only);
  if (entries.length === 0) {
    console.error("No candidate matches --model " + only);
    return 1;
  }

  const all: ProbeResult[] = [];
  for (const [label, model] of entries) {
    console.log("\n## " + label + " — " + model);
    const r = await probeModel(label, model, "planner");
    all.push(r);
    console.log(
      [
        "json_valid=" + r.jsonValid + "/" + RUNS,
        "retries=" + r.retriesUsed,
        "latency_ms median=" + r.latencyMedianMs + " max=" + r.latencyMaxMs,
        "tokens median=" + r.tokensMedian + " reasoning=" + r.reasoningTokensMedian,
        "rate_limited=" + r.rateLimited,
        "verifier_caught=" + (r.verifierCaught ?? "FAIL") + "/10",
        "verifier_latency_ms=" + (r.verifierLatencyMs ?? "-"),
      ].join("  "),
    );
    for (const e of r.errors) console.log("  ! " + e);
  }

  console.log("\n== Thresholds: json_valid >= 9/10, verifier >= 8/10, planner median low enough for ~15 s skeleton ==");
  for (const r of all) {
    const pass = r.jsonValid >= 9 && (r.verifierCaught ?? 0) >= 8 && r.latencyMedianMs <= 15000;
    console.log((pass ? "PASS" : "FAIL") + "  " + r.label + " (" + CANDIDATES[r.label as keyof typeof CANDIDATES] + ")");
  }
  console.log("\nPaste this block into DECISIONS.md under 'Model spike (G1)'.");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    console.error("spike crashed:", e);
    process.exit(1);
  });
