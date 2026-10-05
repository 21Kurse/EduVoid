import { runSourceStage } from "../../../lib/source.ts";
import { generateConcept } from "../../../lib/generate.ts";
import { defaultProvider } from "../../../lib/search.ts";
import type { NextRequest } from "next/server";

export const maxDuration = 120;

/** Retry one failed concept's generation (T6 acceptance: non-crashing retry). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    concept?: { id?: string; title?: string; summary?: string };
  };
  const topic = (body.topic ?? "").trim().slice(0, 120);
  const concept = body.concept ?? {};
  if (!topic || !concept.id || !concept.title) {
    return Response.json({ error: "topic and concept {id,title} are required" }, { status: 400 });
  }
  const provider = defaultProvider();
  if (!provider) {
    return Response.json({ error: "Live generation is not configured." }, { status: 503 });
  }

  const source = await runSourceStage(topic, provider, { timeoutMs: 45_000 });
  const g = await generateConcept(
    topic,
    { id: concept.id, title: concept.title, summary: concept.summary ?? "" },
    source,
    { timeoutMs: 60_000 },
  );
  if (!g.ok) {
    return Response.json({ ok: false, detail: g.detail }, { status: 502 });
  }
  return Response.json({ ok: true, concept: g.concept, latencyMs: g.latencyMs });
}
