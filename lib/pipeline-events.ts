/**
 * SSE event contract shared by the generate route (server) and the live
 * client. Kept in one small module so both sides stay in sync.
 */
import type { CurriculumSpec } from "./spec.ts";
import type { Contradiction, ExtractedClaim, SourceRecord } from "./source.ts";

export type StageName = "sources" | "plan" | "generate" | "verify" | "done";

export type PipelineEvent =
  | { type: "status"; stage: StageName; message: string; atMs: number }
  | { type: "sources"; sources: { id: string; title: string; url: string; authority: string }[]; atMs: number }
  | {
      type: "skeleton";
      concepts: { id: string; title: string; summary: string }[];
      edges: { from: string; to: string }[];
      level: CurriculumSpec["level"];
      atMs: number;
    }
  | {
      type: "concept";
      conceptId: string;
      ok: boolean;
      detail?: string;
      components?: CurriculumSpec["concepts"][number]["components"];
      latencyMs: number;
      atMs: number;
    }
  | {
      type: "verified";
      supported: number;
      total: number;
      sources: number;
      passages: number;
      flagged: number;
      degraded: boolean;
      /** Final per-claim statuses so the UI can update the claims list (T8). */
      verdicts: { id: string; status: "supported" | "flagged"; flagReason?: string }[];
      atMs: number;
    }
  | {
      type: "claims";
      claims: ExtractedClaim[];
      contradictions: Contradiction[];
      passages: { id: string; text: string; url: string; sourceId: string }[];
      atMs: number;
    }
  | { type: "error"; detail: string; atMs: number }
  | { type: "done"; atMs: number };

/** Server-side run state snapshot for the agent-activity panel (§13.10). */
export type ActivityState = {
  stage: StageName;
  sourcesFound: number;
  claimsExtracted: number;
  claimsRejected: number;
  conceptsDone: number;
  conceptsTotal: number;
  messages: string[];
};

export function toSseChunk(event: PipelineEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Re-export for client convenience without widening the stream contract. */
export type { Contradiction, ExtractedClaim, SourceRecord };
