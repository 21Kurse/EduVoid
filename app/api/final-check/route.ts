import { runFinalCheck, type FinalCheckConcept } from "../../../lib/final-check.ts";
import { rateLimitGuard } from "../../../lib/rate-limit.ts";
import { checkTopicSafety, safetyRefusalResponse } from "../../../lib/safety.ts";
import type { NextRequest } from "next/server";

// One short model call — well inside the fluid-compute ceiling (§2).
export const maxDuration = 120;

const MAX_CONCEPTS = 8;
const MAX_CLAIMS_PER_CONCEPT = 10;

/**
 * Closing question set for a lesson whose concepts are already on screen
 * (owner request, Oct 10: "for Bayes' theorem it also asks questions in the
 * end"). The client sends the lesson's concepts with the claim texts they were
 * generated from — already pipeline-verified — so this route needs no search
 * and no re-verification, and the questions stay grounded in the same
 * evidence the lesson cites (§4.4).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    concepts?: unknown;
    avoidPrompts?: unknown;
  };
  const topic = (body.topic ?? "").trim().slice(0, 120);
  if (!topic) return Response.json({ error: "topic is required" }, { status: 400 });

  // Untrusted client input: bound everything before it reaches the prompt.
  const concepts: FinalCheckConcept[] = (Array.isArray(body.concepts) ? body.concepts : [])
    .slice(0, MAX_CONCEPTS)
    .flatMap((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.title !== "string") return [];
      const claims = (Array.isArray(o.claims) ? o.claims : [])
        .slice(0, MAX_CLAIMS_PER_CONCEPT)
        .flatMap((cl) => {
          const k = (cl ?? {}) as Record<string, unknown>;
          if (typeof k.id !== "string" || typeof k.text !== "string") return [];
          return [{ id: k.id.slice(0, 120), text: k.text.slice(0, 400) }];
        });
      return [
        {
          id: o.id.slice(0, 80),
          title: o.title.slice(0, 120),
          summary: typeof o.summary === "string" ? o.summary.slice(0, 300) : "",
          claims,
        },
      ];
    });
  if (concepts.length === 0) {
    return Response.json({ error: "concepts (with their claims) are required" }, { status: 400 });
  }
  const avoidPrompts = (Array.isArray(body.avoidPrompts) ? body.avoidPrompts : [])
    .filter((p): p is string => typeof p === "string")
    .slice(0, 24)
    .map((p) => p.slice(0, 300));

  // §13.9: same abuse + safety gates as every other provider-spending route.
  const limited = rateLimitGuard(req.headers, "final-check");
  if (limited) return limited;
  const safety = checkTopicSafety(topic);
  if (!safety.ok) return safetyRefusalResponse(safety);

  const r = await runFinalCheck(topic, concepts, { avoidPrompts, signal: req.signal });
  if (!r.ok) {
    console.error(`[route] final check failed (${r.detail})`);
    return Response.json({ ok: false, detail: r.detail }, { status: 502 });
  }
  return Response.json({ ok: true, questions: r.questions, latencyMs: r.latencyMs });
}
