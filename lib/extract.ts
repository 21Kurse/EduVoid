/**
 * JSON extraction from model output. Split from lib/llm.ts to keep files
 * small; used by complete() and available to tests.
 */

/**
 * Double invalid JSON escape sequences inside string literals. LaTeX-heavy
 * generations emit single-backslash sequences like \psi mid-string, which
 * makes every parse attempt fail identically; doubling them keeps the
 * model's own content. Valid escapes pass through unchanged, so already
 * valid JSON is byte-identical after this pass.
 */
function sanitizeEscapes(candidate: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }
    // Raw control characters (literal newlines/tabs) inside a string are
    // invalid JSON; escape them instead of letting the whole parse fail.
    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }
    if (ch < " ") {
      out += "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
      continue;
    }
    if (ch === "\\") {
      const next = candidate[i + 1];
      if (next !== undefined && /["\\/bfnrtu]/.test(next)) {
        out += ch + next;
        i++;
      } else {
        out += "\\\\";
      }
      continue;
    }
    out += ch;
  }
  return out;
}

/** Extract the first JSON object/array from model text (handles prose + fences). */
export function extractJson(text: string): unknown | null {
  // Reasoning models may emit <think>...</think> (or similar) blocks that can
  // contain brace-heavy text; strip them before searching for JSON.
  let cleaned = text.replace(
    /<think>[\s\S]*?<\/think>|<reasoning>[\s\S]*?<\/reasoning>/gi,
    " ",
  );
  // An unterminated <think> block (truncated mid-reasoning) means everything
  // from the opening tag on is thinking, not answer; drop it. Well-formed
  // blocks were already stripped above, so any tag left here is unclosed.
  const unclosed = cleaned.search(/<think>|<reasoning>/i);
  if (unclosed !== -1) cleaned = cleaned.slice(0, unclosed);
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], cleaned].filter(
    (s): s is string => typeof s === "string",
  );
  for (const candidate of candidates) {
    const clean = sanitizeEscapes(candidate);
    const start = clean.search(/[[{]/);
    if (start === -1) continue;
    const tail = clean.slice(start);
    const end = Math.max(tail.lastIndexOf("}"), tail.lastIndexOf("]"));
    if (end !== -1) {
      try {
        return JSON.parse(tail.slice(0, end + 1)) as unknown;
      } catch {
        // fall through to truncation salvage
      }
    }
    // Also salvage fully unterminated JSON (no closer at all).
    const salvaged = parseTruncated(tail);
    if (salvaged !== null) return salvaged;
  }
  return null;
}

/**
 * Salvage JSON truncated by a token cap: close an open string if needed,
 * then append the missing closing brackets. Still the model's own content.
 */
function parseTruncated(candidate: string): unknown | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of candidate) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (stack.length === 0 && !inString) return null;
  const closers = [...stack].reverse().map((c) => (c === "{" ? "}" : "]")).join("");
  if (!inString) {
    // Trim a dangling comma before the appended closers.
    try {
      return JSON.parse(candidate.replace(/,\s*$/, "") + closers) as unknown;
    } catch {
      return null;
    }
  }
  // Ended inside a string: close it. A trailing escape pair can swallow the
  // closing quote, so peel up to 2 trailing characters until it parses.
  for (let peel = 0; peel <= 2; peel++) {
    const attempt = candidate.slice(0, candidate.length - peel) + '"' + closers;
    try {
      return JSON.parse(attempt) as unknown;
    } catch {
      // keep peeling
    }
  }
  return null;
}
