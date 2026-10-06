import { runSourceStage, type SourceResult } from "../../../lib/source.ts";
import { generateConcept } from "../../../lib/generate.ts";
import { runVerifyStage } from "../../../lib/verify.ts";
import { getVerifiedSource, setVerifiedSource } from "../../../lib/source-cache.ts";
import { defaultProvider } from "../../../lib/search.ts";
import { MODALITY_CYCLE } from "../../../lib/mastery.ts";
import type { NextRequest } from "next/server";

export const maxDuration = 120;

/** Retry one failed concept's generation (T6 acceptance: non-crashing retry). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    concept?: { id?: string; title?: string; summary?: string };
    modality?: string;
  };
  const topic = (body.topic ?? "").trim().slice(0, 120);
  const concept = body.concept ?? {};
  if (!topic || !concept.id || !concept.title) {
    return Response.json({ error: "topic and concept {id,title} are required" }, { status: 400 });
  }
  // T11: optional modality hint for adaptive regeneration (validated against
  // the fixed cycle — anything else falls back to the default generation).
  const modality =
    body.modality && (MODALITY_CYCLE as readonly string[]).includes(body.modality)
      ? body.modality
      : undefined;
  const provider = defaultProvider();
  if (!provider) {
    return Response.json({ error: "Live generation is not configured." }, { status: 503 });
  }

  // G3 F4: reuse the run's verified source set when warm; on a cold cache
  // re-run source + verify so §4.4 (flagged claims never ground generation)
  // holds in every path.
  let source: SourceResult | null = getVerifiedSource(topic);
  if (!source) {
    const raw = await runSourceStage(topic, provider, { timeoutMs: 45_000 });
    const v = await runVerifyStage({
      claims: raw.claims,
      passages: raw.sources.flatMap((s) => s.passages),
    });
    source = { ...raw, claims: v.claims };
    setVerifiedSource(topic, source);
  }
  const g = await generateConcept(
    topic,
    { id: concept.id, title: concept.title, summary: concept.summary ?? "" },
    source,
    { timeoutMs: 60_000, modality },
  );
  if (!g.ok) {
    return Response.json({ ok: false, detail: g.detail }, { status: 502 });
  }
  return Response.json({ ok: true, concept: g.concept, latencyMs: g.latencyMs });
}
