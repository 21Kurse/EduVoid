/**
 * Claims-extraction latency benchmark (per-source parallel vs sequential
 * baseline) over the REAL demo-topic search results. N runs per mode.
 * Reports per-run wall ms, mode medians, and the speedup — the "before"
 * baseline is measured live here, not invented from a stale log.
 *
 *   npm run bench:claims -- 3
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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function main(): Promise<number> {
  loadEnvLocal();
  const runs = Math.max(1, Math.min(5, Number(process.argv[2] ?? "3")));
  const topic = process.argv.slice(3).join(" ") || "quantum superposition and measurement";

  const { defaultProvider } = await import("../lib/search.ts");
  const { runSearchStage, runClaimsStage } = await import("../lib/source.ts");
  const provider = defaultProvider();
  if (!provider) {
    console.error("TAVILY_API_KEY missing in .env.local.");
    return 1;
  }

  const { sources, searchMs } = await runSearchStage(topic, provider);
  const withPassages = sources.filter((s) => s.passages.length > 0);
  console.log(
    `topic="${topic}" sources=${sources.length} withPassages=${withPassages.length} searchMs=${searchMs}`,
  );
  if (withPassages.length < 2) {
    console.error("Not enough sources with passages to benchmark.");
    return 1;
  }

  const seqWalls: number[] = [];
  const parWalls: number[] = [];
  let seqFlags = 0;
  let parFlags = 0;
  let seqClaims = 0;
  let parClaims = 0;
  for (let i = 0; i < runs; i++) {
    // "Before" baseline: sequential per-source extraction (concurrency 1).
    const t0 = Date.now();
    const seq = await runClaimsStage(topic, sources, { timeoutMs: 45_000, concurrency: 1 });
    seqWalls.push(Date.now() - t0);
    seqFlags += seq.claims.filter((c) => c.status === "flagged").length;
    seqClaims += seq.claims.length;

    // "After": the shipped configuration (concurrency 4).
    const t1 = Date.now();
    const par = await runClaimsStage(topic, sources, { timeoutMs: 45_000, concurrency: 4 });
    parWalls.push(Date.now() - t1);
    parFlags += par.claims.filter((c) => c.status === "flagged").length;
    parClaims += par.claims.length;
    console.log(
      `run ${i + 1}: sequential=${seqWalls[i]}ms (${seq.claims.length} claims)  parallel=${parWalls[i]}ms (${par.claims.length} claims)`,
    );
  }

  const speedup = median(seqWalls) / median(parWalls);
  console.log(
    `\nsequential median=${Math.round(median(seqWalls))}ms  parallel median=${Math.round(median(parWalls))}ms  speedup=${speedup.toFixed(2)}x over ${runs} run(s)`,
  );
  console.log(
    `claims extracted: seq total=${seqClaims}, par total=${parClaims}; flagged: seq=${seqFlags}, par=${parFlags}`,
  );
  return 0;
}

main()
  .then((c) => process.exit(c))
  .catch((e: unknown) => {
    console.error("bench crashed:", e);
    process.exit(1);
  });
