import { runSearchStage, runClaimsStage } from "../../../lib/source.ts";
import { runPlanStage } from "../../../lib/plan.ts";
import { generateHeroSim } from "../../../lib/generate.ts";
import { runVerifyStage } from "../../../lib/verify.ts";
import { setVerifiedSource } from "../../../lib/source-cache.ts";
import { toSseChunk, type PipelineEvent } from "../../../lib/pipeline-events.ts";
import { defaultProvider } from "../../../lib/search.ts";
import { rateLimitGuard } from "../../../lib/rate-limit.ts";
import { checkTopicSafety, safetyRefusalResponse } from "../../../lib/safety.ts";
import type { NextRequest } from "next/server";

// Vercel fluid-compute ceiling; per-call timeouts keep us well inside it.
export const maxDuration = 300;

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
  // §13.9: per-IP budget before any provider spend; clear 429, never a hang.
  const limited = rateLimitGuard(req.headers, "generate");
  if (limited) return limited;
  // §13.9: deterministic refusal for clearly harmful topics — no lesson, no crash.
  const safety = checkTopicSafety(topic);
  if (!safety.ok) return safetyRefusalResponse(safety);
  // T14: client cancellation aborts the in-flight provider calls.
  const signal = req.signal;
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
    const claimsPromise = runClaimsStage(topic, search.sources, { timeoutMs: 45_000, signal })
      .then(async (c) => {
        emit({
          type: "claims",
          claims: c.claims,
          contradictions: c.contradictions,
          passages: allPassages,
          atMs: 0,
        });
        const v = await runVerifyStage(
          { claims: c.claims, passages: search.sources.flatMap((s) => s.passages) },
          { signal },
        );
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
    const plan = await runPlanStage(topic, level, search.sources, { timeoutMs: 45_000, signal });
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
    // G3 F4: concepts generate lazily as the user opens them; this route
    // only prepares sources + verified claims (cached for the lazy route).
    emit({ type: "status", stage: "generate", message: "Concepts generate on demand as you open them", atMs: 0 });
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
    // G3 F4: publish the verified source set for lazy per-concept requests.
    setVerifiedSource(topic, composed);
    // Hero sim (T10): one per run, for the first planned concept. Any
    // failure simply drops the hero event detail into the activity feed —
    // never a crash (§3).
    const heroConcept = plan.spec.concepts[0];
    const heroPromise = generateHeroSim(topic, heroConcept, composed, { timeoutMs: 60_000, signal })
      .then((h) => {
        emit({
          type: "hero",
          conceptId: h.conceptId,
          ok: h.ok,
          ...(h.ok ? { code: h.spec.code, fallback: h.spec.fallback } : { detail: h.detail }),
          atMs: 0,
        });
      })
      .catch((e: unknown) => {
        console.error(`[route] hero sim failed: ${e instanceof Error ? e.message : String(e)}`);
      });

    await heroPromise;
  });
}
