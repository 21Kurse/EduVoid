/**
 * Plan stage (AGENTS.md §4.2): planner call -> CurriculumSpec skeleton
 * (<= 8 concepts, acyclic prerequisites, empty components filled by T6).
 * The plan reads search titles/snippets (not claims), so it can start as
 * soon as search finishes while claim extraction continues in parallel —
 * this keeps the skeleton inside the ~15 s budget (§13.2).
 */

import { complete } from "./llm.ts";
import { curriculumSpecSchema, type CurriculumSpec } from "./spec.ts";
import type { SourceRecord } from "./source.ts";
import { z } from "zod";

const MAX_CONCEPTS = 8;

const planSchema = z.object({
  // Loose upper bound: oversized plans are truncated in code, not rejected.
  concepts: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        summary: z.string().min(1),
      }),
    )
    .max(24),
  edges: z
    .array(z.object({ from: z.string().min(1), to: z.string().min(1) }))
    .max(64)
    .default([]),
});

const PLAN_SYSTEM =
  'You are a curriculum planner. Given a topic, level, and source titles with snippets, output ONLY JSON of shape {"concepts":[{"id":string,"title":string,"summary":string}],"edges":[{"from":string,"to":string}]}. Rules: exactly 5 or 6 concepts; ids lowercase-kebab-case; each summary is ONE short sentence (max 12 words); edges mean "from" must be understood before "to"; the graph must be acyclic; list concepts foundational to advanced (edges must point forward in that order).';

function planPrompt(topic: string, level: string, sources: SourceRecord[]): string {
  const src = sources
    .slice(0, 5)
    .map((s) => `- ${s.title} [${s.url.slice(0, 60)}]: ${s.passages[0]?.text.slice(0, 140) ?? ""}`)
    .join("\n");
  return [
    `Topic: "${topic}"`,
    `Level: ${level}`,
    "Source material (for grounding, do not copy):",
    src || "(no sources available)",
  ].join("\n");
}

function sanitizeId(raw: string, used: Set<string>, i: number): string {
  let id = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!id) id = `concept-${i + 1}`;
  while (used.has(id)) id = `${id}-${i + 1}`;
  used.add(id);
  return id;
}

export type PlanResult =
  | { ok: true; spec: CurriculumSpec; latencyMs: number; model: string }
  | { ok: false; detail: string; latencyMs: number };

/**
 * Prune edges to a clean DAG: keep only edges between known concepts that
 * point forward in the model's concept order. The prompt contract says the
 * model lists concepts foundational -> advanced, so a prerequisite edge must
 * point forward; forward-only edges are acyclic by construction. (Defense in
 * depth: the skeleton is still topo-checked by callers/tests.)
 */
function acyclicEdges(ids: string[], edges: { from: string; to: string }[]): { from: string; to: string }[] {
  const idx = new Map(ids.map((id, i) => [id, i]));
  return edges.filter((e) => {
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    return a !== undefined && b !== undefined && a < b;
  });
}

export async function runPlanStage(
  topic: string,
  level: CurriculumSpec["level"],
  sources: SourceRecord[],
  opts: { timeoutMs?: number } = {},
): Promise<PlanResult> {
  const t0 = Date.now();
  const result = await complete({
    role: "planner",
    system: PLAN_SYSTEM,
    messages: [{ role: "user", content: planPrompt(topic, level, sources) }],
    schema: planSchema,
    temperature: 0.3,
    maxTokens: 700,
    timeoutMs: opts.timeoutMs ?? 45_000,
    rateLimit: { baseMs: 1500, maxRetries: 2 },
  });
  const latencyMs = Date.now() - t0;
  console.log(`[plan] latency=${latencyMs}ms ok=${result.ok}${result.ok ? "" : ` reason=${result.reason}`}`);

  if (!result.ok) {
    return { ok: false, detail: `${result.reason}: ${result.detail.slice(0, 200)}`, latencyMs };
  }

  const raw = result.data;
  const used = new Set<string>();
  const concepts = raw.concepts.slice(0, MAX_CONCEPTS).map((c, i) => ({
    id: sanitizeId(c.id, used, i),
    title: c.title.slice(0, 120),
    summary: c.summary.slice(0, 300),
    claims: [],
    components: [], // T6 generate fills these, streamed concept-by-concept
  }));
  const edges = acyclicEdges(
    concepts.map((c) => c.id),
    raw.edges,
  );

  const spec = curriculumSpecSchema.safeParse({
    topic,
    level,
    concepts,
    edges,
    sources: sources.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      authority: s.authority,
      passages: s.passages.map((p) => ({ id: p.id, label: p.label, text: p.text })),
    })),
  });
  if (!spec.success) {
    return { ok: false, detail: `plan spec invalid: ${JSON.stringify(spec.error.issues).slice(0, 300)}`, latencyMs };
  }
  return { ok: true, spec: spec.data, latencyMs, model: result.model };
}
