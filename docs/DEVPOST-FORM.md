# Devpost form fields (paste-ready)

The literal submission form, in the form's own order. [`docs/DEVPOST.md`](DEVPOST.md) is the longer
rubric-mapped version; this file is what you paste. Every number here appears in `DECISIONS.md`,
`PROGRESS.md` or `README.md` — nothing is invented, and no participant study is claimed.

---

## Inspiration

Ask an AI chatbot to explain quantum superposition and you get a good answer in ten seconds. Read it,
close the tab, and try to explain it to a friend the next morning. It is gone — not because the answer
was wrong, but because reading an answer is not the same as learning one.

Worse, you cannot tell which sentences were load-bearing. A study guide that confidently states
something subtly false about measurement costs a student real marks, and the student has no way to
check it.

Two failures, then: **it doesn't stick, and you can't check it.**

That is what EduVoid is built against. Instead of an answer in a chat window, you get a small
interactive app for the topic: a map of what you need to know first, simulations you have to predict
before you're allowed to run, and explanations where every statement is clickable down to the exact
passage it came from — or is dropped before you ever see it. Miss a quiz question and the app does not
repeat itself; it rebuilds that concept as a simulation you can manipulate, and tells you why.

Built for **ForgeHacks 2026, AI + Education**. The focus topic is quantum superposition and
measurement — a topic where a plausible-but-wrong study guide is expensive, and where the physics can
actually be *shown* rather than described.

---

## What it does

**You type one question — "What do you want to learn?" — and nothing else.** No level picker, no style
form, no settings.

Then agents search the web, rank sources by authority, extract claims with passage-level citations,
cross-check them, plan the topic's prerequisite graph, and stream a learning app into your browser:

- **A live mastery mindmap.** Nodes are concepts, edges are prerequisites, and node colour is your
  mastery. It renders as a skeleton before any prose exists, so the structure of the topic and your
  gaps in it are visible at the same time.
- **Predict-then-reveal simulations.** You commit to a prediction before anything runs, then unlock an
  explore lab. In the double-slit lab you fire electrons one at a time and watch fringes build out of
  individual marks — then flip a **which-path detector** switch and watch the fringes stop building.
  Same electrons, same slits, one switch. That is decoherence demonstrated, not described.
- **Cited everything.** Every explanatory sentence carries a marker that opens the claim, the passage
  text, and the source link with its authority label. Sources that disagree are shown as "sources
  disagree" rather than averaged into confident mush. Claims the verifier could not support are
  removed, and the agent-activity panel shows you the count it threw away.
- **An adaptive loop you can see.** Miss a quiz question and that concept is regenerated in a
  *different modality* — a simulation instead of prose, a worked example instead of a definition.
  The panel is rebuilt with new content, the node recolours, and a one-line reason appears: "You
  missed X, so here it is as a simulation."
- **Explain-back.** Write the concept in your own words and the grader compares your text against that
  concept's verified claims, then names the claim you left out. The task rotates per concept — teach a
  beginner, give your own example, separate it from a look-alike — so seven concepts in a row never ask
  you the same thing.

Any topic works. Polish effort went into the quantum path.

---

## How we built it

**Next.js (App Router) + TypeScript, deployed on Vercel. No accounts, no database** — all learning
state (mastery, modality history, attempts) lives in `localStorage` and survives reloads.

The pipeline is the product:

```
topic → SOURCE → PLAN → GENERATE (lazy, per concept) → VERIFY → RENDER (streamed) → ADAPT
                                                        ↑                          │
                                                        +------ quiz / explain-back +
```

- **SOURCE** — Tavily search (top 8, using the provider's own content extraction rather than scraping
  HTML) → authority ranking → text sliced into passages with stable IDs. Each source's atomic claims
  are extracted in parallel.
- **VERIFY** — two layers, and the first has no LLM in it: a deterministic check drops any claim citing
  a passage that does not exist, then the model judges each surviving claim **only against the text of
  the passages it cites**, returning `supported | unsupported | contradicted`. Flagged claims never
  ground generated content.
- **GENERATE** — one call per concept, filling a fixed library of typed components (explainer, sim,
  quiz, flashcards). **The agents never write free-form app code.** The one exception is a single
  generated canvas demo per run, run inside `<iframe sandbox="allow-scripts">` with a
  `default-src 'none'` CSP, no network, no parent-DOM access, a render timeout and an automatic
  fallback to a hand-built sim.
- **ADAPT** — deterministic mastery rules over quiz and explain-back results. No Bayesian knowledge
  tracing; the rules are readable and testable.

**Models and APIs:** NVIDIA NIM (`nvidia/nemotron-3-super-120b-a12b`) behind a provider-agnostic
`complete()` with role-based routing (`planner` / `generator` / `verifier` / `grader`), Tavily for
search, `zod` for every schema. Every model call is schema-validated, retried twice with the
validation error fed back, and degrades to a visible state instead of crashing.

**Numbers from this build:** 10/10 planted factual errors caught by the verifier, 10/10 valid JSON
against the real schemas, 5.1 s median model latency — the model spike that picked the model is in
`DECISIONS.md`, including the two candidates that failed. 217 tests across 27 files green
(`npm run check`). Per-IP rate limits on every route that spends money, keys server-side only, and a
deterministic safety check that refuses harmful topics before any provider call.

---

## Challenges we ran into

**1. The model was failing structurally, not intellectually.** Claim extraction stalled completely:
every call returned 3–4 KB of *reasoning prose* truncated at the token limit, with no JSON anywhere,
reproducibly. Dumping and byte-inspecting the raw responses found two separate causes — the model was
spending its whole completion budget on the thinking channel for structured prompts, and it emitted
single-backslash LaTeX inside JSON strings, an escape error that no amount of retrying can repair. Fixes
were a transport-level `enable_thinking: false` for schema calls and a `sanitizeEscapes` pass in JSON
extraction that repairs invalid escapes while leaving valid JSON byte-identical. **Effect: claims
extraction on the demo topic went from 0 claims to 61.**

**2. Latency — and the counter-intuitive half of it.** Two stages, pulled in opposite directions, both
measured:

- **Claims extraction: made parallel.** One long call became per-source extraction with bounded
  concurrency. Live bench: median **139.9 s → 38.2 s, a 3.67× speedup**, with comparable claim yields.
- **Concept generation: made strictly serial.** This is the one that surprised us. Generating every
  concept in parallel made the lesson arrive out of order and raced the provider; the app now keeps
  **one generation request in flight at a time, in plan order** — first concept, then second, and so on,
  so the lesson fills in the order the mindmap shows it. Opening a concept jumps the queue (and the
  interrupted concept comes back later, still in order). The first concept is ready as fast as before,
  and the rest arrive behind it instead of all at once.

The structural win underneath both: the setup stream stops after sources → skeleton → claims →
verified, and concepts generate on demand. The mindmap skeleton lands in **13–24 s** on unseen topics
and each concept in 2–8 s, instead of one long request that shows nothing until it is entirely done.

**3. Making trust real instead of decorative.** A "verified" badge that doesn't remove anything is
marketing. So the verifier is allowed to delete content: claims go through a deterministic passage-ID
check before any model sees them, then passage-scoped entailment, and unsupported claims never reach
the screen. We measured it by planting 10 factual errors that each contradict their own cited passage
— **10/10 caught**. We also state the limit plainly: this is entailment, not truth. A source that is
wrong but internally consistent will pass.

**4. Not faking interactivity.** An early version put a "commit to your prediction" gate on concepts
with nothing to predict, and paired a probability sim with topics like social inequality where it makes
no sense. Now a sim ships only when a hand-built template genuinely fits that concept's own text — the
check is deterministic, no model, no randomness — and a prediction prompt is something the generator
must justify, not a default. **A topic that doesn't fit gets explanations, quizzes and flashcards
instead of a slider we can't defend.** Two sim templates shipped hand-built; the physics is ours, not
the model's.

**5. Two things we chose not to ship, and why.** The level-diagnostic step was cut because it adds a
second screen to a one-question home; the app plans every lesson at beginner level instead. And an
unseen-topics test found that a vague one-word topic can ground on a real passage about a *different
sense* of the word — the verifier is correct, the passage really does support the sentence. The right
fix is a claim-to-concept relevance gate, which is a new ranking mechanism rather than a patch, so it
is documented in `README.md` as a known boundary instead of being rushed in at the end.

---

## Accomplishments that we're proud of

- **Verification that removes content, not just labels it** — 10/10 on planted errors, with the
  citation chain clickable from a sentence you're reading to the passage it came from and out to the
  source.
- **The double-slit lab.** Fringes build from single electron marks, and a which-path detector switch
  stops them. It is pure deterministic maths in the browser with no model call and no network, so it
  cannot fail on stage — the most convincing thing in the app is also the least likely to break.
- **An adaptive loop that visibly isn't cosmetic.** The concept you missed comes back in a genuinely
  different form, and the app tells you why.
- **Honest failure paths everywhere.** Rate limits return a friendly wait time. Failed concepts show a
  retry, not a spinner. The demo-safe cached run appears **only** when a live request fails, only for
  the focus topic, and is labelled "cached run" in the UI. Nothing cached is ever presented as live, and no lesson content is hard-coded.
- **217 tests green** behind a single `npm run check` gate, and we built all of it in the hackathon
  window.

---

## What we learned

- **Verifying generated content changes what you can build, not just how safe it is.** Once claims are
  passage-scoped, "delete the unsupported ones" becomes a normal design move — and the app can show
  the learner what it refused to teach.
- **The expensive failures were structural, not factual.** The model's knowledge was fine. Its output
  budget, JSON escaping and latency profile were the actual problem, and every one of those was found
  by instrumenting the transport, not by re-prompting.
- **More parallel isn't automatically faster for the learner.** Parallel claim extraction bought 3.67×.
  Parallel concept generation bought a jumbled lesson and raced the provider — serial, ordered
  generation matched what the learner actually sees. Measure the stage, not the instinct.
- **The most valuable thing in the demo is the one with no model in it.** The simulation lab is
  deterministic code, and it's what makes people lean in.

---

## What's next for EduVoid

Next, we're adding AI chat that works at the sentence level. You'll be able to select any sentence in a
lesson and ask about it directly, with answers grounded in that passage — so the conversation stays
inside the evidence instead of drifting into general knowledge.

We also want you to bring your own sources: PDFs, lecture notes, course materials. Instead of learning
from general web search, the pipeline verifies claims against the texts you're actually being examined
on.

And two things this build already points at: a **claim-to-concept relevance gate**, so vague one-word
topics get asked to clarify rather than grounded thinly, and **real participant data** — the external
10-item pre/post instrument already ships in `data/eval/` for anyone to run by hand.

---

## Built With (tag list)

`next.js` · `typescript` · `react` · `tailwindcss` · `vercel` · `nvidia-nim` ·
`nvidia-nemotron-3-super-120b-a12b` · `tavily` · `zod` · `react-flow` · `katex` · `vitest` ·
`localstorage`
