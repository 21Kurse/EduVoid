/**
 * Live probe for the Source stage (T4 acceptance). Reads .env.local:
 *
 *   npm run probe:source -- "quantum superposition and measurement"
 *
 * Prints stage timings, source count, and per-claim passage coverage.
 * Never prints key values.
 */
import fs from "node:fs";
import path from "node:path";
import { defaultProvider } from "../lib/search.ts";
import { runSourceStage } from "../lib/source.ts";

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
  const topic = process.argv.slice(2).join(" ") || "quantum superposition and measurement";
  const provider = defaultProvider();
  if (!provider) {
    console.error("TAVILY_API_KEY missing in .env.local — cannot run the live probe.");
    return 1;
  }

  const t0 = Date.now();
  const first = await runSourceStage(topic, provider, { timeoutMs: 90_000 });
  const cold = Date.now() - t0;
  const cached = await runSourceStage(topic, provider);

  console.log(`topic: "${topic}"`);
  console.log(
    `timings: search=${first.timings.searchMs}ms claims=${first.timings.claimsMs}ms total(cold)=${cold}ms total(cached)=${Date.now() - t0 === cold ? cached.timings.totalMs + " (cache)" : cached.timings.totalMs + "ms (cache)"}`,
  );
  console.log(`sources: ${first.sources.length} (need >= 6)`);
  for (const s of first.sources) {
    console.log(`  ${s.id} [${s.authority}] ${s.url.slice(0, 70)} — ${s.passages.length} passages`);
  }
  console.log(`claims: ${first.claims.length}; every claim cites existing passages: ${first.claims.every((c) => c.passageIds.length > 0)}`);
  for (const c of first.claims.slice(0, 5)) {
    console.log(`  - ${c.text.slice(0, 90)}  [${c.passageIds.join(", ")}]`);
  }
  console.log(`contradictions: ${first.contradictions.length}`);
  console.log(`cache hit on 2nd call: ${cached === first ? "yes" : "no"}`);
  const pass = first.sources.length >= 6 && first.claims.every((c) => c.passageIds.length > 0) && cached === first;
  console.log(pass ? "T4 PROBE: PASS" : "T4 PROBE: FAIL");
  return pass ? 0 : 1;
}

main()
  .then((c) => process.exit(c))
  .catch((e: unknown) => {
    console.error("probe crashed:", e);
    process.exit(1);
  });
