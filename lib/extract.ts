/**
 * JSON extraction from model output. Split from lib/llm.ts to keep files
 * small; used by complete() and available to tests.
 */

/** Extract the first JSON object/array from model text (handles prose + fences). */
export function extractJson(text: string): unknown | null {
  // Reasoning models may emit <think>...</think> (or similar) blocks that can
  // contain brace-heavy text; strip them before searching for JSON.
  const cleaned = text.replace(
    /<think>[\s\S]*?<\/think>|<reasoning>[\s\S]*?<\/reasoning>/gi,
    " ",
  );
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], cleaned].filter(
    (s): s is string => typeof s === "string",
  );
  for (const candidate of candidates) {
    const start = candidate.search(/[[{]/);
    if (start === -1) continue;
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}
