import { runSearchStage, runClaimsStage } from "../../../lib/source.ts";
import { runPlanStage } from "../../../lib/plan.ts";
import { generateConcept } from "../../../lib/generate.ts";
import { runVerifyStage } from "../../../lib/verify.ts";
import { mapWithConcurrency } from "../../../lib/llm.ts";
import { toSseChunk, type PipelineEvent } from "../../../lib/pipeline-events.ts";
import { defaultProvider } from "../../../lib/search.ts";
import type { NextRequest } from "next/server";

// Vercel fluid-compute ceiling; per-call timeouts keep us well inside it.
export const maxDuration = 300;

const CONCURRENCY = 3;

function sse(handler: (emit: (e: PipelineEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t0 = Date.now();
      const emit = (e: PipelineEvent) => {
        try {
          controller.enqueue(encoder.encode(toSseChunk({ ...e, atMs: Date.now() - t0 })));
        } catch {
          // client disconnected; stream teardown happens below
        }
      };
      try {
        await handler(emit);
      } catch (e) {
        emit({
          type: "error",
          detail: e instanceof Error ? e.message : String(e),
          atMs: Date.now() - t0,
        });
      }
      emit({ type: "done", atMs: Date.now() - t0 });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { topic?: string; level?: string };
  const topic = (body.topic ?? "").trim().slice(0, 120);
  const level = (["beginner", "intermediate", "advanced"] as const).includes(
    body.level as "beginner",
  )
    ? (body.level as "beginner" | "intermediate" | "advanced")
    : "beginner";

  if (!topic) {
    return Response.json({ error: "topic is required" }, { status: 400 });
  }
  const provider = defaultProvider();
  if (!provider) {
    return Response.json(
      { error: "Live generation is not configured (search key missing)." },
      { status: 503 },
    );
  }

  return sse(async (emit) => {
    // Search first (fast, ~1 s): the skeleton depends only on this.
    emit({ type: "status", stage: "sources", message: "Searching sources", atMs: 0 });
    const search = await runSearchStage(topic, provider);
    emit({
      type: "sources",
      sources: search.sources.map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        authority: s.authority,
      })),
      atMs: 0,
    });

    // Claims extraction (slow) runs concurrently with plan + generation;
    // the verifier (§4.4) gates what reaches the generator.
    const allPassages = search.sources.flatMap((s) =>
      s.passages.map((p) => ({ id: p.id, text: p.text, url: s.url, sourceId: s.id })),
    );
    const claimsPromise = runClaimsStage(topic, search.sources, { timeoutMs: 45_000 })
      .then(async (c) => {
        emit({
          type: "claims",
          claims: c.claims,
          contradictions: c.contradictions,
          passages: allPassages,
          atMs: 0,
        });
        const v = await runVerifyStage({ claims: c.claims, passages: search.sources.flatMap((s) => s.passages) });
        emit({
          type: "verified",
          supported: v.supported,
          total: v.total,
          sources: v.sources,
          passages: v.passages,
          flagged: v.flagged,
          degraded: v.degraded,
          verdicts: v.claims.map((cl) => ({
            id: cl.id,
            status: cl.status,
            ...(cl.flagReason ? { flagReason: cl.flagReason } : {}),
          })),
          atMs: 0,
        });
        return { v, contradictions: c.contradictions };
      })
      .catch((e: unknown) => {
        emit({ type: "claims", claims: [], contradictions: [], passages: allPassages, atMs: 0 });
        console.error(`[route] claims extraction failed: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      });

    emit({ type: "status", stage: "plan", message: "Planning concepts", atMs: 0 });
    const plan = await runPlanStage(topic, level, search.sources, { timeoutMs: 45_000 });
    if (!plan.ok) {
      emit({ type: "error", detail: `plan failed: ${plan.detail}`, atMs: 0 });
      return;
    }
    emit({
      type: "skeleton",
      concepts: plan.spec.concepts.map((c) => ({ id: c.id, title: c.title, summary: c.summary })),
      edges: plan.spec.edges,
      level: plan.spec.level,
      atMs: 0,
    });

    emit({ type: "status", stage: "verify", message: "Verifying claims against passages", atMs: 0 });
    emit({ type: "status", stage: "generate", message: "Generating concepts", atMs: 0 });
    // Ground generation in the VERIFIED claim set (§4.4); raw claims were
    // already streamed to the activity panel via the claims event.
    const verified = await claimsPromise;
    const composed = {
      topic,
      sources: search.sources,
      claims: verified?.v.claims ?? [],
      contradictions: verified?.contradictions ?? [],
      timings: {
        searchMs: search.searchMs,
        extractionMs: 0,
        claimsMs: verified?.v.verifierMs ?? 0,
        totalMs: 0,
      },
    };
    await mapWithConcurrency(plan.spec.concepts, CONCURRENCY, async (c) => {
      let g = await generateConcept(topic, c, composed, { timeoutMs: 60_000 });
      if (!g.ok) {
        // One fresh-conversation retry: the error-feedback chain inside
        // complete() can stay polluted by bad raw output; a clean call
        // often succeeds (§3 graceful degradation, per concept).
        console.error(`[route] concept ${c.id} failed (${g.detail}); retrying once`);
        g = await generateConcept(topic, c, composed, { timeoutMs: 60_000 });
      }
      if (g.ok) {
        emit({ type: "concept", conceptId: c.id, ok: true, components: g.concept.components, latencyMs: g.latencyMs, atMs: 0 });
      } else {
        emit({ type: "concept", conceptId: c.id, ok: false, detail: g.detail, latencyMs: g.latencyMs, atMs: 0 });
      }
    });
  });
}
