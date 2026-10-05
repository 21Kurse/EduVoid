/**
 * T7 acceptance probe: run the PRODUCTION verifier (lib/verify.ts) against
 * the 10 planted factual errors from the G1 spike dataset. Every planted
 * error contradicts (or is unsupported by) its cited passage, so the
 * verifier should flag >= 8/10 (AGENTS.md §13.4 threshold).
 *
 *   npm run probe:verify
 */
import fs from "node:fs";
import path from "node:path";

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

async function main(): Promise<number> {
  loadEnvLocal();
  if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY) {
    console.error("Missing LLM_BASE_URL / LLM_API_KEY in .env.local.");
    return 1;
  }
  const { PLANTED_ERRORS, VERIFIER_PASSAGES } = await import("../lib/spike-data.ts");
  const { runVerifyStage } = await import("../lib/verify.ts");

  const passages = VERIFIER_PASSAGES.map((p) => ({ ...p, label: "spike", url: "" }));
  const claims = PLANTED_ERRORS.map((e) => ({
    id: e.id,
    text: e.text,
    passageIds: [e.passageId],
    sourceIds: [e.passageId.replace(/-p\d+$/, "")],
    status: "supported" as const,
  }));

  const t0 = Date.now();
  const r = await runVerifyStage({ claims, passages });
  const wall = Date.now() - t0;

  const caught = r.claims.filter((c) => c.status === "flagged");
  console.log(`verifier wall=${wall}ms degraded=${r.degraded}`);
  for (const c of r.claims) {
    console.log(`  ${c.id}: ${c.status}${c.flagReason ? ` (${c.flagReason})` : ""}`);
  }
  console.log(`caught=${caught.length}/10 flagged=${r.flagged} supported=${r.supported}`);
  const pass = caught.length >= 8 && !r.degraded;
  console.log(pass ? "T7 PROBE: PASS" : "T7 PROBE: FAIL");
  return pass ? 0 : 1;
}

main()
  .then((c) => process.exit(c))
  .catch((e: unknown) => {
    console.error("probe crashed:", e);
    process.exit(1);
  });
