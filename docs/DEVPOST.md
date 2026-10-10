# Devpost submission (D3)

Text for the Devpost form, mapped to the rubric-to-evidence table in `AGENTS.md` §15.5. Numbers
come from `PROGRESS.md`, `DECISIONS.md` and the spike logs. No participant data is collected or
claimed: the external pre/post instrument ships in `data/eval/` to be run by hand, and the evidence
below is engineering evidence.

## Inspiration / problem

A student revising for a midterm already has better explanations than any chatbot will improvise —
university notes, textbooks, papers. What they do not have is a way to assemble those sources into
one thing they can interact with, and no way to tell which sentences are actually backed by a
source. So they read, highlight, and hope.

**Who it is for:** a self-directed undergraduate revising a hard STEM topic before an assessment —
specifically, a second-year physics student two days before a midterm on superposition and
measurement. They want the prerequisite map of the topic, something to *do* instead of read, and
honesty about where each statement came from.

## What it does

You type one question: **"What do you want to learn?"** Agents then search the web, rank sources by
authority, extract atomic claims with passage-level citations, cross-check them, plan a concept
graph, and stream an interactive learning app into the browser:

- a **live mastery mindmap** (prerequisite graph, node colour = mastery),
- **predict-then-reveal simulations** with an explore lab — sliders, single-shot measurement, and a
  **which-path detector** toggle in the double-slit experiment that stops fringes from building,
- **cited explanations** where every statement is clickable down to the passage, contradictions
  shown as "sources disagree",
- **quizzes and flashcards**, plus an **external pre/post instrument** committed in `data/eval/`
  (10 items, provenance and keys included) that the app deliberately does not generate or
  administer.

Miss a quiz question and the concept **regenerates in a different modality** — the panel is rebuilt
with new content, answers given against the old content are cleared with it, and the node recolours
as mastery changes. Explain-back lets the learner write the idea in their own words; the grader
compares them against the verified claims and names the gap.

## How this answers the AI + Education prompt

The track prompt asks for an AI-powered solution that helps learners move beyond memorization — to
**understand concepts, make connections, and apply what they learn**. Each of the three is a shipped
mechanic, not a slogan:

| Prompt idea | Shipped mechanic | In the demo script |
|---|---|---|
| **Understand concepts** | Every explanatory statement is generated from claims the verifier judged against the passage they cite; unsupported claims never reach the screen. A missed quiz question **regenerates the concept in a different modality** (new content on screen, not a re-worded repeat of what already failed). | 0:52–1:10 (verified badge), 1:10–1:30 (citations, one rejected claim), 2:15–2:35 (modality switch) |
| **Make connections** | The planner emits a prerequisite graph, which streams as a mindmap whose node colour is the learner's mastery — the topic's structure and the learner's gaps are visible at once. | 0:35–0:52 (skeleton), 2:15–2:35 (node recolours after a miss) |
| **Apply what they learn** | Predict-then-reveal simulations (shipped only for concepts a hand-built template genuinely fits, never force-fitted) require a committed prediction before anything runs; the sim lab then lets the learner manipulate the experiment, including a which-path detector that visibly stops fringes from building. Explain-back makes the learner *produce* the idea in a form that **changes from concept to concept** (own words, teaching a beginner, an example of their own, a predicted case, separating it from a look-alike, finding a mistake, one sentence), graded against that concept's verified claims. | 1:30–1:55 (prediction), 1:55–2:15 (sim lab), 2:15–2:35 (explain-back) |

The anti-memorization claim is mechanical: recognition (multiple choice) is only one of the three
interactions, and a failure moves the learner to a different representation rather than repeating
the same text.

## What to check if you cannot check the physics

The demo topic is quantum superposition — most judges will not fact-check the content live. The
engineering claims *are* checkable without the physics:

- **Agent-activity panel** (on screen in the demo): sources found, claims extracted, claims
  verified/rejected, and the stage currently running. The counts are live per run, and a rejected
  claim is visible with the verifier's reason — a rejection the app chose to show.
- **The citation chain is clickable end to end:** inline marker → claim row → the passage text →
  the source link (`[authority] title ↗`). "Sources disagree" is rendered as its own state, never a
  silent average.
- **The engineering surface:** `npm run check` (typecheck + eslint + **217 tests across 27 files** +
  production build, exit 0) is the single gate used at every green checkpoint — re-measured 2026-10-10
  on the tree being shipped;
  per-IP rate limits guard every
  route that spends money (6 generation / 10 min, 40 concept / 10 min, 20 explain-back / 10 min);
  every failure path renders a visible state (concept retry, honest error, or the cached run
  labelled "cached run"); keys stay server-side; a deterministic topic safety check refuses harmful
  topics before any provider call.
- **Architecture diagram** in `README.md` (mermaid): the four stages and exactly where the cached
  run can and cannot appear.
- **Model spike with numbers:** 10/10 valid JSON, 10/10 planted factual errors caught, 5.1 s median
  (`DECISIONS.md`).

## How it works (technical approach)

```
topic → diagnose* → SOURCE → PLAN → GENERATE (lazy, per concept) → VERIFY → RENDER (streamed) → ADAPT
                                                                      ↑                          │
                                                                      +------ quiz / behaviour ---+
```
*diagnostics were cut (see the cut list); every lesson plans at `beginner`.

- **SOURCE.** Tavily search (top 8, provider-side content extraction — no raw scraping), authority
  ranking, passages sliced with stable IDs (`src-N-pM`), per-source atomic-claim extraction in
  parallel (bounded concurrency 4), within-source contradictions recorded.
- **PLAN.** One planner call over titles + snippet heads produces a flat concept JSON; the skeleton
  mindmap renders immediately and concepts fill in as they arrive.
- **GENERATE.** One generator call per concept, lazily on open, filling a fixed component library —
  the agents never write free-form app code. Exactly one generated canvas demo per run is allowed,
  sandboxed in `iframe sandbox="allow-scripts"` with a `default-src 'none'` CSP, no network, no
  parent-DOM access, a render timeout and an automatic fallback.
- **VERIFY.** Two layers: a deterministic check (no LLM) drops claims citing unknown passages; then a
  verifier judges each claim **only** against its cited passage text, returning
  `supported | unsupported | contradicted`. Contradicted/unsupported claims never ground generated
  content. **G1 spike: 10/10 planted factual errors caught**; the model also scored 10/10 valid JSON
  against the real schemas at a 5.1 s median.
- **ADAPT.** Per-concept mastery from deterministic rules (quiz results, explain-back, light
  behavioural signals — no Bayesian knowledge tracing), persisted in `localStorage`. A miss
  regenerates the concept in a different modality and shows why.
- **Agent-activity panel.** Sources found, claims extracted, claims verified/rejected, current
  stage — the visible proof this is a pipeline, not a prompt.
- **Abuse/cost protection.** Keys server-side only, per-IP rate limits (6 generate / 10 min,
  40 concept / 10 min, 20 explain-back / 10 min), a deterministic topic safety check that refuses
  clearly harmful requests before any provider call, and a provider spend cap.
- **Demo-safe run.** `data/cached/qm-superposition.json`, captured from a real pipeline run, is used
  **only** when a live request fails and **only** for the demo topic, always labelled "cached run".

**Model / APIs:** NVIDIA NIM (`nvidia/nemotron-3-super-120b-a12b`) behind a provider-agnostic
`complete()` with role-based routing; Tavily for search + extraction; Next.js App Router on Vercel,
no accounts and no database.

## Built during the hackathon (Oct 4–10, 2026)

The rules (checked by the owner) require a publicly viewable repo and a project **substantially
created during the hackathon**, which began **Oct 3, 12:00 PM EDT**. AI coding tools are explicitly
allowed.

- **Repo first commit: `95b1d23`, 2026-10-04 15:11 EDT** — inside the window. **38 commits** through
  the Oct 8 closeout (commit `1399ba2`), plus this docs-only alignment on top — all of the
  application (pipeline, UI, tests, docs) written in this repo on Oct 4–8; Oct 9–10 is reserved for
  recording and submission. No code from a prior project was imported. Repo visibility verified
  public 2026-10-08.
- **AI coding tools were used, disclosed plainly:** the application was built with a coding agent
  (the Codebuff/Freebuff agent) doing most of the implementation under the owner's direction, with
  the owner running acceptance checks, live browser drives and content fact verification. Stated so
  no judge has to wonder.
- **What is cached or adapted, and how it is labelled in the product:**
  - `data/cached/qm-superposition.json` — a real pipeline run captured during the hackathon with
    `npm run capture:demo`, used **only** when a live request fails and **only** on the demo topic,
    always labelled "cached run" in the UI. Never the default path.
  - `data/eval/questions.json` — the pre/post instrument: **4 items verbatim** from a CC BY-SA 4.0
    Wikiversity question bank and **6 adapted** into multiple choice from CC BY-NC-SA 4.0 MIT OCW
    published solutions and a LibreTexts textbook section. The app's own pipeline never generates
    these questions, and since Oct 10 the app does not administer them either — the instrument is
    run by hand. The adapted keys are listed for verification in `BLOCKERS.md`.
  - `fixtures/qm-superposition.json` — a test-only fixture, labelled wherever it appears.

## Impact

- **Evidence, stated honestly.** No participant study was run and none is claimed: the external
  pre/post instrument ships in `data/eval/` (10 items, keys, provenance) for anyone to administer by
  hand. What this build does show is engineering evidence — the verifier catching 10/10 planted
  factual errors in the spike, 217 tests green, five unseen topics run end-to-end on 2026-10-08, and
  per-stage latency logs.
- **Why the demo topic.** Quantum superposition and measurement visualises well, has abundant
  open sources, and is exactly the kind of topic where a plausible-but-wrong study guide costs a
  student real marks.
- **Honest limits.** The participant sample is a small demonstration, not a controlled study; the
  eval questions are external but partly adapted (details in `data/eval/procedure.md`); only two sim
  templates are hand-built (physics-flavoured), so non-physics topics get explanations, quizzes and
  flashcards instead of sliders; verification is entailment (a consistently wrong source passes);
  the safety check is deterministic and shallow; and one-word ambiguous topics can be thinly
  grounded — a claim-relevance gate is the next thing to build.

## Rubric-to-evidence map (`AGENTS.md` §15.5)

| Criterion | Where the evidence is |
|---|---|
| Real-world impact | Persona above; the external pre/post instrument and its procedure in `data/`; limitations stated in `README.md` (including that no participant study is claimed) |
| Technical implementation and AI use | Multi-stage pipeline with passage-level verification, lazy per-concept generation, adaptive loop, sandboxed hero sim, spike numbers (10/10 verifier, 10/10 JSON, 5.1 s median) |
| Innovation | Generated interactive components + source-grounded verification + *visible* adaptation (quiz miss → different modality with a reason), explain-back grading against verified claims |
| Execution and completeness | Deployed link working on arbitrary topics, 217 tests green, five unseen topics run end-to-end on 2026-10-08, commit history from the hackathon window |
| Presentation | 3-minute script (`docs/DEMO.md`), architecture diagram in `README.md`, this document, `docs/QA.md` |

## Submission checklist

- [x] Public repo with README (problem, users, architecture diagram, how to run, limitations) — verified public 2026-10-08.
- [x] Docs answer the track prompt explicitly (`docs/DEVPOST.md`, `README.md`, `docs/DEMO.md`).
- [ ] Deployed Vercel link that works on arbitrary topics — tested in incognito.
- [ ] 2-4 minute video: problem, live walkthrough, verification evidence (`docs/DEMO.md`); posted publicly online (rules).
- [ ] `data/` in the repo: the external quiz and its procedure (no participant scores are claimed).
- [ ] `DECISIONS.md` with the model spike, deviations and the cut list.
