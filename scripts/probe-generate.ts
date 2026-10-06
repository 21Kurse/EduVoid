/**
 * Live probe for the pipeline (T6 + G3 F4). Invokes the setup route
 * directly (no HTTP server needed), consumes the SSE stream (sources ->
 * plan/skeleton -> claims -> verified; concepts are NO longer generated
 * here), then simulates the lazy client: opens the first concept and the
 * prefetch second via /api/generate-concept and reports latencies.
 *
 *   npm run probe:generate -- "quantum superposition and measurement"
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

type Counts = Record<string, number>;

async function main(): Promise<number> {
  loadEnvLocal();
  const topic = process.argv.slice(2).join(" ") || "quantum superposition and measurement";

  const { POST } = await import("../app/api/generate/route.ts");
  const req = new Request("http://localhost/api/generate", {
    method: "POST",
    body: JSON.stringify({ topic }),
  });
  const res = await POST(req as never);
  if (!res.ok) {
    console.error(`route returned HTTP ${res.status}`);
    return 1;
  }
  console.log(`stream: HTTP ${res.status} ${res.headers.get("content-type")}`);

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const counts: Counts = {};
  const t0 = Date.now();
  const firstAt: Partial<Record<string, number>> = {};
  let skeleton = false;
  let skeletonConcepts: { id: string; title: string; summary: string }[] = [];
  let claims = 0;
  let verified: { supported: number; total: number; flagged: number; degraded: boolean } | null = null;
  let error: string | null = null;
  let done = false;

  for (;;) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const e = JSON.parse(line.slice(6)) as {
          type: string;
          atMs?: number;
          detail?: string;
          claims?: unknown[];
          supported?: number;
          total?: number;
          flagged?: number;
          degraded?: boolean;
          concepts?: { id: string; title: string; summary: string }[];
        };
        counts[e.type] = (counts[e.type] ?? 0) + 1;
        if (e.atMs !== undefined && firstAt[e.type] === undefined) firstAt[e.type] = e.atMs;
        if (e.type === "skeleton") {
          skeleton = true;
          skeletonConcepts = e.concepts ?? [];
        }
        if (e.type === "claims" && Array.isArray(e.claims)) claims = e.claims.length;
        if (e.type === "verified" && typeof e.supported === "number") {
          verified = { supported: e.supported, total: e.total ?? 0, flagged: e.flagged ?? 0, degraded: e.degraded ?? false };
        }
        if (e.type === "error") error = e.detail ?? "unknown";
        if (e.type === "done") done = true;
      }
    }
  }

  const setupMs = Date.now() - t0;
  console.log("events:", JSON.stringify(counts));
  console.log(
    "first-at(ms):",
    JSON.stringify(Object.fromEntries(Object.entries(firstAt).map(([k, v]) => [k, Math.round(v as number)]))),
  );
  console.log(
    `skeleton=${skeleton} claims=${claims} verified=${verified ? `${verified.supported}/${verified.total} flagged=${verified.flagged} degraded=${verified.degraded}` : "none"} error=${error ?? "none"} done=${done} setup_wall=${setupMs}ms`,
  );

  // Lazy concept generation (G3 F4): open the first concept, then the
  // prefetch second — exactly what the client scheduler does.
  let firstOk = false;
  let firstMs = 0;
  let secondOk = false;
  let secondMs = 0;
  if (skeletonConcepts.length > 0) {
    const { POST: conceptPost } = await import("../app/api/generate-concept/route.ts");
    const ask = async (c: { id: string; title: string; summary: string }): Promise<{ ok: boolean; ms: number }> => {
      const t = Date.now();
      const r = await conceptPost(
        new Request("http://localhost/api/generate-concept", {
          method: "POST",
          body: JSON.stringify({ topic, concept: c }),
        }) as never,
      );
      const j = (await r.json()) as { ok?: boolean };
      return { ok: r.ok && j.ok === true, ms: Date.now() - t };
    };
    const first = await ask(skeletonConcepts[0]);
    firstOk = first.ok;
    firstMs = first.ms;
    if (skeletonConcepts.length > 1) {
      const second = await ask(skeletonConcepts[1]);
      secondOk = second.ok;
      secondMs = second.ms;
    }
  }
  console.log(
    `first_concept=${skeletonConcepts[0]?.id ?? "none"} ok=${firstOk} latency=${firstMs}ms; second ok=${secondOk} latency=${secondMs}ms`,
  );
  const pass = skeleton && claims > 0 && firstOk && !error && done;
  console.log(pass ? "PIPELINE PROBE: PASS" : "PIPELINE PROBE: FAIL");
  return pass ? 0 : 1;
}

main()
  .then((c) => process.exit(c))
  .catch((e: unknown) => {
    console.error("probe crashed:", e);
    process.exit(1);
  });
