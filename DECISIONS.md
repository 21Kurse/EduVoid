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

## Final decisions and deviations (T15) — 2026-10-07

- **Lazy concept generation (deviation from a literal §4.3 "GENERATE (parallel)").** The setup stream stops after sources → skeleton → claims → verified + hero; concepts generate on demand via `/api/generate-concept` driven by a client scheduler (opened concept + next-in-prerequisite-order prefetch, in-flight ≤ 2, abort on switch, finished concepts cached). Reason: the §13.2 latency budget wants a fast first screen, and generating every concept up front spent provider budget on concepts the learner never opens. The verified source set is reused from a TTL (30 min) in-memory cache; on a cold instance the lazy route re-runs the stages and re-verifies, so §4.4 holds in every path.
- **Demo topic: quantum superposition and measurement** (AGENTS.md §7 [DEFAULT], unchanged). Confirmed as the polish target; the generic input still works for any topic. Fallbacks (`Fourier transform`, `Bayes' theorem`) were not needed.
- **Target persona (draft — owner must confirm; AGENTS.md §11 item 7).** A self-directed undergraduate revising a hard STEM topic before an assessment: comfortable searching, wants one interactive artifact that shows prerequisite structure, supports predict-then-test with sliders, and states honestly which claims came from where. Drafted by the agent in `README.md`; the owner supplies the final wording for the README and pitch.
- **Eval harness (AGENTS.md §8, optional) was NOT built.** The scheduled window (Oct 4-5) went to the live pipeline, and §13.11 makes it optional. The pre/post test mode (§6) is the shipped evidence mechanism; the simulated-learner content-sufficiency check remains unbuilt.
- **Hero sim is awaited before the stream's `done`** — a known contributor to the ~2.5 min setup wall. Logged in `BLOCKERS.md` as a post-freeze candidate (emit hero lazily, like concepts); not fixed before freeze.
- **Deploy checklist** lives in `README.md` (Deploy section): `npm run check` green, keys in Vercel only, provider spend cap set, live demo topic loads, cached-run path verified with APIs unreachable, `maxDuration` matched to the plan.
- **`.env.example` was corrected**: a stray `[TEMPLATE]` marker line (left by an earlier generated edit) was removed, and `LLM_DISABLE_THINKING` was documented.

## Post-freeze owner request: interactivity (Oct 8) — sim lab + explain-back

The owner reviewed the live app and asked "how can we make it more interactive?", then chose two of the four offered options. Both are additive UI work: the pipeline (source → plan → generate → verify) is untouched, and the single new server route is a bounded, rate-limited grader call.

- **Sim lab (option A, chosen).** The 2026-10-07 build shipped predict-then-reveal sims without the sliders §5.2 calls for — the learner could watch one frozen run but not manipulate anything. Now, after the prediction is committed, each hand-built template unlocks an explore lab: two-state probability gets P(A)/n sliders with single-shot measurement (one dot per click, judged against the binomial spread rather than a fixed tolerance — an earlier ±5-point copy was wrong at small n and was replaced), and double-slit gets d/λ sliders, single-electron firing, and a **which-path detector** switch that visibly stops fringes from building. All math is pure and seeded in `lib/sim-math.ts`; no model call and no network, so the lab cannot break on demo day. This closes a spec gap rather than adding a subsystem, and the reveal stays frozen so the prediction comparison cannot go stale.
- **Explain-back (option B, chosen; §5 item 4).** The learner writes the concept in their own words; `POST /api/explain-back` (new route, `grader` role, its own 20 req / 10 min per-IP bucket) grades the explanation against that concept's VERIFIED claims only — the same claims the sources panel shows. The model returns flat per-claim verdicts; the counts, coverage score, gap fallback and mastery movement are computed deterministically in `lib/explain-back.ts` + `lib/mastery.ts`, so a hallucinated, duplicated or skipped verdict cannot over-credit the learner. Mastery: ≥⅔ of claims conveyed → +0.3, ≥⅓ → +0.05, less → −0.2 (§13.12 deterministic rules, no BKT).
- **Not chosen (offered, declined):** mindmap/quiz/flashcard micro-interactions, and the diagnostic unlock flow (still Stretch S4).
- **Freeze note:** §0/§12 set a feature freeze after T15 (2026-10-07) and the schedule gives Oct 8 to real-user sessions. This was an explicit owner override made before the video is recorded (Oct 9). Scope stayed UI-only plus one isolated route; every new path has unit tests and a live browser check.

## Freeze-period P1 (Oct 8) — external eval questions: source and licence choices

The four choices below were not dictated by the task list; they are the conservative options taken where the brief left room.

- **Verbatim first, adapted only to fill gaps (4 verbatim / 6 adapted).** The only source found that publishes real multiple-choice quantum items *with* a key under an open licence is the Wikiversity Quizbank pair (CC BY-SA 4.0). It yields 2 usable item families for this topic, so both parts use it, and the post twins are the source's own re-ordered variants (version A → D/E) rather than agent-written restatements. The remaining four ideas were adapted from published *solutions* and a published textbook section — never from memory — each keeping the source's own answer as the key with a short quote as justification.
- **Licence posture accepted: CC BY-NC-SA 4.0 for the MIT OCW and LibreTexts items.** The task's allowed set explicitly includes NC, so the lecture/PS items were used non-commercially with attribution; MIT OCW's terms page additionally permits AI use subject to attribution + non-commercial + share-alike. This is the one choice with a plausible owner objection, so it is listed in `BLOCKERS.md` for confirmation (a fallback exists: drop the 3 NC pairs and re-source, at the cost of the numeric Born-rule and collapse items).
- **NPTEL dropped even though it qualified on licence.** Its Born-rule item family has a published key, but the underlying state in the source is not normalised (Σ|c|² = 11/12), which makes the key arguable, and the typeset equations in the PDF could not be re-verified character-by-character in this session. Shipping a key we cannot defend would be worse than shipping fewer items.
- **Transfer items marked in the id, not the prompt.** The prompts are the sources' own text (or minimally adapted), so tagging transfer-ness in the prompt would mean rewriting source wording. `transfer` in the id is documented in `procedure.md` and asserted by `tests/eval.test.ts`. Consequence: the eval UI does not *label* a question as transfer; the owner's pairing table does.
- **`lib/eval.ts` schema kept as-is, including the optional `notice` field.** Removing it would be a code change for a content problem; with the real file the key is absent, so the SAMPLE banner is off, and the field remains the honest marker for any future placeholder.

## Freeze-period P2 (Oct 8) — placeholder sims: where the restriction lives

Three options were available for keeping the unimplemented sim templates out of the UI; the conservative one was taken for each.

- **Restriction in the generation paths, not in the schema.** Narrowing `componentSchema` to the two implemented ids would be the tidiest single gate, but the test fixture legitimately carries `slider-curve` (it was written before the hand-built set existed), so narrowing would either break the fixture or force a data edit outside this task's scope. Instead the schema stays permissive and every path that can put a sim in front of a learner (live generation, adaptation, cached run, hero fallback) passes through one shared guard, with a test asserting the schema and the shared id list cannot drift apart.
- **A reserved sim is dropped, not neutralised.** The alternative was rendering it as a labelled "not available" box; an empty box on stage is still a placeholder a judge would see. Dropping the component leaves the concept's explainer/quiz/flashcards, which is what the task asked for ("skip the sim and use the explainer, quiz, flashcards or the validated hero sim").
- **The hero prompt was tightened but its schema was left permissive.** A hero generated before this change still validates and still renders its canvas; only the *fallback* id is coerced at render time. Narrowing the hero schema would have invalidated the existing cached capture's hero for no user-visible benefit.
- **A parse-time sim filter was added to the cached run even though today's capture has none.** `npm run capture:demo` runs the real pipeline, so the next capture could contain a reserved id the same way this one contains legacy quiz repetition; normalizing at parse time keeps the guarantee next to the equivalent quiz normalization that already exists there.

## Freeze-period P3 (Oct 8) — what unseen-topic testing changed, and what it did not

The ambiguous-topic run exposed two different problems; only one was fixed, and the reasons are recorded here.

- **Fixed: the hero sim's paired template could render under a concept no template fits.** That is a visible, wrong-looking artifact in a judge's own topic, it lives in one component, and the correct decision function already existed for the "I don't get this" fallback — so the fix reuses it rather than adding logic (`fitsLocalTemplate`). Two lines of rendering change plus four tests.
- **Not fixed: thin grounding on a vague one-word topic.** The verifier's job is entailment against the cited passage, and it did that correctly — the passage really does support the sentence; the problem is that the passage itself is about a different sense of the word. Fixing it properly means a claim-to-concept relevance gate (or a "your topic is ambiguous" step), which is a *new* mechanism with prompt- and ranking-level blast radius. Adding it during a feature freeze, two days before recording, would risk the demo path for a case the video does not exercise. Logged in `BLOCKERS.md`-style prose in `PROGRESS.md`, answered honestly in `docs/QA.md`, and named in the README limitations as a known boundary.
- **No safety relaxation:** the refusal run confirms the deterministic check still refuses a harmful construction request before any provider call (HTTP 422, <0.2 s), and the five allowed topics were unaffected.

## Cut list (final, 2026-10-08)

| Item | Status | Why |
|---|---|---|
| **S1 — simulated-learner eval harness (§8)** | **Cut** (optional per §13.11) | The Oct 4-5 window went to the live pipeline; the pre/post test mode is the shipped evidence mechanism instead. Next to build. |
| **S3 — Socratic mode (§5 item 5)** | **Cut** | Scope. Explain-back already covers "produce, don't recognise" with one bounded grader call. |
| **S4 — diagnostics (2-3 questions that set level, was T12)** | **Cut** by owner instruction 2026-10-05 | The agent-activity panel covers the "agents working" need on camera, and a level step adds a second screen to a one-question home. Every lesson plans at `beginner`. |
| **S2 — explain-back (§5 item 4)** | **Shipped** (post-freeze, owner request, 2026-10-08) | One new rate-limited grader route; counts and mastery computed deterministically. |
| `slider-curve` / `vector-field` sim templates | **Not built** | Only the two hand-built templates ship; generation is now gated so a placeholder can never reach a learner (P2). |
| **Claim-to-concept relevance gate** | **Deferred, logged** | Unseen-topic testing found vague one-word topics can ground on an unrelated-but-real passage; the fix is a new mechanism with ranking-level risk, so it is documented as a known boundary instead of a freeze-week change (P3). |

Nothing mandatory was cut: the verifier, the adaptive loop, the mastery mindmap and the deployed link are all in place.
