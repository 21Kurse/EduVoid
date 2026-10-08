# Q&A prep (D2)

Answers to the six questions in `AGENTS.md` §15.4, from real project facts. Every number here
comes from `PROGRESS.md`, `DECISIONS.md`, the G1 spike or the probe logs — nothing is invented.
Replace `[FILL IN AFTER SESSIONS]` with real participant numbers after the Oct 8 sessions.

## 1. What did you cut, and why?

The cut list lives in `DECISIONS.md`. In one breath: **diagnostics (S4), the simulated-learner eval
harness (S1) and Socratic mode (S3)** were cut; **explain-back (S2) shipped**; nothing mandatory
was.

- **Diagnostics (2-3 questions that set the starting level)** — cut by owner decision, moved to
  Stretch on 2026-10-05. Reason: the agent-activity panel already proves the "agents working, not a
  wrapper" claim on camera, and a level input adds a second screen to the one-question home. Every
  lesson currently plans at `beginner`.
- **Eval harness (a made-up domain with invented rules, answered by a fresh agent)** — optional per
  §13.11 and it lost to the live pipeline in the Oct 4-5 window. The pre/post test mode is the
  shipped evidence mechanism instead; the content-sufficiency check is the one thing I would build
  next.
- **Socratic mode** — cut for scope; explain-back covers the same "produce, don't recognise" idea
  with one grader call.
- **Kept at all costs, per the spec:** the verifier, the adaptive loop, the mastery mindmap and the
  deployed link.
- **Also deliberately not started during the freeze (Oct 8):** a claim-to-concept *relevance* gate.
  Unseen-topic testing showed a vague one-word topic can ground on an unrelated-but-real passage;
  the fix is a new mechanism with ranking-level blast radius, so it is logged as a known boundary
  instead of a last-minute change (`DECISIONS.md`, P3).

## 2. What happens when the LLM or search API is down or rate-limited?

Four layers, in the order a user meets them:

1. **Per-stage degradation, not a dead run.** Search failure returns no sources; claim extraction is
   per-source, so one bad page degrades that source only and the rest of the lesson still generates.
   A verifier batch failure keeps extraction statuses rather than flagging everything
   (`lib/verify.ts`).
2. **Retry with bounded backoff.** The transport retries 429/5xx with exponential backoff inside a
   per-attempt timeout (`lib/transport.ts`); every call has `AbortSignal.any([timeout, req.signal])`,
   so a client disconnect also cancels the upstream call instead of burning tokens.
3. **Visible failure states.** Every failure path renders something a human can read: the concept
   panel shows "Couldn't generate this concept" **with a Retry button**, a modality regeneration
   that fails falls back to a hand-built template sim when one fits (`lib/local-adapt.ts`), and no
   path throws an unhandled error.
4. **Cached demo run, clearly labelled.** If a live request fails **and** the topic is the demo
   topic, the app shows `data/cached/qm-superposition.json` — a real captured run — behind the
   banner "cached run — live generation was unavailable … Not live." and a `cached run · ready`
   badge. Any other topic gets the normal error state; the cache is never a default.

**Rate limits** are per IP and per route: 6 generation requests / 10 min, 40 concept generations /
10 min, 20 explain-back grades / 10 min. Exceeding them returns a friendly message with the wait
time, not a hang (verified: `429` + `retry-after: 525` in the T14 drive). The demo uses 2 requests.

## 3. How would this scale to 10k users?

Honestly: the current build is a single-instance hackathon design, and the bottleneck is provider
spend plus per-request latency, not CPU.

- **What already helps:** the work is split into one short request per concept (never one long
  request for the whole app), concepts are generated lazily on demand, and verified source sets are
  reused from an in-memory cache with a 30-minute TTL — so a class working the same topic pays for
  search + verification once per instance, not once per student.
- **What breaks first:** the in-memory cache is per serverless instance (Vercel scales out, so each
  cold instance re-runs source + verify), and stem extraction/verification calls dominate the
  critical path. At 10k users I would (a) move the verified-source cache to a shared store keyed by
  topic (Redis/Postgres + embeddings-based topic matching), (b) pre-warm the ~50 most common topics
  as published artifacts, (c) budget per-topic spend with a hard cap and a queue for cold topics,
  and (d) keep the lazy per-concept generation, which is the design choice that makes bursty
  traffic affordable in the first place.
- **Numbers to anchor it:** setup is 13-24 s for a fresh topic (five unseen topics, Oct 8) and a
  concept is 2-8 s; one lesson costs about fifteen model calls — one plan, one claim-extraction call
  per source (eight), about five verifier batches (12 claims per batch), one per opened concept, one
  hero, plus an optional grader. Those are the units to queue and cache.

## 4. Who is the specific user?

**A self-directed undergraduate revising a hard STEM topic before an assessment** (draft persona
in `README.md`, owner confirms the final wording). The concrete instance: a second-year physics
student two days before a midterm on superposition and measurement, who has lecture notes and a
textbook and wants (a) the prerequisite structure of the topic visible, (b) something to *do*
rather than read — predict-then-test with sliders, (c) honesty about which sentences come from
which source, and (d) a fast way to discover which concept they actually cannot explain. The demo
topic exists because that student's course exists; the generic input is for the same student in
week 9 of a different course.

## 5. Why this approach over a plain ChatGPT study guide or NotebookLM?

Because the failure mode of a chat study guide is invisible: it reads well whether or not it is
right, and you cannot see which sentence came from where.

- **Passage-level verification.** Every claim cites passage IDs, a deterministic check drops claims
  citing unknown passages, and an LLM verifier judges each claim **only** against the passages it
  cites, returning `supported | unsupported | contradicted`. Flagged claims never ground generated
  content. A chat window has no such gate; a study guide has no such gate. (Numbers: the G1 spike
  planted 10 factual errors and the chosen model caught **10/10**; live runs show badges like
  "verified against 8 sources · 53/55 claims supported".)
- **It produces artifacts, not prose.** A mindmap with mastery state, parameter-driven sims with a
  locked predict step, quizzes whose misses regenerate the concept in a *different modality* with a
  one-line reason, and an explain-back grader that names the claim you failed to convey.
- **It shows the work.** The agent-activity panel lists sources found, claims extracted, claims
  rejected and which stage is running — the "not just a wrapper" evidence on screen.
- **The output is bounded and inspectable.** Generated content fills a fixed component library
  (explainer/quiz/flashcards/sim); exactly one generated canvas demo per run is allowed, sandboxed
  with a CSP and a template-sim fallback. NotebookLM-style tools ground on documents you provide;
  EduVoid builds the curriculum and the interactions, and degrades to an honest error state when it
  cannot.

## 6. What was the hardest technical problem you solved?

Two, in this order:

1. **The verifier had to gate generation, and the model kept burning its budget on the wrong
   channel.** Claims extraction stalled completely: every call returned 3.5-4.4 KB of reasoning
   prose truncated at `max_tokens`, with no JSON anywhere, reproducibly. Root cause was found by
   dumping and byte-inspecting raw responses: (a) the model emitted single-backslash LaTeX inside
   JSON strings (`\\psi`), which is an unrecoverable-*by-retry* parse error, so `lib/extract.ts`
   gained a `sanitizeEscapes` pass that repairs invalid escapes inside strings while leaving valid
   JSON byte-identical (test-enforced); and (b) structured prompts spent the completion budget on
   the thinking channel, fixed by asking the chat template to `enable_thinking: false` for schema
   calls. Effect: claims extraction on the demo topic went **0 → 61 claims** and the capture
   completed in one run after two total failures. The same strictness is why the first concept now
   appears after verification instead of before it — a deliberate trade, since an unverified fast
   answer is the thing this project exists to avoid.
2. **Making the pipeline fast enough to demo honestly.** Claim extraction went from one long call
   to per-source parallel extraction with bounded concurrency: a live bench measured a median
   **139.9 s → 38.2 s (3.67×)** with comparable claim yields, and the setup stream was split so the
   mindmap skeleton lands first (13-24 s on unseen topics) while concepts generate lazily on open
   (2-8 s each). Everything is logged with real timings in `PROGRESS.md` — including the runs that
   were slower than the budget.

## Small print for the video Q&A (if asked cold)

- **Sample size:** `[FILL IN AFTER SESSIONS]` participants, run on the owner's device, pre/post
  external questions, CSV in `data/`. It is a small demonstration, not a controlled study.
- **Where the eval questions come from:** `data/eval/questions.json` — 10 external items (5 pre / 5
  post), 4 verbatim from Wikiversity (CC BY-SA 4.0) and 6 adapted from MIT OCW 8.04 solutions and
  LibreTexts (CC BY-NC-SA 4.0), all fetched 2026-10-08, all keys listed for owner verification in
  `BLOCKERS.md`. They are never produced by the app's own pipeline.
- **Known boundaries:** two sim templates only; verification is entailment, not truth; the safety
  check is deterministic and shallow; one-word ambiguous topics can be thinly grounded.
