/**
 * Live probe for the Plan stage (T5 acceptance): valid skeleton <= 8 concepts,
 * acyclic, returned within ~15 s. Reads .env.local:
 *
 *   npm run probe:plan -- "quantum superposition and measurement"
 */
import fs from "node:fs";
import path from "node:path";
import { defaultProvider } from "../lib/search.ts";
import { runSourceStage } from "../lib/source.ts";
import { runPlanStage } from "../lib/plan.ts";
import { topoSort } from "../lib/graph.ts";

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
    console.error("TAVILY_API_KEY missing in .env.local.");
    return 1;
  }
  const source = await runSourceStage(topic, provider, { timeoutMs: 45_000 });
  const r = await runPlanStage(topic, "beginner", source.sources, { timeoutMs: 45_000 });
  if (!r.ok) {
    console.error(`plan FAILED: ${r.detail} (latency ${r.latencyMs}ms)`);
    return 1;
  }
  const ids = r.spec.concepts.map((c) => c.id);
  const order = topoSort(ids, r.spec.edges);
  console.log(`plan latency: ${r.latencyMs}ms (budget ~15000ms)`);
  console.log(`concepts: ${ids.length} (cap 8): ${ids.join(" -> ")}`);
  console.log(`edges: ${r.spec.edges.length}; acyclic: ${order !== null ? "yes" : "NO"}`);
  console.log(`sources carried into spec: ${r.spec.sources.length}`);
  const pass = r.latencyMs <= 15_000 && ids.length >= 3 && ids.length <= 8 && order !== null;
  console.log(pass ? "T5 PROBE: PASS" : "T5 PROBE: FAIL");
  return pass ? 0 : 1;
}

main()
  .then((c) => process.exit(c))
  .catch((e: unknown) => {
    console.error("probe crashed:", e);
    process.exit(1);
  });
