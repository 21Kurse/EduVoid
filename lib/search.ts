/**
 * Swappable web-search access (AGENTS.md §3, [DEFAULT] Tavily). The live
 * provider is constructed only when TAVILY_API_KEY exists — the app never
 * silently falls back to fake results (PROMPT.md hard rule). Tests build
 * mock providers explicitly. Results are cached per query in memory to
 * save quota (§3).
 */

export type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
  /** Extracted page content when the provider supplies it (§13.3: no raw scraping). */
  content?: string;
};

export type SearchQuery = { query: string; maxResults?: number };

export interface SearchProvider {
  search(q: SearchQuery): Promise<SearchResult[]>;
}

/** Tavily search + built-in content extraction (no raw HTML scraping, §13.3). */
export function tavilyProvider(apiKey: string): SearchProvider {
  return {
    async search({ query, maxResults = 8 }: SearchQuery): Promise<SearchResult[]> {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          include_answer: false,
          // Built-in extraction per §13.3; raw page fetching is not used.
          include_raw_content: false,
        }),
      });
      if (!res.ok) {
        throw new Error(`Tavily HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        results?: { title?: string; url?: string; content?: string }[];
      };
      return (json.results ?? [])
        .filter((r): r is { title: string; url: string; content?: string } =>
          Boolean(r.title && r.url))
        .map((r) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 300), content: r.content }));
    },
  };
}

/** Live provider from env; null when unconfigured (callers must handle it visibly). */
export function providerFromEnv(): SearchProvider | null {
  const key = process.env.TAVILY_API_KEY?.trim();
  return key ? tavilyProvider(key) : null;
}

/** In-memory cache keyed by query string (§3: cache to save quota). */
export function cachedProvider(inner: SearchProvider): SearchProvider {
  const cache = new Map<string, SearchResult[]>();
  return {
    async search(q) {
      const key = q.query;
      const hit = cache.get(key);
      if (hit) return hit;
      const results = await inner.search(q);
      cache.set(key, results);
      return results;
    },
  };
}

/** Deterministic default provider resolution for route handlers (T4+). */
export function defaultProvider(): SearchProvider | null {
  const live = providerFromEnv();
  return live ? cachedProvider(live) : null;
}
