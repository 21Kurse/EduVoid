/**
 * Verify stage (AGENTS.md §4.4, §13.4). Two layers:
 *  1. Deterministic (no LLM): every cited passage ID must exist; claims citing
 *     unknown passages are dropped outright.
 *  2. LLM entailment: each claim is judged ONLY against the text of the
 *     passages it cites. Unsupported or contradicted claims are flagged with
 *     a reason (removed from the "supported" count that backs the badge).
 * The verifier failing must degrade visibly, never crash (§12).
 */

import { complete, mapWithConcurrency } from "./llm.ts";
import { z } from "zod";
import type { ExtractedClaim, Passage, SourceResult } from "./source.ts";

export type VerifySummary = {
  /** Distinct sources backing at least one supported claim. */
  sources: number;
  /** Distinct passages cited by at least one supported claim. */
  passages: number;
  supported: number;
  total: number;
};

export type VerifyResult = VerifySummary & {
  claims: ExtractedClaim[];
  flagged: number;
  /** True when the LLM layer was unavailable and only the deterministic check ran. */
  degraded: boolean;
  verifierMs: number;
};

const verdictSchema = z.object({
  verdicts: z
    .array(
      z.object({
        id: z.string().min(1),
        verdict: z.enum(["supported", "unsupported", "contradicted"]),
      }),
    )
    .max(12),
});

const VERIFY_SYSTEM =
  'You are a strict fact verifier for a study app. You get claims; each cites passage IDs. Judge each claim ONLY against the text of the passages it cites: "supported" if a passage entails it, "unsupported" if no cited passage supports it, "contradicted" if a cited passage contradicts it. Outside knowledge is forbidden. Output ONLY JSON of shape {"verdicts":[{"id":string,"verdict":"supported"|"unsupported"|"contradicted"}]} with one entry per claim id.';

function verifierPrompt(batch: ExtractedClaim[], passageMap: Map<string, string>): string {
  const passageBlock = batch
    .flatMap((c) => c.passageIds)
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .map((id) => {
      const text = (passageMap.get(id) ?? "").slice(0, 700);
      return `[${id}] ${text}`;
    })
    .join("\n");
  const claimBlock = batch
    .map((c) => `{ "id": ${JSON.stringify(c.id)}, "text": ${JSON.stringify(c.text)}, "citedPassages": [${c.passageIds.map((p) => JSON.stringify(p)).join(", ")}] }`)
    .join(",\n");
  return `Passages:\n${passageBlock}\n\nClaims:\n[\n${claimBlock}\n]\n\nJudge each claim against its citedPassages only. One verdict per claim id.`;
}

function summarize(claims: ExtractedClaim[]): VerifySummary {
  const ok = claims.filter((c) => c.status === "supported");
  const okPassageIds = new Set(ok.flatMap((c) => c.passageIds));
  // A source counts when a supported claim cites one of its passages AND
  // lists it in sourceIds (passage id prefix `src-N-pM` -> source `src-N`).
  const sourceIds = new Set<string>();
  for (const c of ok) {
    const passageSources = new Set(c.passageIds.map((p) => p.replace(/-p\d+$/, "")));
    for (const s of c.sourceIds) {
      if (passageSources.has(s)) sourceIds.add(s);
    }
  }
  return {
    sources: sourceIds.size,
    passages: okPassageIds.size,
    supported: ok.length,
    total: claims.length,
  };
}

export async function runVerifyStage(
  sourceResult: Pick<SourceResult, "claims"> & { passages: Passage[] },
  opts: { timeoutMs?: number; batchSize?: number; concurrency?: number } = {},
): Promise<VerifyResult> {
  const t0 = Date.now();
  const passageMap = new Map(sourceResult.passages.map((p) => [p.id, p.text]));

  // Layer 1 — deterministic: unknown passage IDs are dropped, not flagged.
  const checked: ExtractedClaim[] = sourceResult.claims.filter((c) =>
    c.passageIds.every((p) => passageMap.has(p)),
  );
  const droppedUnknown = sourceResult.claims.length - checked.length;
  if (droppedUnknown > 0) {
    console.error(`[verify] dropped ${droppedUnknown} claim(s) citing unknown passages`);
  }

  // Layer 2 — LLM entailment in small flat batches (§13.5). Verdicts are
  // tiny outputs, so batches stay flat while fewer calls cut wall time on
  // the critical path to first concept (§13.2).
  const batchSize = opts.batchSize ?? 12;
  const batches: ExtractedClaim[][] = [];
  for (let i = 0; i < checked.length; i += batchSize) {
    batches.push(checked.slice(i, i + batchSize));
  }

  const verdictById = new Map<string, "supported" | "unsupported" | "contradicted">();
  let degraded = false;
  await mapWithConcurrency(batches, opts.concurrency ?? 4, async (batch) => {
    const r = await complete({
      role: "verifier",
      system: VERIFY_SYSTEM,
      messages: [{ role: "user", content: verifierPrompt(batch, passageMap) }],
      schema: verdictSchema,
      temperature: 0,
      maxTokens: 800,
      timeoutMs: opts.timeoutMs ?? 45_000,
      rateLimit: { baseMs: 1500, maxRetries: 2 },
    });
    if (!r.ok) {
      // Degrade visibly: keep extraction statuses, log loudly. Flagging
      // everything would hide real content behind a verifier outage.
      console.error(`[verify] verifier batch failed: ${r.reason}: ${r.detail.slice(0, 200)}`);
      degraded = true;
      return;
    }
    const seen = new Set<string>();
    for (const v of r.data.verdicts) {
      if (!seen.has(v.id) && batch.some((c) => c.id === v.id)) {
        verdictById.set(v.id, v.verdict);
        seen.add(v.id);
      }
    }
  });

  const flaggedReason: Record<"unsupported" | "contradicted", string> = {
    unsupported: "verifier: not supported by the cited passage",
    contradicted: "verifier: contradicted by the cited passage",
  };
  const claims = checked.map((c): ExtractedClaim => {
    const v = verdictById.get(c.id);
    if (!v || v === "supported") return c;
    return { ...c, status: "flagged", flagReason: flaggedReason[v] };
  });

  const flagged = claims.filter((c) => c.status === "flagged").length;
  return {
    claims,
    flagged,
    degraded,
    verifierMs: Date.now() - t0,
    ...summarize(claims),
  };
}
