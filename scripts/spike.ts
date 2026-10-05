/**
 * G1 model spike (AGENTS.md section 3, amendment 4). Owner-run once keys exist.
 *
 *   npm run spike
 *   (reads .env.local; see .env.example for the required vars)
 *
 * Measures, on the configured default model:
 *   (a) JSON validity rate against the REAL CurriculumSpec schema over 10 runs
 *   (b) planted-error verifier pass: 10 factually wrong claims, each judged
 *       against its cited passage only -- how many are caught?
 *
 * Results print to stdout; paste them into DECISIONS.md. No model IDs are
 * invented here: everything comes from env. Exit code 1 with instructions
 * when configuration is missing.
 */

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { complete, modelForRole, type LlmMessage } from "../lib/llm.ts";
import { curriculumSpecSchema } from "../lib/spec.ts";

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

const RUNS = 10;

// ---------------------------------------------------------------------------
// (a) CurriculumSpec generation probe
// ---------------------------------------------------------------------------

const SPEC_SYSTEM =
  "You produce tiny curriculum specs as JSON. Output ONLY JSON, no prose, no markdown fences. Keep it minimal: exactly 2 concepts, 1 edge, 1 source with 2 passages, 1 claim per concept citing existing passage IDs, and one explainer component per concept.";

function specUserPrompt(topic: string): string {
  return [
    'Topic: "' + topic + '". Produce this exact JSON shape:',
    "{",
    '  "topic": string,',
    '  "level": "beginner" | "intermediate" | "advanced",',
    '  "concepts": [ { "id": string, "title": string, "summary": string, "claims": [ { "id": string, "text": string, "passageIds": string[], "sourceIds": string[], "status": "supported" } ], "components": [ { "type": "explainer", "markdown": string } ] } ],',
    '  "edges": [ { "from": conceptId, "to": conceptId } ],',
    '  "sources": [ { "id": string, "title": string, "url": string, "authority": "explainer", "passages": [ { "id": string, "label": string, "text": string } ] } ]',
    "}",
    "All IDs lowercase-kebab-case and globally unique. Every claim's passageIds must reference passages inside sources, and its sourceIds must reference that source.",
  ].join("\n");
}

const specProbeSchema = z.object({ spec: curriculumSpecSchema });

// ---------------------------------------------------------------------------
// (b) planted-error verifier probe
// ---------------------------------------------------------------------------

const VERIFIER_PASSAGES: { id: string; text: string }[] = [
  { id: "vp-1", text: "Water boils at 100 degrees Celsius at standard atmospheric pressure." },
  { id: "vp-2", text: "The speed of light in vacuum is about 299,792 kilometers per second." },
  { id: "vp-3", text: "Humans have 23 pairs of chromosomes, for 46 in total." },
  { id: "vp-4", text: "The chemical formula of table salt is NaCl." },
  { id: "vp-5", text: "Sound travels faster in water than in air." },
  { id: "vp-6", text: "The Earth orbits the Sun once approximately every 365.25 days." },
  { id: "vp-7", text: "DNA carries genetic information in living cells." },
  { id: "vp-8", text: "The freezing point of water at standard pressure is 0 degrees Celsius." },
  { id: "vp-9", text: "Iron rusts through a chemical reaction with oxygen." },
  { id: "vp-10", text: "A year on Mars is longer than a year on Earth." },
  { id: "vp-11", text: "Helium is the second lightest element in the periodic table." },
  { id: "vp-12", text: "Photosynthesis in plants consumes carbon dioxide and produces oxygen." },
];

const PLANTED_ERRORS: { id: string; text: string; passageId: string }[] = [
  { id: "e1", text: "Water boils at 50 degrees Celsius at standard atmospheric pressure.", passageId: "vp-1" },
  { id: "e2", text: "The speed of light in vacuum is about 150,000 kilometers per second.", passageId: "vp-2" },
  { id: "e3", text: "Humans have 12 pairs of chromosomes, for 24 in total.", passageId: "vp-3" },
  { id: "e4", text: "The chemical formula of table salt is KCl.", passageId: "vp-4" },
  { id: "e5", text: "Sound travels slower in water than in air.", passageId: "vp-5" },
  { id: "e6", text: "The Earth orbits the Sun once approximately every 100 days.", passageId: "vp-6" },
  { id: "e7", text: "Proteins, not DNA, carry genetic information in living cells.", passageId: "vp-7" },
  { id: "e8", text: "The freezing point of water at standard pressure is 20 degrees Celsius.", passageId: "vp-8" },
  { id: "e9", text: "Iron rusts through a chemical reaction with nitrogen.", passageId: "vp-9" },
  { id: "e10", text: "A year on Mars is shorter than a year on Earth.", passageId: "vp-10" },
];

const verdictSchema = z.object({
  verdicts: z
    .array(
      z.object({
        id: z.string(),
        supported: z.enum(["supported", "unsupported", "contradicted"]),
      }),
    )
    .min(1),
});

const VERIFY_SYSTEM =
  'You are a strict fact verifier. You get passages and claims. For each claim, judge ONLY against the single passage it cites: is the claim supported by that passage, unsupported, or contradicted? Output ONLY JSON of shape {"verdicts":[{"id":string,"supported":"supported"|"unsupported"|"contradicted"}]}.';

function verifyMessages(): LlmMessage[] {
  const passageBlock = VERIFIER_PASSAGES.map((p) => "[" + p.id + "] " + p.text).join("\n");
  const claimBlock = PLANTED_ERRORS.map(
    (e) =>
      '{ "id": "' + e.id + '", "text": ' + JSON.stringify(e.text) + ', "citedPassage": "' + e.passageId + '" }',
  ).join(",\n");
  return [
    {
      role: "user",
      content:
        "Passages:\n" + passageBlock + "\n\nClaims:\n[" + claimBlock + "]\n\nJudge each claim against its citedPassage only.",
    },
  ];
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  loadEnvLocal();
  const model = modelForRole("planner");
  const hasTransport = Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY);

  console.log("== EduVoid G1 model spike ==");
  console.log("planner model: " + (model ?? "(unset)"));
  console.log("transport: " + (hasTransport ? String(process.env.LLM_BASE_URL) : "(unset)"));

  if (!model || !hasTransport) {
    console.error(
      [
        "",
        "Missing configuration. Add to .env.local (see .env.example):",
        "  LLM_BASE_URL=https://<provider-endpoint>/v1",
        "  LLM_API_KEY=<key>",
        "  LLM_MODEL_DEFAULT=<exact model id the owner supplies>",
        "  (optionally LLM_MODEL_PLANNER / LLM_MODEL_VERIFIER overrides)",
        "",
        "Then re-run: npm run spike",
      ].join("\n"),
    );
    return 1;
  }

  // -- (a) JSON validity rate over 10 runs ----------------------------------
  console.log("\n(a) CurriculumSpec JSON validity over " + RUNS + " runs (schema: curriculumSpecSchema)...");
  let valid = 0;
  let retriesUsed = 0;
  const t0 = Date.now();
  const topics = ["bayes theorem", "fourier transform", "photosynthesis", "supply and demand", "plate tectonics"];
  for (let i = 1; i <= RUNS; i++) {
    const topic = topics[i % topics.length];
    const result = await complete({
      role: "planner",
      system: SPEC_SYSTEM,
      messages: [{ role: "user", content: specUserPrompt(topic) }],
      schema: specProbeSchema,
      temperature: 0.7,
      maxTokens: 1200,
    });
    if (result.ok) {
      valid += 1;
      retriesUsed += result.attempts - 1;
      console.log("  run " + i + ": valid (attempts=" + result.attempts + ", model=" + result.model + ")");
    } else {
      console.log("  run " + i + ": INVALID (" + result.reason + ": " + result.detail.slice(0, 140) + ")");
    }
  }
  const specMs = Date.now() - t0;
  console.log(
    "=> JSON validity: " +
      valid +
      "/" +
      RUNS +
      " (" +
      Math.round((valid / RUNS) * 100) +
      "%), total " +
      specMs +
      " ms, avg " +
      Math.round(specMs / RUNS) +
      " ms/run, retries used: " +
      retriesUsed,
  );

  // -- (b) planted-error verifier pass --------------------------------------
  console.log("\n(b) Planted-error verifier test (10 errors, judged passage-by-passage)...");
  const verify = await complete({
    role: "verifier",
    system: VERIFY_SYSTEM,
    messages: verifyMessages(),
    schema: verdictSchema,
    temperature: 0,
    maxTokens: 800,
  });
  let caught = 0;
  if (!verify.ok) {
    console.log("=> verifier call FAILED (" + verify.reason + ": " + verify.detail.slice(0, 200) + ")");
    console.log("=> caught: 0/10 (verifier unusable in this state)");
  } else {
    const verdicts = new Map(verify.data.verdicts.map((v) => [v.id, v.supported]));
    for (const e of PLANTED_ERRORS) {
      const v = verdicts.get(e.id);
      const isCaught = v === "unsupported" || v === "contradicted";
      if (isCaught) caught += 1;
      console.log("  " + e.id + ": " + (v ?? "(missing)") + " -- " + (isCaught ? "caught" : "MISSED"));
    }
    console.log("=> verifier caught " + caught + "/10 planted errors (threshold: >=8, amendment 4)");
  }

  console.log("\nPaste these results into DECISIONS.md under 'Model spike (G1)'.");
  if (caught < 8) {
    console.log("Recommendation: route verifier (and planner) to a stronger model (amendment 4).");
  } else {
    console.log("Recommendation: flash model OK for verifier on this probe.");
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    console.error("spike crashed:", e);
    process.exit(1);
  });
