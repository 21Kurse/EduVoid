/**
 * Hero-sim contract (T10, §5.2 + §13.6): one LLM-generated canvas/JS sim
 * per run, validated statically, rendered in a locked-down iframe, and
 * backed by a template sim that takes over on any failure. Pure helpers —
 * no React — so the contract and validation are unit-testable.
 */
import { z } from "zod";
import { SIM_TEMPLATES } from "./sim-templates.ts";

export const HERO_READY_TIMEOUT_MS = 5_000;

export const heroSimSchema = z.object({
  /** HTML fragment with exactly one <canvas> and inline script(s) only. */
  code: z.string().min(40),
  fallback: z.object({
    // Permissive on purpose: a hero generated before the hand-built set was
    // restricted still validates. `simTemplateOrDefault` coerces the id at
    // render time, so a reserved template can never reach the UI.
    template: z.enum(SIM_TEMPLATES),
    values: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
    predictPrompt: z.string().min(1),
  }),
});

export type HeroSimSpec = z.infer<typeof heroSimSchema>;

/** Forbidden constructs: no network, no eval, no remote code. */
const FORBIDDEN = [
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "import(",
  "eval(",
  "document.cookie",
  "localStorage",
  "sessionStorage",
  "indexedDB",
];

/**
 * Server-side static validation (§13.6): reject obviously broken or unsafe
 * code before it ever reaches the client. Runtime failures are still
 * caught client-side by the ready-timeout and error forwarding.
 */
export function validateHeroCode(code: string): { ok: boolean; reason?: string } {
  const lower = code.toLowerCase();
  if ((lower.match(/<canvas/g) ?? []).length !== 1) {
    return { ok: false, reason: "must contain exactly one <canvas>" };
  }
  if (/<script[^>]*\ssrc=/.test(lower)) return { ok: false, reason: "remote scripts are forbidden" };
  for (const bad of FORBIDDEN) {
    if (lower.includes(bad.toLowerCase())) return { ok: false, reason: `forbidden construct: ${bad}` };
  }
  return { ok: true };
}

/**
 * Build the sandboxed srcdoc: CSP blocks all network from inside the frame,
 * an error trap forwards runtime failures to the parent, and a ready ping
 * is sent after two animation frames (canvas laid out and drawn).
 */
export function wrapHeroCode(code: string): string {
  const trap = `<script>window.onerror=function(m){parent.postMessage({type:"hero-sim",status:"error",message:String(m)},"*")};</script>`;
  const ping = `<script>(function(){try{requestAnimationFrame(function(){requestAnimationFrame(function(){parent.postMessage({type:"hero-sim",status:"ready"},"*")})})}catch(e){parent.postMessage({type:"hero-sim",status:"error",message:String(e)},"*")}})()</script>`;
  return (
    `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" ` +
    `content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"></head>` +
    `<body style="margin:0;background:#fff">${trap}${code}${ping}</body></html>`
  );
}

export const HERO_MESSAGES_SYSTEM =
  "You write ONE interactive canvas demo for a learning app. Output ONLY JSON of shape " +
    '{"code":string,"fallback":{"template":"two-state-prob"|"double-slit","values":{string:number},"predictPrompt":string}}. ' +
    "code is an HTML fragment with exactly one <canvas> plus one inline <script> that draws a self-contained animation illustrating the concept (no network, no libraries, no external assets, no localStorage, no eval). " +
    "Keep code under 60 lines. fallback is a simple template sim (with 2-3 numeric values and a prediction question) to show if the canvas demo fails; it must be one of the two templates listed above.";
