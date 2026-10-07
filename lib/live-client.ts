"use client";

/**
 * Browser consumer for /api/generate's SSE stream (fetch + ReadableStream —
 * EventSource cannot POST). Parses `data: {...}` frames into PipelineEvents.
 */
import type { PipelineEvent } from "./pipeline-events";
import type { Concept } from "./spec";

/**
 * Thrown when the server refused the topic on safety grounds (§13.9). The UI
 * renders a friendly panel instead of a generic failure, and no lesson is
 * generated.
 */
export class TopicRefusedError extends Error {
  readonly category: string;
  constructor(message: string, category: string) {
    super(message);
    this.name = "TopicRefusedError";
    this.category = category;
  }
}

export async function runLiveGeneration(
  topic: string,
  onEvent: (e: PipelineEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic }),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = `HTTP ${res.status}`;
    let refused: { message: string; category: string } | null = null;
    try {
      const j = (await res.json()) as { error?: string; refused?: boolean; category?: string };
      if (j.error) detail = j.error;
      if (j.refused) {
        refused = { message: j.error ?? detail, category: j.category ?? "harm" };
      }
    } catch {
      // keep the HTTP status detail
    }
    if (refused) throw new TopicRefusedError(refused.message, refused.category);
    throw new Error(detail);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          onEvent(JSON.parse(line.slice(6)) as PipelineEvent);
        } catch {
          // malformed frame: skip, never crash the run
        }
      }
    }
  }
}

export async function retryConcept(
  topic: string,
  concept: { id: string; title: string; summary: string },
  modality?: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; components?: Concept["components"]; claims?: Concept["claims"]; detail?: string }> {
  const res = await fetch("/api/generate-concept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic, concept, modality }),
    signal,
  });
  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    concept?: { components: Concept["components"]; claims?: Concept["claims"] };
    detail?: string;
    error?: string;
  };
  return {
    ok: Boolean(j.ok),
    components: j.concept?.components,
    claims: j.concept?.claims,
    // Surface route-level errors (rate limit, refusal) so the UI never
    // shows a silent, detail-less failure.
    detail: j.detail ?? j.error,
  };
}
