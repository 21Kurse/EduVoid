/**
 * T14: structured calls must avoid the reasoning channel, or the configured
 * nemotron model returns truncated prose instead of JSON (observed as a
 * stalled claims stage). These are the rules for that injection.
 */
import { afterEach, describe, expect, it } from "vitest";
import { structuredBodyExtras } from "../lib/transport";

const saved = process.env.LLM_DISABLE_THINKING;

afterEach(() => {
  if (saved === undefined) delete process.env.LLM_DISABLE_THINKING;
  else process.env.LLM_DISABLE_THINKING = saved;
});

describe("structuredBodyExtras", () => {
  it("disables thinking for schema calls by default", () => {
    delete process.env.LLM_DISABLE_THINKING;
    expect(structuredBodyExtras(true, undefined)).toEqual({
      chat_template_kwargs: { enable_thinking: false },
    });
  });

  it("leaves non-schema calls untouched", () => {
    delete process.env.LLM_DISABLE_THINKING;
    expect(structuredBodyExtras(false, undefined)).toBeUndefined();
  });

  it("honours an explicit opt-out", () => {
    process.env.LLM_DISABLE_THINKING = "0";
    expect(structuredBodyExtras(true, undefined)).toBeUndefined();
  });

  it("lets caller-supplied extras win", () => {
    delete process.env.LLM_DISABLE_THINKING;
    const extras = { chat_template_kwargs: { enable_thinking: true }, top_p: 0.9 };
    expect(structuredBodyExtras(true, extras)).toEqual(extras);
  });
});
