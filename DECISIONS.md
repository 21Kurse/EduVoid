# DECISIONS.md

Deviations from [DEFAULT]s, dependency justifications, and spike results. Newest entries at the bottom. The Cut list lives at the end.

## 2026-10-04 — T0: Scaffold and repo

- **Repo layout.** T0 says "clone it and work inside the clone"; PROMPT.md offers the alternative of connecting an existing directory to the remote. Used the alternative: `git init` in the thread-workspace root (which already holds `AGENTS.md`/`TASKS.md`/`PROMPT.md`), added `origin`, aligned with `origin/main` (initial commit had `.gitignore`, `LICENSE`, `README.md`). The loop docs are committed at repo root, so "the repo is your memory" holds.
- **Scaffold transport.** Root was non-empty, so `create-next-app` ran in a temp dir and was rsynced in, excluding `.gitignore`/`README.md` to preserve the remote's files. rsync clobbered `AGENTS.md` with Next's auto-generated agent-rules stub; the full spec was restored from the thread's instruction copy.
- **Next.js agent-rules block.** Next 16 tooling upserts a managed `<!-- BEGIN:nextjs-agent-rules -->` block into `AGENTS.md` on dev/build (idempotent, `node_modules/next/dist/server/lib/generate-agent-files.js`). Kept: it warns that Next 16 APIs may differ from training data (checked against `node_modules/next/dist/docs/` before writing app code). `CLAUDE.md` (`@AGENTS.md`) kept as the generated pointer.
- **Dependencies added** (logged per PROMPT.md hard rule):
  - `zod` — mandated by AGENTS.md §2/§3 for schema validation.
  - `vitest` (dev) — chosen over Jest: first-class TS/ESM, no config needed alongside Next, fast. Test runner only; no testing-library until a task needs component tests (T2 review).
  - `@types/node` bumped `^20` → `^22` — vitest 5 peer range; local runtime is Node v22.23.1.
- **npm audit (5 high) accepted, not "fixed".** All trace one dev-only chain: `braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next@16.3.8` (ReDoS in glob patterns, lint tooling only, not runtime). npm's only fix path is downgrading to `eslint-config-next@14` — a breaking downgrade worse than the advisory. Revisit if a patched `eslint-config-next` ships.
- **`.gitignore`.** Extended GitHub's Node template in place (it already covers `node_modules`, `.env*` with `!.env.example`, `.next`, `out`, `dist`, `coverage`, `*.log`); appended §14 items it lacked (`.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`, `*.swp`, `.vercel/`) plus `.freebuff/` (local client metadata).
- **Home page.** Minimal placeholder ("What do you want to learn?" heading) instead of scaffold branding; the real single-question UI is T2.

## 2026-10-04 — T2: UI dependencies added

- `@xyflow/react` (React Flow v12) — the §5.1 mastery mindmap is the centerpiece; React Flow is the §2 [DEFAULT] for the mindmap. `nodesDraggable=false`, invisible handles, custom node component.
- `react-markdown` + `remark-math` + `rehype-katex` + `katex` — §2 [DEFAULT] KaTeX for math in explainers; react-markdown chosen over hand-rolled markdown parsing for safety (no raw HTML by default) and pipeline compat with the later pipeline renderers (T6+).
- `emptyMastery()`/thresholds in `lib/mastery.ts` are provisional; T11 tunes them with the owner.
- UI is light-only per [DECIDED] style; no dark-mode override shipped.

## Model spike (G1) — 2026-10-04, NVIDIA NIM

Owner supplied an NVIDIA NIM endpoint (OpenAI-compatible) and a Tavily key. Both verified with minimal calls: NIM `GET /v1/models` → 200, Tavily `/search` → 200. Candidate IDs below are taken verbatim from the API's model list; each was probe-verified as actually served for this account before timing (several listed models are not provisioned — see BLOCKERS.md).

Method: `npm run spike` — 10 planner runs per candidate against the real `curriculumSpecSchema` (after schema retries), plus the 10-planted-error verifier pass judged passage-by-passage. One bug found and fixed during the spike: the spec probe schema wrongly wrapped the spec in an extra `{"spec": …}` layer, inflating failures in the first reasoning-model run; numbers below are from the corrected probe.

| candidate (NIM ID) | JSON valid (of 10) | verifier caught (of 10) | median / max latency | tokens/call (median) | 429/5xx | verdict |
|---|---|---|---|---|---|---|
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (owner's primary) | 7/10 | 10/10 | 15.9 s / 20.9 s | 613 | 2× 503 ResourceExhausted | FAIL: validity < 9, latency ≈ budget, flaky capacity |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | 9/10 | 9/10 | 17.8 s / 31.1 s | 570 | 0 | FAIL: too slow for the ~15 s skeleton budget |
| `nvidia/nemotron-3-super-120b-a12b` | **10/10** | **10/10** | **5.1 s / 6.4 s** | 642 | 0 | **PASS both thresholds** |

Reasoning-token note: NIM did not report `reasoning_tokens` separately for these models (usage.completion_tokens only); `reasoning_content` handling and `<think>` stripping are implemented in the transport/extraction regardless.

**Routing decision (from these numbers):** `nvidia/nemotron-3-super-120b-a12b` for ALL roles — it is the only candidate clearing both thresholds, and it is also the fastest, so no split routing is needed. Set via `LLM_MODEL_DEFAULT` + explicit `LLM_MODEL_PLANNER` / `LLM_MODEL_VERIFIER` (identical values; per-role vars kept so a future override is a one-line env change). The owner's primary nano-omni reasoning model is kept documented above as the verifier-strength fallback candidate should super-120b regress; its 503 capacity flakiness argues against depending on it today.

Infrastructure added while probing (all unit-tested): exponential backoff with a separately bounded 429/5xx retry budget (an earlier unbounded loop hung a test — fixed), per-attempt transport timeout via `AbortSignal` (one listed model hangs indefinitely — never surfaced), `mapWithConcurrency` for parallel generation, and `reasoning_content`/`<think>`-safe JSON extraction.

Local runtime note: `deepseek-ai/deepseek-v4.1-flash` hangs indefinitely on chat completions for this key (curl exit 28 at 45 s, no response); excluded. `nvidia/llama-3.1-nemotron-ultra-253b-v1`, `nemotron-nano-3-30b-a3b`, and several other listed models return 404 "Not found for account" — listed but not provisioned for this key; excluded.

## Structured calls skip the reasoning channel (T14) — 2026-10-07

The G1 spike measured `nvidia/nemotron-3-super-120b-a12b` at 10/10 valid JSON, but in sustained use the claims stage stalled: every per-source extraction returned 3.5-4.4 KB of *reasoning prose* in `message.content`, truncated at `max_tokens`, with no JSON anywhere (`[llm] unparseable output` on repeat). Root cause: the model spends its throughput on the thinking channel for structured prompts and is cut off before it emits the answer. A minimal probe confirmed that `chat_template_kwargs: {enable_thinking: false}` returns the JSON directly (`finish_reason: "stop"`, `reasoning_tokens: 0`); `reasoning_effort: "none"` also worked.

**Decision:** `complete()` injects `chat_template_kwargs: {enable_thinking: false}` for every *schema* call (`structuredBodyExtras`, `lib/transport.ts`); explicit caller `bodyExtras` still win. Opt out with `LLM_DISABLE_THINKING=0` for a provider that rejects the field. Documented in `.env.example`.

**Effect (real numbers):** claims extraction on the demo topic went **0 → 61 claims** (55/61 verified), and the demo-safe cached capture completed in a single run after two prior runs failed entirely on this. This is a deviation from a literal reading of §3 (which does not mention thinking suppression); it is a transport detail behind the provider-agnostic `complete()` interface, so swapping providers is still a one-line env change.

## Cut list

- (empty — nothing cut yet)
