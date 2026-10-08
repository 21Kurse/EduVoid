import {
  EXPLAIN_BACK_MAX_CHARS,
  EXPLAIN_BACK_MAX_CLAIMS,
  EXPLAIN_BACK_MIN_CHARS,
  gradeExplanation,
} from "../../../lib/explain-back.ts";
import { rateLimitGuard } from "../../../lib/rate-limit.ts";
import type { NextRequest } from "next/server";

export const maxDuration = 60;

/**
 * Explain-back grading (§5 item 4). The client posts the concept's VERIFIED
 * claims — they are already on screen — plus the learner's explanation; the
 * grader judges coverage of those claims only. Bounded input and its own rate
 * bucket, because this is another door to provider spend (§13.9). The claims
 * are validated as text but not trusted as truth: the worst a caller can do
 * is have a bounded, rate-limited call graded against text they supplied.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    topic?: unknown;
    conceptTitle?: unknown;
    summary?: unknown;
    explanation?: unknown;
    claims?: unknown;
  };
  const topic = String(body.topic ?? "").trim().slice(0, 120);
  const conceptTitle = String(body.conceptTitle ?? "").trim().slice(0, 200);
  const summary = String(body.summary ?? "").trim().slice(0, 400);
  const explanation = String(body.explanation ?? "").trim().slice(0, EXPLAIN_BACK_MAX_CHARS);
  const rawClaims: unknown[] = Array.isArray(body.claims) ? body.claims : [];
  const claims = rawClaims
    .map((c) => (c && typeof c === "object" ? (c as { id?: unknown; text?: unknown }) : null))
    .filter(
      (c): c is { id: string; text: string } =>
        c !== null && typeof c.id === "string" && typeof c.text === "string",
    )
    .slice(0, EXPLAIN_BACK_MAX_CLAIMS)
    .map((c) => ({ id: c.id.slice(0, 80), text: c.text.slice(0, 400) }));

  if (!topic || !conceptTitle || claims.length === 0) {
    return Response.json(
      { error: "topic, conceptTitle and at least one claim are required" },
      { status: 400 },
    );
  }
  if (explanation.length < EXPLAIN_BACK_MIN_CHARS) {
    return Response.json(
      { error: `Write at least ${EXPLAIN_BACK_MIN_CHARS} characters — a sentence is enough.` },
      { status: 400 },
    );
  }

  const limited = rateLimitGuard(req.headers, "explain-back");
  if (limited) return limited;

  const r = await gradeExplanation(
    { topic, conceptTitle, summary, claims, explanation },
    { signal: req.signal },
  );
  if (!r.ok) {
    console.error(`[explain-back] grading failed for "${conceptTitle}": ${r.detail}`);
    return Response.json({ ok: false, detail: r.detail }, { status: 502 });
  }
  return Response.json({ ok: true, summary: r.summary, latencyMs: r.latencyMs });
}
