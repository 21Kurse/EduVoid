import { describe, expect, it, vi } from "vitest";
import {
  cachedProvider,
  defaultProvider,
  tavilyProvider,
  type SearchProvider,
} from "../lib/search";

describe("search providers", () => {
  it("returns null from env when no key is set (never fakes results)", () => {
    const saved = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    try {
      expect(defaultProvider()).toBeNull();
    } finally {
      if (saved !== undefined) process.env.TAVILY_API_KEY = saved;
    }
  });

  it("maps Tavily results and preserves content extraction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Lecture notes",
              url: "https://edu.example/notes",
              content: "Full extracted content here",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const provider = tavilyProvider("test-key");
      const results = await provider.search({ query: "quantum superposition" });
      expect(results).toHaveLength(1);
      expect(results[0].url).toBe("https://edu.example/notes");
      expect(results[0].content).toBe("Full extracted content here");
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(init.body)).toMatch(/"max_results":8/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("caches repeated queries (quota protection, §3)", async () => {
    const inner: SearchProvider = {
      search: vi.fn().mockResolvedValue([{ title: "t", url: "u" }]),
    };
    const provider = cachedProvider(inner);
    await provider.search({ query: "same" });
    await provider.search({ query: "same" });
    expect(inner.search).toHaveBeenCalledTimes(1);
  });
});
