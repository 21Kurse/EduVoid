/**
 * Capture the demo-safe cached run (T14, AGENTS.md §7 + §15.3).
 *
 * Runs the REAL pipeline stages once for the demo topic and saves the exact
 * output — never hand-written. The UI shows it ONLY when live generation
 * fails, always labeled "cached run".
 *
 *   npm run capture:demo
 *
 * NIM is flaky (timeouts, unparseable JSON), so this is RESUMABLE: it saves
 * progress to partial files after each stage and each concept, and a re-run
 * picks up where the last one stopped. Repeat until it prints "captured".
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

const OUT_DIR = path.join(process.cwd(), "data", "cached");
const SETUP_FILE = path.join(OUT_DIR, ".partial-setup.json");
const CONCEPTS_FILE = path.join(OUT_DIR, ".partial-concepts.json");
const OUT_FILE = path.join(OUT_DIR, "qm-superposition.json");

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Retry an async attempt until it satisfies `ok`, up to `tries` times. */
async function retry<T>(
  label: string,
  tries: number,
  attempt: () => Promise<T>,
  ok: (v: T) => boolean,
): Promise<T | null> {
  let last: T | null = null;
  for (let i = 1; i <= tries; i++) {
    const v = await attempt();
    last = v;
    if (ok(v)) return v;
    const detail = typeof v === "object" && v && "detail" in v ? String((v as { detail: unknown }).detail).slice(0, 140) : "";
    console.warn(`[capture] ${label} attempt ${i}/${tries} failed${detail ? `: ${detail}` : ""}`);
    await new Promise((r) => setTimeout(r, 1500 * i));
  }
  return last;
}

type Setup = {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  concepts: { id: string; title: string; summary: string }[];
  edges: { from: string; to: string }[];
  sources: { id: string; title: string; url: string; authority: string; passages: { id: string; label: string; text: string }[] }[];
  claims: unknown[];
  contradictions: unknown[];
};

async function main(): Promise<number> {
  loadEnvLocal();
  const topic = process.argv.slice(2).join(" ") || "quantum superposition and measurement";

  const { defaultProvider } = await import("../lib/search.ts");
  const { runSearchStage, runClaimsStage } = await import("../lib/source.ts");
  const { runVerifyStage } = await import("../lib/verify.ts");
  const { runPlanStage } = await import("../lib/plan.ts");
  const { generateConcept, generateHeroSim } = await import("../lib/generate.ts");
  const { curriculumSpecLooseSchema } = await import("../lib/spec.ts");

  const provider = defaultProvider();
  if (!provider) {
    console.error("no search provider configured (Tavily key missing)");
    return 1;
  }

  // ---- Setup: search -> claims -> verify -> plan (resumable) --------------
  let setup = readJson<Setup>(SETUP_FILE);
  if (setup && setup.topic === topic && setup.concepts.length > 0) {
    console.log(`[capture] resuming setup from ${path.relative(process.cwd(), SETUP_FILE)} (${setup.concepts.length} concepts)`);
  } else {
    const t0 = Date.now();
    const search = await retry("search", 3, () => runSearchStage(topic, provider), (s) => s.sources.length >= 3);
    if (!search || search.sources.length < 3) {
      console.error("search stage never returned enough sources; aborting");
      return 1;
    }
    console.log(`[capture] search: ${search.sources.length} sources (${Date.now() - t0}ms)`);

    // Per-source claims extraction degrades alone, so a few stubborn sources
    // are fine — but we need a usable claim pool to ground generation.
    const claimsPart = await retry(
      "claims",
      4,
      () => runClaimsStage(topic, search.sources, { timeoutMs: 90_000, concurrency: 2 }),
      (c) => c.claims.length >= 4,
    );
    if (!claimsPart || claimsPart.claims.length < 4) {
      console.error(`claims stage only produced ${claimsPart?.claims.length ?? 0} claims; aborting`);
      return 1;
    }
    console.log(`[capture] claims: ${claimsPart.claims.length} claims, ${claimsPart.contradictions.length} contradictions`);

    const passages = search.sources.flatMap((s) => s.passages);
    const verify = await retry(
      "verify",
      3,
      () => runVerifyStage({ claims: claimsPart.claims, passages }, { timeoutMs: 90_000 }),
      () => true,
    );
    if (!verify) {
      console.error("verify stage failed; aborting");
      return 1;
    }
    console.log(`[capture] verify: ${verify.supported}/${verify.total} supported (degraded=${verify.degraded})`);

    const plan = await retry("plan", 3, () => runPlanStage(topic, "beginner", search.sources, { timeoutMs: 90_000 }), (p) => p.ok);
    if (!plan || !plan.ok) {
      console.error("plan stage failed; aborting");
      return 1;
    }
    console.log(`[capture] plan: ${plan.spec.concepts.length} concepts`);

    setup = {
      topic,
      level: plan.spec.level,
      concepts: plan.spec.concepts.map((c) => ({ id: c.id, title: c.title, summary: c.summary })),
      edges: plan.spec.edges,
      sources: search.sources.map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        authority: s.authority,
        passages: s.passages.map((p) => ({ id: p.id, label: p.label, text: p.text })),
      })),
      // Ground generation on the VERIFIED claim set only (§4.4).
      claims: verify.claims.filter((c) => c.status === "supported"),
      contradictions: claimsPart.contradictions,
    };
    writeJson(SETUP_FILE, { ...setup, verify: { supported: verify.supported, total: verify.total, sources: verify.sources, flagged: verify.flagged, degraded: verify.degraded } });
  }

  // Rebuild the SourceResult the generator needs from the saved setup.
  const source = {
    topic,
    sources: setup.sources as never,
    claims: setup.claims as never,
    contradictions: setup.contradictions as never,
    timings: { searchMs: 0, extractionMs: 0, claimsMs: 0, totalMs: 0 },
  };

  // ---- Concepts (resumable, one save per success) -------------------------
  const done = readJson<Record<string, { id: string; title: string; summary: string; claims: unknown[]; components: unknown[] }>>(CONCEPTS_FILE) ?? {};
  for (const c of setup.concepts) {
    if (done[c.id]?.components?.length) {
      console.log(`[capture] concept ${c.id}: cached`);
      continue;
    }
    const g = await retry(
      `generate ${c.id}`,
      5,
      () => generateConcept(topic, c, source as never, { timeoutMs: 150_000 }),
      (r) => r.ok,
    );
    if (!g || !g.ok) {
      console.error(`[capture] concept ${c.id} failed all attempts; re-run to resume`);
      continue;
    }
    done[c.id] = { id: g.concept.id, title: g.concept.title, summary: g.concept.summary, claims: g.concept.claims, components: g.concept.components };
    writeJson(CONCEPTS_FILE, done);
    console.log(`[capture] concept ${c.id}: ok (${g.latencyMs}ms)`);
  }

  const missing = setup.concepts.filter((c) => !done[c.id]?.components?.length);
  if (missing.length > 0) {
    console.error(`capture incomplete: ${missing.length}/${setup.concepts.length} concepts missing (${missing.map((c) => c.id).join(", ")}). Re-run 'npm run capture:demo' to resume.`);
    return 1;
  }

  const full = curriculumSpecLooseSchema.safeParse({
    topic,
    level: setup.level,
    concepts: setup.concepts.map((c) => done[c.id]),
    edges: setup.edges,
    sources: setup.sources,
  });
  if (!full.success) {
    console.error("assembled spec invalid:", full.error.issues.slice(0, 5));
    return 1;
  }

  // ---- Hero sim (best effort) --------------------------------------------
  let hero: unknown = null;
  const heroConcept = full.data.concepts[0];
  if (heroConcept) {
    const h = await retry("hero", 3, () => generateHeroSim(topic, heroConcept, source as never, { timeoutMs: 90_000 }), (r) => r.ok);
    hero = h && h.ok ? { conceptId: h.conceptId, ok: true, code: h.spec.code, fallback: h.spec.fallback } : h ? { conceptId: h.conceptId, ok: false, detail: h.detail } : null;
    console.log(`[capture] hero: ${hero && (hero as { ok: boolean }).ok ? "ok" : "unavailable (template sim falls back)"}`);
  }

  const setupFull = readJson<{ verify?: unknown }>(SETUP_FILE) ?? {};
  const verify = (setupFull.verify ?? { supported: 0, total: 0, sources: 0, flagged: 0, degraded: false }) as Record<string, unknown>;

  const payload = {
    topic,
    capturedAt: new Date().toISOString(),
    model: process.env.LLM_MODEL_DEFAULT ?? "unknown",
    note: 'Captured from a real live pipeline run. Used only when live generation fails; always labeled "cached run".',
    spec: full.data,
    sources: setup.sources,
    claims: setup.claims,
    passages: setup.sources.flatMap((s) => s.passages.map((p) => ({ id: p.id, text: p.text, url: s.url, sourceId: s.id }))),
    contradictions: setup.contradictions,
    verify,
    hero,
  };
  writeJson(OUT_FILE, payload);
  console.log(`captured ${full.data.concepts.length} concepts, ${verify.supported}/${verify.total} claims supported → ${path.relative(process.cwd(), OUT_FILE)}`);
  return 0;
}

main()
  .then((c) => process.exit(c))
  .catch((e: unknown) => {
    console.error("capture crashed:", e);
    process.exit(1);
  });
