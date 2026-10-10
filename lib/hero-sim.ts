/**
 * Hero-sim contract (T10, §5.2 + §13.6): one LLM-generated canvas/JS sim
 * per run, validated statically, rendered in a locked-down iframe, and
 * backed by a template sim that takes over on any failure. Pure helpers —
 * no React — so the contract and validation are unit-testable.
 */
import { z } from "zod";
import { SIM_TEMPLATES } from "./sim-templates.ts";

export const HERO_READY_TIMEOUT_MS = 5_000;

/**
 * Frame height (owner feedback, Oct 10: "make the generated demo look better
 * — what is this"): the frame used to be a fixed 320 px, so a demo that drew a
 * canvas AND sliders was cut off mid-slider and the learner had to scroll
 * inside the frame to find the controls. The generated code now reports its
 * real content height and the frame follows it, clamped to this range.
 */
export const HERO_MIN_HEIGHT = 260;
export const HERO_MAX_HEIGHT = 620;
export const HERO_DEFAULT_HEIGHT = 340;

/** Clamp a reported content height into the frame's allowed range. */
export function clampHeroHeight(height: number): number {
  if (!Number.isFinite(height)) return HERO_DEFAULT_HEIGHT;
  return Math.round(Math.min(HERO_MAX_HEIGHT, Math.max(HERO_MIN_HEIGHT, height)));
}

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
  // Layout guard (owner feedback, Oct 10: the generated demo had a fixed-width
  // wrapper and showed scrollbars inside the frame). The generated code can
  // hard-code a pixel width or run taller than the frame; constrain the layout
  // so a horizontal scrollbar can never appear and any scrollbar stays subtle.
  const style =
    // overflow-y stays auto: the frame follows the content height (below), and
    // if a demo still exceeds the frame's ceiling the learner gets a thin
    // scrollbar rather than controls they cannot reach.
    "<style>*{box-sizing:border-box}body{overflow-x:hidden;overflow-y:auto;margin:0;background:#fff;" +
    "font-family:system-ui,-apple-system,sans-serif;color:#18181b}" +
    "body>*{max-width:100%}" +
    "canvas{max-width:100%;height:auto;display:block}" +
    // !important: generated code likes to hard-code a slider width (one
    // capture shipped width:100px), and an inline style would otherwise win.
    "input[type=range]{width:100% !important;accent-color:#7c3aed}" +
    "::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:#e4e4e7;border-radius:3px}" +
    "::-webkit-scrollbar-track{background:transparent}</style>";
  // Height reporter: the parent sizes the iframe to the real content, so a
  // canvas + sliders demo is never clipped. Observes the document, plus one
  // late re-measure for demos that draw after their first frame.
  const measure =
    '<script>(function(){try{var send=function(){var d=document.documentElement,b=document.body;' +
    'var h=Math.max(d?d.scrollHeight:0,b?b.scrollHeight:0,d?d.offsetHeight:0);' +
    'parent.postMessage({type:"hero-sim",status:"height",height:h},"*")};' +
    'if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement)}' +
    'window.addEventListener("load",send);requestAnimationFrame(send);setTimeout(send,250);setTimeout(send,900)}' +
    'catch(e){}})()</script>';
  return (
    `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" ` +
    `content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">${style}</head>` +
    `<body>${trap}${code}${measure}${ping}</body></html>`
  );
}

export const HERO_MESSAGES_SYSTEM =
  "You write ONE small interactive canvas demo for a learning app. Output ONLY JSON of shape " +
    '{"code":string,"fallback":{"template":"two-state-prob"|"double-slit"|"bayes-update","values":{string:number},"predictPrompt":string}}. ' +
    "code is an HTML fragment with exactly one <canvas> plus one inline <script>, embedded in a light card that fills its container. Always use width:100% (never a fixed pixel width) so nothing overflows. Make it look like a polished interactive explainer, NOT a text dump. " +
    'Layout: wrap everything in one <div> with font-family:system-ui, padding:12px, color:#18181b; at most TWO short HTML lines (8 words or fewer each) — the canvas carries the message. Height budget: the whole fragment must stay under about 520px at 600px wide (one ~600x220 canvas, at most three sliders, at most two lines) so nothing needs scrolling. ' +
    "NEVER put a wall of text, a formula, a parameter list or the numbers in stacked HTML lines — that is the text dump this must not be; the canvas draws the picture and the big numbers. " +
    'Canvas: <canvas width=600 height=240 style="width:100%;height:auto"> on a light background; draw with primitives — rounded bars, dots, arcs, curves, thin #e4e4e7 gridlines — and put the current numbers in LARGE type (18px or more), each labelled with what it is, never sentences. ' +
    'Interactivity: one to three <input type=range> sliders with short labels, styled like style="width:100%;accent-color:#7c3aed"; recompute and redraw on each input event, and animate value changes with requestAnimationFrame over about 250ms. ' +
    "Palette: violet #7c3aed primary, amber #f59e0b secondary, zinc #18181b text, #e4e4e7 structure; light background only, rounded shapes. " +
    "Keep it robust: under 90 lines, one script, no libraries, no external assets, no network, no localStorage, no eval; guard division by zero and draw the first frame immediately. " +
    'fallback is a hand-built template sim (2-4 numeric values and ONE prediction question) shown only if the canvas demo fails; pick the template that matches this concept and use exactly these value keys: two-state-prob {p:0..1, n:10..200}, double-slit {d:0.5..5, lambda:0.25..2}, bayes-update {prior:0.01..0.6, sensitivity:0.5..0.99, falsePositive:0.01..0.5}.';
