# EduVoid

**Type one question — "What do you want to learn?" — and get a cited, interactive learning app for that topic: a live mastery mindmap, parameter-driven simulations, sourced explanations, and quizzes whose results regenerate the concepts you missed in a different modality.**

Built for ForgeHacks 2026 (AI + Education track). No accounts, no database — all learning state lives in your browser.

> **Demo topic:** quantum superposition and measurement. The generic input works for any topic; polish effort is concentrated on this path.

---

## The problem

A motivated learner already has better explanations than a chatbot can improvise — university course notes, textbooks, papers. What they don't have is a way to *assemble* those sources into something they can actually interact with, and no way to know which statements are actually backed by a source versus plausible-sounding filler.

EduVoid's answer is not "ask an LLM to write a study guide". It is an agent pipeline that **sources, plans, generates, and then verifies** — every explanatory statement is tied to a specific source passage, unsupported claims are dropped, and the app shows you the agents' work.

## Who it's for

**Draft persona (needs owner confirmation — see `DECISIONS.md`):** a self-directed undergraduate revising a hard STEM topic before an assessment. They know how to search, but want a single interactive artifact that shows the prerequisite structure of the topic, lets them *predict-then-test* their intuition with sliders, and tells them honestly which claims came from where.

## What it does

1. You type a topic.
2. Agents search the web, rank sources by authority, extract atomic claims, and **cross-check** them against the passages they cite.
3. A planner produces a concept graph (prerequisites included) that renders immediately as a **skeleton mindmap**.
4. Each concept is generated on demand from the verified claims — an explanation, quizzes, flashcards, and a parameter-driven simulation.
5. Citations are clickable; contradictions are surfaced as "sources disagree".
6. Miss a quiz question and the concept **regenerates in a different modality** with a one-line reason ("You missed this, so here it is as a simulation") — the node recolors as mastery changes.
7. A built-in **test mode** runs a pre-test → learning session → post-test and exports per-participant scores as CSV.

## Architecture

```mermaid
flowchart TB
    subgraph Browser["Browser (Next.js client)"]
        Home["Home: one input"]
        Lesson["Lesson view<br/>mindmap · concept panel · activity panel"]
        Store[("localStorage<br/>mastery + eval records")]
        Home --> Lesson
        Lesson <--> Store
    end

    subgraph Server["Vercel serverless (Next.js route handlers)"]
        GenRoute["POST /api/generate (SSE stream)"]
        ConceptRoute["POST /api/generate-concept"]
        RateLimit["rate limit (per IP)"]
        Safety["topic safety check"]
        Cache[("in-memory<br/>verified-source cache, TTL 30 min")]
        GenRoute --> RateLimit --> Safety
        ConceptRoute --> RateLimit --> Safety
        GenRoute --> Cache
        ConceptRoute --> Cache
    end

    subgraph Pipeline["Agent pipeline"]
        Search["SOURCE<br/>search + passages"]
        Plan["PLAN<br/>concept graph"]
        Gen["GENERATE<br/>one call per concept"]
        Verify["VERIFY<br/>passage-level entailment"]
    end

    Search --> Plan --> Gen --> Verify
    Verify --> Gen

    subgraph Providers["External APIs (keys server-side only)"]
        Tavily["Tavily Search"]
        NIM["NVIDIA NIM<br/>nemotron-3-super-120b-a12b"]
    end

    Lesson -- "SSE: sources → skeleton → claims → verified → hero" --> GenRoute
    Lesson -- "lazy per-concept requests" --> ConceptRoute
    Search --> Tavily
    Plan --> NIM
    Gen --> NIM
    Verify --> NIM

    Cached[("data/cached/qm-superposition.json<br/>cached run — used ONLY on live failure")]
    Lesson -. "on live failure, demo topic only" .-> Cached
```

**Flow:** `topic → diagnose → SOURCE → PLAN → GENERATE (parallel, lazy) → VERIFY → RENDER (streamed) → ADAPT`, with quiz/behaviour feeding back into ADAPT.

## How the AI use goes beyond a wrapper

- **Passage-level evidence, not vibes.** Every claim cites passage IDs (not just source IDs). A deterministic check (no LLM) drops claims citing unknown passages; an LLM verifier then judges each claim **only** against the text of the passages it cites, returning `supported | unsupported | contradicted`. Flagged claims never ground generated content, and the UI shows a "verified against N sources" badge with a "sources disagree" state for contradictions.
- **Typed components, not free-form code.** The generator fills a fixed component library (explainer / sim / quiz / flashcards). The only generated code is **one** hero simulation per run, run in a locked-down `<iframe sandbox="allow-scripts">` with a `default-src 'none'` CSP, no network, no parent-DOM access, `postMessage`-only communication, and an automatic fallback to a hand-built template sim on any error.
- **A visible agent-activity panel** showing sources found, claims extracted, claims verified/rejected, and which agent is running.
- **A model spike with real numbers.** `nvidia/nemotron-3-super-120b-a12b` scored **10/10 valid JSON** and **caught 10/10 planted factual errors** against the real schemas, at a 5.1 s median — the only candidate that cleared both thresholds. Full method and the rejected candidates are in `DECISIONS.md`.

## Run it locally

Requires Node 22+ (the scripts use `node --experimental-strip-types`; verified on v22.23.1).

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

### Environment variables

All keys are **server-side only**; nothing is exposed to the browser. See `.env.example` for the annotated list.

| Variable | Purpose |
|---|---|
| `LLM_BASE_URL`, `LLM_API_KEY` | OpenAI-compatible endpoint + key (NVIDIA NIM in the demo) |
| `LLM_MODEL_DEFAULT` (+ per-role `LLM_MODEL_PLANNER` / `_GENERATOR` / `_VERIFIER` / `_GRADER`) | Role-based model routing |
| `LLM_DISABLE_THINKING` | Default `1`: structured calls skip the reasoning channel (see `DECISIONS.md`) |
| `SEARCH_PROVIDER`, `TAVILY_API_KEY` | Web search + built-in content extraction |

If the LLM/search keys are missing, routes return a visible "not configured" state — they never hang or crash.

### Useful scripts

```bash
npm run check          # typecheck + lint + vitest + production build
npm test               # vitest only
npm run capture:demo   # re-capture the demo-safe cached run from the real pipeline
```

## Deploy (Vercel)

1. Import the repo into Vercel; the framework preset is detected automatically.
2. Add the environment variables above to the project (Production + Preview).
3. Deploy. `maxDuration` is 300 s for `/api/generate` and 120 s for `/api/generate-concept`, and every individual model call has its own timeout well inside those.

**Pre-deploy checklist:** `npm run check` green → keys set in Vercel (never committed) → provider spend cap configured → demo topic loads live → cached-run path still works with the APIs unreachable → Vercel `maxDuration` matches the plan's limit.

## Test mode, data, and the demo-safe run

- **Test mode** (`/test`) loads pre/post questions from [`data/eval/questions.json`](data/eval/questions.json). These are **external** questions — the app's own pipeline never generates them, and eval questions are kept separate in code from the in-app quizzes. Results are stored per participant in `localStorage` and exported as CSV. The committed file is a clearly-labeled 2-question **SAMPLE** (one recall + one transfer question) pending the owner's real exam questions; the UI shows a SAMPLE banner while that is the case.
- **Demo-safe cached run:** [`data/cached/qm-superposition.json`](data/cached/qm-superposition.json) is a real pipeline run for the demo topic, captured with `npm run capture:demo`. It is shown **only** when a live request fails and **only** for the demo topic, and is always labeled **"cached run"** in the UI. It is never presented as live and is never the default path.
- **Fixtures:** [`fixtures/qm-superposition.json`](fixtures/qm-superposition.json) is a fixture used by tests; fixtures are labeled wherever they appear.

## Honest limitations

- **Latency.** The mindmap skeleton lands in ~9-13 s, but full setup (sources → claims → verify → hero) is ~2.5 min on the demo topic, and the first concept takes ~26-52 s. Claim extraction and verification dominate; the hero sim is currently awaited before the stream finishes (a logged post-freeze fix).
- **Source quality.** Search uses the provider's built-in content extraction; some pages extract garble (paywalls, JS-rendered content). Extraction failures degrade a single source, not the run.
- **Verification is entailment, not truth.** The verifier judges a claim only against the passage it cites. A source that is wrong but internally consistent passes, and the badge means "supported by these sources", not "objectively true".
- **No accounts, no cross-device state.** Learning state and test records live in one browser, by design. Test sessions are run on the owner's device so scores stay in one place.
- **Safety check is deterministic and shallow.** It refuses clearly harmful requests (weapons/explosives/dangerous-agent synthesis, illegal drugs, targeted harm) with a friendly message; it is not a general content policy.
- **Cost controls are basic.** Per-IP rate limiting (6 generation requests / 10 min) plus a provider spend cap — fine for a hackathon demo, not a production multi-tenant design.
- **Evaluation is a small demonstration, not a controlled study.** Participant numbers (n) are reported honestly in `PROGRESS.md`; sample size is tiny.
- **This was built during the hackathon window** — see the commit history for the build progression.

## Repository layout

```
app/                     Next.js App Router (/, /test, API routes)
components/              UI: mindmap, concept panel, sims, hero sim, activity panel, notices
lib/                     pipeline (source/plan/generate/verify), spec schema, LLM + search,
                         rate limit, safety, cached run, mastery, eval, storage
scripts/                 model spike, probes, benchmarks, capture:demo
tests/                   vitest suites (150 tests)
data/cached/             the captured demo-safe run (committed)
data/eval/               external eval questions (sample pending owner file)
fixtures/                test fixture spec
```

Design notes and the build log live at the repo root (`DECISIONS.md`, `PROGRESS.md`).

## Documentation

- [`DECISIONS.md`](DECISIONS.md) — decisions, deviations, model-spike results, cut list.
- [`PROGRESS.md`](PROGRESS.md) — per-task build log with measured numbers.
- [`TASKS.md`](TASKS.md) — task list and acceptance criteria.
- [`BLOCKERS.md`](BLOCKERS.md) — open owner items.
- [`AGENTS.md`](AGENTS.md) — the build spec this project was built to.
