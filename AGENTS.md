# AGENTS.md: ForgeHacks 2026 build spec (AI + Education)

Read this fully before writing code. **Section 13 (Amendments) overrides earlier sections wherever they conflict.** Work is driven by `TASKS.md` via the loop in `PROMPT.md`. Decisions marked **[DECIDED]** come from the owner. Items marked **[DEFAULT]** are your call; follow the default unless you have a concrete reason, and note any deviation in `DECISIONS.md`.

## 0. Constraints

- **GitHub repo:** https://github.com/21Kurse/EduVoid.git — initialize the project here. Set this as the remote origin in T0: `git remote add origin https://github.com/21Kurse/EduVoid.git && git push -u origin main`.
- **Deadline:** Oct 10, 2026, 12:00pm EDT. Target submission by 9:00am EDT for buffer. Today is Oct 4.
- **Solo builder**, ~10 h/day, with you doing most implementation. The bottleneck is verification, integration and real-user testing, not code generation.
- **Judging:** Real-World Impact; Technical Implementation and AI Use ("not just a wrapper"); Innovation; Execution and Completeness (working demo, how much was built during the hackathon); Presentation.
- **Execution beats ambition.** One flawless end-to-end path beats broad flaky features. Never leave main in a broken state; deploy early and often.
- Everything must be built during the hackathon. Do not import prior projects without asking the owner.

## 1. Product

A web app that opens on one question: **"What do you want to learn?"** The user types a topic. Agents search the web for sources, extract and cross-check claims, then generate an interactive learning app in the browser for that topic: a live mastery mindmap, parameter-driven simulations, cited explanations, and quizzes. Quiz results feed back to regenerate weak concepts in a different modality (adaptive loop).

**Design principle [DECIDED]:** radical simplicity. The home screen is one input and nothing else. Do not add level/style/time form fields. Infer level with 2-3 quick diagnostic questions after the topic, and infer modality preference from behavior.

**UI style [DECIDED]:** clean, minimal, light. Generous whitespace, one accent color, system or Inter font, no clutter. Progressive disclosure everywhere.

## 2. Stack

- **[DECIDED]** Next.js (App Router) + TypeScript, full-stack. Deploy on **Vercel** (live demo link required).
- **[DECIDED]** No accounts, no database. State lives in browser storage (`localStorage`/IndexedDB). Learning state must survive reloads.
- **[DEFAULT]** Tailwind CSS; `zod` for schema validation; KaTeX for math; React Flow (or d3) for the mindmap; Framer Motion sparingly.
- **[DEFAULT]** Streaming via route handlers returning SSE or a streamed response; client renders components as they arrive.

### Vercel limits
Serverless functions have execution-time limits. Check the current limits for the owner's plan and set `export const maxDuration` appropriately. Design for it: **one short request per concept**, never one long request for the whole app. Stream partial results. Keep each route comfortably under the limit.

## 3. LLM and search

### LLM [DECIDED, with open item]
The owner wants to use a **GLM Flash model** for the app's agents. **OPEN ITEM (owner must supply):** exact model ID, provider/endpoint, and API key. Do not guess the model string.

Rules:
- Put all model calls behind `lib/llm.ts` with a provider-agnostic interface: `complete({role, system, messages, schema?})`. Configure via env vars (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_<ROLE>`).
- **Role-based routing:** roles `planner`, `generator`, `verifier`, `grader`. Default all to the same model, but allow overriding per role so a stronger model can be used for `planner` and `verifier` if the flash model is unreliable.
- Structured output: request JSON, validate with zod, retry up to 2 times with the validation error appended, then fall back gracefully (skip the component with a visible "couldn't generate this" state, never crash).
- **Day-1 spike:** test the chosen model on (a) valid JSON against a nontrivial schema, (b) a verifier pass that catches a planted factual error. Report results in `DECISIONS.md` before building further.

### Search [DECIDED: agent decides]
**[DEFAULT]** Use Tavily (or Brave Search API / Exa if you have a concrete reason). Put behind `lib/search.ts` so it's swappable. Owner supplies the key. Cache results per topic in memory/`localStorage` to save quota.

## 4. Pipeline

```
topic -> diagnose level (2-3 Qs) -> SOURCE -> PLAN -> GENERATE (parallel) -> VERIFY -> RENDER (streamed)
                                                                    ^                      |
                                                                    +---- ADAPT <---- quiz/behavior
```

1. **Source.** Search the web, fetch the top pages, rank by authority (papers, university course notes, textbooks, reputable explainers; drop SEO junk). **Cap at ~8-15 sources**, not "every source." Extract atomic claims per source. Cross-check: where sources disagree, record the contradiction explicitly and surface it in the UI. Do not reproduce page content; paraphrase and link out. Any direct quote must be under 15 words and attributed.
2. **Plan.** Planner outputs the `CurriculumSpec` JSON (below): concepts, prerequisite graph, and for each concept the chosen component types.
3. **Generate.** One generator call per concept, in parallel, each filling typed templates from the fixed component library. **Do not have agents write free-form app code.**
4. **Verify.** A verifier checks each concept's content against the extracted source claims. Output per claim: `supported | unsupported | contradicted`, with a source ID. Unsupported or contradicted claims are removed or flagged before render. Surface a small "verified against N sources" badge.
5. **Render.** Assemble from the spec, stream concept-by-concept so the first screen appears fast.
6. **Adapt.** See section 6.

### Spec shape (sketch, refine as needed)
```ts
type CurriculumSpec = {
  topic: string; level: "beginner"|"intermediate"|"advanced";
  concepts: Concept[]; edges: {from: string; to: string}[]; // prerequisites
  sources: Source[];
};
type Concept = {
  id: string; title: string; summary: string;
  claims: {id: string; text: string; sourceIds: string[]; status: "supported"|"flagged"}[];
  components: Component[]; // typed union below
};
type Component =
  | {type: "explainer"; markdown: string}
  | {type: "sim"; template: "slider-curve"|"two-state-prob"|"vector-field"; params: object; predictPrompt: string}
  | {type: "hero-sim"; code: string}          // only one per app, sandboxed
  | {type: "quiz"; questions: MCQ[]}
  | {type: "flashcards"; cards: {front: string; back: string}[]};
```

## 5. Component library and interactivity

Build in this priority order. Items 1-3 are mandatory; do not start 4-5 until 1-3 work end-to-end on the demo topic.

1. **Live mastery mindmap (centerpiece).** Nodes = concepts. Click to expand/open. "I don't get this" button regenerates that concept in a different modality. Node color encodes mastery (unseen / struggling / learning / mastered). This is the visible face of the adaptive loop.
2. **Predict, then reveal simulations.** Sim templates have sliders. The user must commit to a prediction (choice or short answer) **before** the sim runs; then compare prediction to outcome. Default to **fixed parametric templates** the LLM fills with parameters. **[DECIDED]** Plus **one hero sim per demo topic as LLM-generated canvas/JS code**, run in a locked-down sandbox: `<iframe sandbox="allow-scripts" srcdoc=...>`, no network, no parent DOM access, communicate via `postMessage`, render timeout, and automatic fallback to a template sim on any error.
3. **Cited claims.** Every explanatory statement is clickable, opening the source and the supporting passage reference. Contradictions are shown as "sources disagree."
4. *(Stretch)* Explain-back: user explains a concept in their own words; grader compares against verified claims and names the gap.
5. *(Stretch)* Socratic mode.

## 6. Adaptive loop and assessment

- Per-concept state: `{mastery: 0..1, attempts, timeSpent, modalityHistory}`; persisted in browser storage.
- Update mastery from quiz results (and lightly from behavior). When a concept is failed, regenerate it with a **different modality** from the one that failed (text -> sim -> worked example -> flashcards) and mark it in the mindmap.
- **Diagnostic [DEFAULT]:** 2-3 questions after topic entry set the starting level and unlock/skip prerequisites.
- **Pre/post learning test [DEFAULT]:** built-in "test mode" that runs a **pre-test, the learning session, then a post-test**, logs per-participant scores with timestamps to browser storage, and exports CSV. **Test questions must NOT be generated by the app's own pipeline.** Load them from `data/eval/questions.json`, which the owner will supply from external sources (real intro university or high-school exam questions). Include at least one transfer question (apply the idea, don't just recall it). In-app concept quizzes during learning are generated; eval questions are external. Keep these two clearly separate in code.

## 7. Demo topic

**[DEFAULT]** Quantum mechanics, narrowed to **superposition and measurement (double-slit / single qubit)**. Reasons: visualizes well, abundant sources, the owner can fact-check the output, and a narrow scope is teachable in about 10 minutes. The generic topic input must still work for any topic, but all polish effort goes into this path. Fallback topic if testers struggle: Fourier transform or Bayes' theorem. Confirm with the owner before switching.

**Demo-safe mode:** cache one complete generated run for the demo topic as a static JSON, used **only** if live APIs fail, and clearly labeled "cached run" in the UI. Never present a cached run as live.

## 8. Eval harness (optional, day 4-5)

Simulated-learner eval for content sufficiency: a fresh agent sees only the generated material and answers questions about a **made-up domain with invented rules** (so training knowledge cannot help). Report accuracy in the README as a **content-sufficiency test, not a measure of human learning.** Use it as a regression check for the planner and verifier.

## 9. Schedule (revised: app must be finished early so the demo can be made well)

| Date | Goal |
|---|---|
| Oct 4 (tonight) | T0-T3: scaffold, Vercel deploy, fixture-driven UI, LLM/search wrappers, model spike (gate G1). |
| Oct 5 | T4-T8: live pipeline (source, plan, generate, verify) streaming, citations, agent-activity panel. |
| Oct 6 | T9-T12: sims, hero sim with fallback, adaptive loop, diagnostics. |
| Oct 7 | T13-T15: test mode, hardening, polish. D1-D4: agent drafts demo script, Q&A, Devpost text; weird-input testing. **FEATURE FREEZE end of day.** Bug fixes only afterward. |
| Oct 8 | Real-user pre/post sessions on the owner's device (screen-recorded). Fix blockers only. Tag final deploy by end of day. |
| Oct 9 | Rehearse narration 10+ times with a timer, record the video, cold-viewer review (section 15.6), README, architecture diagram, publish `data/`. No code changes except critical fixes. |
| Oct 10 | Submit by 9:00am EDT. Buffer only. |

**Cut order if behind:** stretch tasks -> eval harness -> extra sim templates -> Socratic/explain-back. **Never cut:** verifier, adaptive loop, mastery mindmap, deployed link.

## 10. Deliverables checklist (Devpost)

- Public GitHub repo with README: problem and users, technical approach, architecture diagram, how to run, honest limitations.
- Deployed Vercel link that works on arbitrary topics (judges will try their own).
- 2-4 min demo video: problem, live walkthrough, real-participant pre/post results.
- `data/` folder in the repo: the external quiz, per-participant scores, procedure. Report the sample size honestly (small demonstration, not a controlled study).
- `DECISIONS.md` logging deviations and the model spike results.

## 11. Open items the owner must resolve

1. GLM Flash exact model ID, endpoint and API key.
2. Search API key.
3. External quiz questions (source and link) for `data/eval/questions.json`.
4. 3-5 test participants lined up by Oct 7.
5. Check the official rules on pre-existing work before reusing any prior code.
6. Confirm the AI + Education track prompt once it is released.
7. Define the one specific target user (persona) for the README and pitch, e.g. who exactly is learning what and why (draft in `docs/DEVPOST.md`; owner confirms).
8. Find one person outside the project to watch the video cold (section 15.6).

## 12. Engineering rules

- Small commits; keep `main` deployable. Run typecheck and lint before each commit.
- Never commit secrets. `.env.local` for keys; document required vars in `.env.example`. Include a `.gitignore` in T0 (see below).
- Every LLM output is schema-validated. Every failure path renders a visible, non-crashing state.
- Prefer boring, working code over clever code. Ask the owner when a decision is unclear instead of guessing.

## 13. Amendments (post-review; these override earlier sections)

1. **Fixture-first.** Build the UI against `fixtures/qm-superposition.json` (a valid `CurriculumSpec`) before any live pipeline exists. UI and pipeline are decoupled by the spec; the live pipeline replaces the fixture later. This guarantees something demoable from day 1.
2. **Latency budget.** Target: skeleton mindmap from the planner within ~15 s, first concept rendered within ~30 s, all concepts within ~90 s. Log timings per stage. Stage the UX: show the mindmap skeleton first, fill concepts as they stream in.
3. **Do not scrape raw HTML.** Use the search API's built-in content extraction where available. Raw page fetching on serverless is unreliable (paywalls, JS-rendered pages, timeouts). Limit to the best 6-8 sources for the demo path.
4. **Passage-level evidence.** Claims must cite passage IDs, not just source IDs. A deterministic check (no LLM) verifies every cited passage ID exists and that unsupported claims are dropped. The LLM verifier judges entailment against the cited passage only. Gate G1 spike: plant 10 factual errors; record how many the verifier catches. If the chosen model catches fewer than 8/10, route `verifier` (and `planner`) to a stronger model.
5. **Flat, small schemas for the flash model.** Keep per-call JSON outputs small and flat; split large generations into several calls.
6. **Sim reliability.** Hand-build the template sims for the demo topic (two-state probability, double-slit interference); the LLM only supplies parameters and text. The generated hero sim must be validated in the sandbox (renders without error within a timeout) and automatically falls back to a template. Include a forced-failure test.
7. **Visible adaptation.** Whenever the loop regenerates a concept, show a one-line reason ("You missed X, so here it is as a simulation"). Adaptation must be visibly different, not cosmetic.
8. **Test sessions run on the owner's device** (in person or by screen share), so scores and the CSV export live in one place. Do not rely on participants' own browsers.
9. **Abuse and cost protection.** API keys server-side only; per-IP rate limiting on generation routes; set a spend cap at the provider; a lightweight topic safety check that refuses clearly harmful topics (e.g. weapons or dangerous-agent synthesis) with a friendly message.
10. **Agent-activity panel.** A small collapsible view showing sources found, claims extracted, claims verified/rejected, and which agent is running. This is the main demo asset for "not just a wrapper."
11. **Eval harness is optional**: only if all core tasks pass before Oct 7.
12. **Keep mastery logic simple.** Deterministic rules over quiz results and behavior; no Bayesian knowledge tracing.

## 14. .gitignore (create in T0)

```
# Dependencies
node_modules/

# Next.js
.next/
out/

# Environment — never commit keys
.env
.env.local
.env.*.local

# Vercel
.vercel/

# Build output
dist/

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/

# Demo cache (committed intentionally; this is just a reminder not to auto-ignore)
# fixtures/ and data/ are committed — do not gitignore them
```

## 15. Demo and submission playbook (from the hackathon research report)

Source: a compiled report on winning patterns, judging criteria and failure modes (2023-2026). Treat its frequency counts (e.g. "12/15 winners") as **directional, not rigorous**; they are synthesized, not a controlled sample. Advice that does not transfer to this event: live-finals Q&A tactics (apply only if there is a live round), 3-4 person teams with a designer, and hardware/physical-device advantage.

### 15.1 What the research changes for this project

| Finding | Action here |
|---|---|
| Rubrics converge on Execution, Innovation, Impact (about 30% each) with Presentation ~10% explicit but functionally larger, because it gates whether judges understand the rest | The video is the product for most judges. Treat it as a deliverable with its own tasks (D1) and rehearsal time. |
| Problem-first framing; judges must grasp why it matters in the first ~30 s | Video opens with the problem and the specific user, never with "we built X". |
| Working end-to-end flow beats feature breadth; one core flow shown perfectly | Demo shows exactly one path on the demo topic plus one live unseen topic. Stretch features stay out of the video. |
| Hard-coded or fake functionality is a top judge complaint ("show me another input") | See 15.3 honesty rules. Test 5 unseen topics (D4). |
| "Generic AI wrapper" is a named failure mode; agents that act in workflows win | The agent-activity panel (sources found, claims verified or rejected) is shown on screen in the video. Do not describe the product as a chatbot. |
| "What did you cut, and why?" is a favorite judge question | Maintain a **Cut list** in `DECISIONS.md` as you build (what was cut and the reason). |
| Realistic test data; no "test123" or lorem ipsum | Use real topics and real exam questions in the demo. |
| Missing product/design role is a risk for solo builders | Light, minimal UI polish is a priority (T15); get a cold viewer (15.6). |

### 15.2 Video structure (target under 3:00; the form allows up to 4:00)

| Time | Segment | Content |
|---|---|---|
| 0:00-0:20 | Hook | The problem and the specific user, one concrete sentence, one fact if verifiable. |
| 0:20-0:35 | Solution | What it does in one breath: one question in, a verified interactive learning app out. |
| 0:35-2:10 | Live demo | Type a topic -> skeleton mindmap appears -> concepts stream in -> click a citation -> predict-then-reveal sim -> miss a quiz question -> app regenerates that concept in a different modality with the visible reason -> open the agent-activity panel and show a claim the verifier rejected. Narrate while it runs. |
| 2:10-2:35 | Evidence | Participant pre/post results from unedited recordings, honest n, one mixed result included. |
| 2:35-2:55 | Tech and impact | Architecture in one sentence (source, plan, generate, verify, adapt); named models and APIs; who benefits. |
| 2:55-3:00 | Close | Product name and a single closing line. No "any questions". |

### 15.3 Demo honesty rules
- The video shows **live generation** on a topic that is not the cached demo run, ideally one suggested by someone else.
- The cached demo-safe run is for API outages only, always labeled "cached run" in the UI, and never appears in the video as live.
- No hard-coded outputs. Fixtures are labeled as fixtures wherever they appear.
- Show one graceful failure or rejection (the verifier dropping an unsupported claim doubles as error-handling proof).
- Do not open the code editor or terminal in the video; one architecture diagram is enough.
- Do not use an AI-written script; write it yourself from `docs/DEMO.md` notes. Judges read generic scripts as generic.
- Stay under the time limit; rehearse with a timer at least 10 times.

### 15.4 Q&A prep (`docs/QA.md`, drafted by the agent in D2 from real project facts)
Answers, specific to this project, to: (1) What did you cut and why? (2) What happens when the LLM or search API is down or rate-limited? (3) How would this scale to 10k users? (4) Who is the specific user? (5) Why this approach over a plain ChatGPT study guide or NotebookLM? (6) What was the hardest technical problem you solved? Use real numbers from the spike, latency logs and participant data. No invented metrics.

### 15.5 Rubric-to-evidence map (use this in `docs/DEVPOST.md`)

| Criterion | Evidence to cite |
|---|---|
| Real-world impact | Specific user, pre/post participant data with honest n, limitations stated |
| Technical implementation and AI use | Multi-stage agent pipeline, passage-level verification, adaptive loop, planted-error verifier result |
| Innovation | Generated interactive components plus source-grounded verification plus visible adaptation |
| Execution and completeness | Live deployed link on arbitrary topics, repo, built during the hackathon (commit history) |
| Presentation | Video structure in 15.2, README, architecture diagram |

### 15.6 Solo-builder compensation
One person who has never seen the project watches the video cold and states in one sentence what the product does and who it is for. If they cannot, rewrite the hook. Do this on Oct 9 before final upload.
