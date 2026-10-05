/**
 * Source stage (AGENTS.md §4.1, §13.3): search -> passages with stable IDs
 * -> atomic claims; contradictions recorded. Uses the search provider's
 * built-in content extraction (no raw HTML scraping). Results are cached
 * per topic (in-memory + optional localStorage on the client is T6's job).
 */

import type { SearchProvider, SearchResult } from "./search.ts";
import { complete, mapWithConcurrency } from "./llm.ts";
import { z } from "zod";

export type Passage = { id: string; label: string; text: string; url: string };
export type SourceRecord = {
  id: string;
  title: string;
  url: string;
  authority: "paper" | "university" | "textbook" | "explainer" | "other";
  passages: Passage[];
};
export type ExtractedClaim = {
  id: string;
  text: string;
  passageIds: string[];
  sourceIds: string[];
  status: "supported" | "flagged";
  flagReason?: string;
};
export type Contradiction = { claimIds: [string, string]; note: string };
export type SourceResult = {
  topic: string;
  sources: SourceRecord[];
  claims: ExtractedClaim[];
  contradictions: Contradiction[];
  timings: { searchMs: number; extractionMs: number; claimsMs: number; totalMs: number };
};

const MAX_SOURCES = 8; // §13.3: best 6-8 for the demo path

/** Crude authority ranking by URL signals; good enough for the demo path. */
export function rankAuthorityHint(url: string): SourceRecord["authority"] {
  const u = url.toLowerCase();
  if (/\.edu|\.ac\.[a-z]{2}\b|libretexts|arxiv\.org|\/pdf\//.test(u)) return "university";
  if (/ncbi\.nlm\.nih\.gov|doi\.org|nature\.com|science\.org|ieee|\bjournal\b/.test(u)) return "paper";
  if (/textbook|openstax|wikibooks/.test(u)) return "textbook";
  if (/wikipedia\.org|khanacademy\.org|britannica\.com|stackexchange\.com/.test(u)) return "explainer";
  return "other";
}

const rankAuthority = rankAuthorityHint;

/** Slice extracted content into passage-sized chunks with stable IDs. */
export function slicePassages(sourceId: string, content: string, targetChars = 900): Passage[] {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length && chunks.length < 6) {
    let end = Math.min(start + targetChars, clean.length);
    if (end < clean.length) {
      const cut = clean.lastIndexOf(". ", end);
      if (cut > start + targetChars * 0.5) end = cut + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    start = end;
  }
  return chunks
    .filter((t) => t.length > 80)
    .map((text, i) => ({ id: `${sourceId}-p${i + 1}`, label: "extracted", text, url: "" }));
}

const claimsSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().min(1),
        passageRefs: z.array(z.string().min(1)).min(1),
      }),
    )
    .max(8),
  contradictions: z
    .array(
      z.object({
        claimIndexA: z.number().int().nonnegative(),
        claimIndexB: z.number().int().nonnegative(),
        note: z.string().min(1),
      }),
    )
    .default([]),
});

const CLAIMS_SYSTEM =
  "You extract atomic factual claims from source passages for a study app. Output ONLY JSON of shape {\"claims\":[{\"text\":string,\"passageRefs\":[string]}],\"contradictions\":[{\"claimIndexA\":number,\"claimIndexB\":number,\"note\":string}]}. Each claim must be one atomic, self-contained fact paraphrased from the passages (no quotes over 15 words). passageRefs must be passage IDs from the provided list. contradictions pairs claim indices that disagree, with a short note.";

function passagesPrompt(passages: Passage[], budgetChars = 6000): string {
  // Cap combined passage text: the claims call is on the critical path for
  // the ~15 s skeleton budget (§13.2), and NIM latency scales with input.
  const selected: Passage[] = [];
  let used = 0;
  for (const p of passages) {
    if (used + p.text.length > budgetChars) break;
    selected.push(p);
    used += p.text.length;
  }
  const block = selected
    .map((p) => `[${p.id}] (source ${p.url || "n/a"})\n${p.text}`)
    .join("\n\n");
  return `Passages:\n${block}\n\nExtract up to 8 atomic claims with passageRefs. Record contradictions between claims if any.`;
}

const inMemoryCache = new Map<string, SourceResult>();

export async function runSourceStage(
  topic: string,
  provider: SearchProvider,
  opts: { timeoutMs?: number; concurrency?: number } = {},
): Promise<SourceResult> {
  const cached = inMemoryCache.get(topic);
  if (cached) return cached;

  const t0 = Date.now();
  const searchRes = await provider.search({ query: topic, maxResults: MAX_SOURCES });
  const searchMs = Date.now() - t0;

  const top: SearchResult[] = searchRes.slice(0, MAX_SOURCES);
  const sources: SourceRecord[] = top.map((r, i) => {
    const id = `src-${i + 1}`;
    return {
      id,
      title: r.title,
      url: r.url,
      authority: rankAuthority(r.url),
      passages: slicePassages(id, r.content ?? r.snippet ?? ""),
    };
  });

  const withPassages = sources.filter((s) => s.passages.length > 0);

  // Per-source claims extraction (§13.5: flat, small outputs). One failed
  // source degrades alone instead of killing the whole stage; concurrency
  // keeps the stage inside the skeleton latency budget.
  const t1 = Date.now();
  const perSource = await mapWithConcurrency(withPassages, opts.concurrency ?? 4, async (s) => {
    const r = await complete({
      role: "generator",
      system: CLAIMS_SYSTEM,
      messages: [{ role: "user", content: passagesPrompt(s.passages) }],
      schema: claimsSchema,
      temperature: 0.1,
      maxTokens: 900,
      timeoutMs: opts.timeoutMs ?? 45_000,
      rateLimit: { baseMs: 1500, maxRetries: 2 },
    });
    return { source: s, result: r };
  });
  const claimsMs = Date.now() - t1;

  const claims: ExtractedClaim[] = [];
  const contradictions: Contradiction[] = [];
  for (const { source, result } of perSource) {
    if (!result.ok) {
      // Non-crashing failure: this source contributes no claims; the UI and
      // agent-activity panel show the degraded state. Logged, not swallowed.
      console.error(
        `[source] claims failed for ${source.id}: ${result.reason}${result.status ? ` HTTP ${result.status}` : ""}: ${result.detail.slice(0, 200)}`,
      );
      continue;
    }
    const ownIds = new Set(source.passages.map((p) => p.id));
    // Assign IDs in a second pass so they are globally unique and ordered.
    const sourceClaims: Omit<ExtractedClaim, "id">[] = result.data.claims
      .filter((c) => c.passageRefs.every((r) => ownIds.has(r)))
      .map((c) => ({
        text: c.text,
        passageIds: c.passageRefs,
        sourceIds: [source.id],
        status: "supported" as const,
      }));
    const withIds: ExtractedClaim[] = sourceClaims.map((c, i) => ({
      ...c,
      id: `claim-${topicSlug(topic)}-${claims.length + i + 1}`,
    }));
    // Within-source contradictions map directly onto this source's claims.
    for (const cd of result.data.contradictions) {
      const a = withIds[cd.claimIndexA];
      const b = withIds[cd.claimIndexB];
      if (a && b && a.id !== b.id) {
        contradictions.push({ claimIds: [a.id, b.id], note: cd.note });
      }
    }
    claims.push(...withIds);
  }

  const extractionMs = 0; // extraction happens inside the provider (§13.3)
  const result: SourceResult = {
    topic,
    sources,
    claims,
    contradictions,
    timings: {
      searchMs,
      extractionMs,
      claimsMs,
      totalMs: Date.now() - t0,
    },
  };
  inMemoryCache.set(topic, result);
  return result;
}

function topicSlug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "topic";
}
