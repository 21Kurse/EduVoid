"use client";

/**
 * Browser consumer for /api/generate's SSE stream (fetch + ReadableStream —
 * EventSource cannot POST). Parses `data: {...}` frames into PipelineEvents.
 */
import type { PipelineEvent } from "./pipeline-events";
import type { Concept } from "./spec";

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
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      // keep the HTTP status detail
    }
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
): Promise<{ ok: boolean; components?: Concept["components"]; detail?: string }> {
  const res = await fetch("/api/generate-concept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic, concept, modality }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    concept?: { components: Concept["components"] };
    detail?: string;
  };
  return { ok: Boolean(j.ok), components: j.concept?.components, detail: j.detail };
}
