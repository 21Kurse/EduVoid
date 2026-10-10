# EduVoid demo script — v2 (target 2:55, hard limit 3:00)

For a solo builder with ~4 hours. Structure follows `hackathon-winning-research-report.md` §4.1
(**Problem → Solution → Live demo → Tech+impact → Close**); the long shot list stays in `DEMO.md`.

**What changed from v1.** v1 described the product in order. This one is built around **three turns**
— moments where what the viewer expects flips, each one *shown* rather than claimed:

| Turn | Where | What flips |
|---|---|---|
| **The physics turn** | Beat 5 | Fringes build, then the which-path detector stops them. Same electrons, one switch. |
| **The integrity turn** | Beat 7 | The app shows you the sentences **it threw away**. Promised in Beat 3, paid off here. |
| **The generality turn** | Beat 8 | A topic chosen by someone who isn't you. |

Turns are why this reads as interesting rather than informative, and all three are already in the app.
Beat 5 is the centerpiece: budget the most time there and say the least.

**Budget, measured not guessed:** the `SAY` lines total **394 words** — **≈2:38 of speech** at a calm
150 wpm (counted with `grep '^>' docs/DEMO-SCRIPT.md | sed 's/\[[^]]*\]//g' | wc -w`, so it excludes the
bracketed placeholders; per-beat counts are on each beat heading). The beat table adds up to 2:58 including ~14 s of deliberate silence on the sim
clicks. Do not add narration — if you have spare seconds, *hold* the silent marks longer.

## Numbers you will say out loud (two are verified here; two you must read off the screen)

| Say | Where it comes from | Status |
|---|---|---|
| **217 tests green** | `npm test` → "217 passed (217), 27 files", exit 0 | ✅ measured 2026-10-10 on this tree |
| **10 of 10 planted errors caught** | verifier spike, `DECISIONS.md` + `npm run probe:verify` | ✅ in the docs; re-runnable |
| **sources · claims · rejected** | the demo topic's captured run (`data/cached/qm-superposition.json`: 8 · 61 · 6) | ⚠️ say whatever the **live** run shows — the counts change per run |
| **time from pressing Learn to the skeleton** | this machine, this run | ⚠️ time it in the dry run |

Observed shape from this morning's dev log, so you know what "normal" looks like: planner **3.4 s**,
whole setup route **~20 s**, then each concept **4–21 s** *after you open it* (concepts generate on
demand). The skeleton arrives well before the route finishes, so start Beat 3 the moment it appears —
do not wait for the request to complete.

## Before you touch the camera (30 min)

The deployed link at `https://edu-void.vercel.app` **cannot generate** (no keys in Vercel) and is behind
the working tree — which currently has uncommitted deletions (the test-mode removal) plus new files.
Pick one and move on; do not spend the 4 hours here:

- **Fix it (20 min):** commit + push the working tree, add `LLM_*` + `TAVILY_API_KEY` in the Vercel
  project, redeploy, then open a non-demo topic in an **incognito window**. If that works, record from
  the live URL — best outcome.
- **Or record from `npm run dev` on localhost.** It works today. Say "running locally" if anyone asks,
  and never present it as the deployed link.

Then two 2-minute errands:

1. **Ask a specific person for a topic.** Text one person who has nothing to do with this project:
   *"give me something you'd want to learn, any subject."* You need it for Beat 8, and it is the single
   cheapest thing that makes the demo un-fakeable. If nobody answers, fall back to `Bayes' theorem`.
2. **Get one cold read.** Show that person the first 40 seconds and ask them to finish the sentence
   "this is for ___". If they can't, fix Beat 1–2 before you record (report §6, §15.6).

## The 4-hour plan

| Time | Do |
|---|---|
| 0:00–0:30 | Deploy decision above |
| 0:30–0:45 | One silent dry run: find every button, note **which concept node carries the double-slit sim**, open the claims list, open the activity panel |
| 0:45–0:55 | **Read the script out loud once, with a stopwatch.** Note which beats run long |
| 0:55–1:25 | Record the screen, silently, deliberate pace (2 takes, use the second) |
| 1:25–2:00 | Record the narration over the take |
| 2:00–2:30 | CapCut: narration under capture, cut dead air, architecture shot, export 1080p |
| 2:30–3:00 | tscaps.io/local: transcribe, fix "EduVoid"/"superposition", export |
| 3:00–3:20 | Upload publicly to YouTube; confirm it plays on a phone |
| 3:20–3:50 | Devpost text, repo link, README check |
| 3:50–4:00 | Buffer (keep it — something will need it) |

Record the screen **first and silently**, then narrate. Retakes then cost one audio line, not another
pipeline run.

## The script

Read the `SAY` lines close to word-for-word. Do not read the bracket directions aloud.
Say the numbers you actually see on screen.

---

**BEAT 1 — Hook: the puzzle · 0:00–0:22** (57 words)
`ON SCREEN:` the home page, one input box, nothing typed. `[hold 1.5 s of silence before you speak]`

> Two slits, electrons fired one at a time. Each lands somewhere definite — but a few hundred later
> they've piled into stripes. Now watch which slit each one used, and the stripes vanish. That's where
> revision fails: you can read the sentence "measurement changes the outcome" and still not be able to
> explain it, or check it.

`WHY:` the report's hook rule — the problem in concrete terms, no "we built". The paradox is the hook,
and Beat 5 pays it off on screen. Only say the two-slits line if you *are* about to run the double-slit
sim; it is a promise, not decoration.

---

**BEAT 2 — What it does · 0:22–0:36** (≈34 words)
`ON SCREEN:` type the demo topic `quantum superposition and measurement`, press Learn.

> EduVoid asks one question: type a topic. Agents search the web, check every claim against the passage
> it cites, and build a lesson from what survives. I'll use the topic I've fact-checked by hand.

---

**BEAT 3 — The map, and a promise · 0:36–0:58** (41 words)
`ON SCREEN:` the mindmap skeleton streams in. Name the concept titles you actually see.

> No prose yet. The first thing the pipeline builds is the plan — a prerequisite graph: superposition,
> measurement, interference, decoherence. The order to learn them in. Behind it: **[real source count]**
> sources, **[real claim count]** claims. **[real rejected count]** of those were thrown away.
> Hold that thought.

`WHY:` this beat covers the load without stalling, and plants the promise Beat 7 pays off. If the load is
slow, add the sentence "this is the part that takes a few seconds" and keep going — never narrate a
spinner.

---

**BEAT 4 — Grounded, not improvised · 0:58–1:14** (44 words)
`ON SCREEN:` open the concept whose title mentions interference. `[it generates on demand — keep talking
while the panel fills]` Point at the "verified against N sources" badge, then click one citation open.

> Open a concept and it's built only from verified claims — that badge is the count. Click a sentence
> and you get the passage behind it and the source it came from: lecture notes, a textbook, a paper.
> Improvised text doesn't survive this step.

---

**BEAT 5 — Predict, then run it · 1:14–1:50** (65 words + `[silent clicks]`) — **the centerpiece**
`ON SCREEN:` in the double-slit sim, commit a prediction. Then the lab.

> It won't run until I commit to a prediction. I'll say: stripes. And there they are. Each electron
> lands in a definite place — nowhere near where the stripes will be.

`CLICKS:` `Fire one` ×4 slowly — `[pause 2 s, say nothing, let the marks land]` — then `Fire all 300`.

> Three hundred electrons. Stripes.

`CLICKS:` flip **Which-path detector: ON** (the strip clears), then `Fire all 300`. `[silent 2 s]`

> Same electrons, same slits. The only thing that changed is whether the information exists about which
> slit each one went through. … No stripes — two blurred bands.

`CLICKS:` flip the detector **OFF**, `Fire all 300`. `[silent 1 s]`

> And back.

`WHY:` this is the whole video. The app clears the marks itself when you flip the detector, so the
before/after needs no editing — A (fringes), B (no fringes), A again, in four clicks. **Do not talk over
the two silent marks:** the change on screen is the argument, and silence is what makes it land. Budget
the clicks: `+25` twice instead of `Fire one` ×4 if you are running long — cut clicks, never words.

---

**BEAT 6 — The adaptive loop · 1:50–2:06** (35 words)
`ON SCREEN:` answer a quiz question **wrong**; the concept rebuilds in a different modality; the node
recolours.

> Fail a quiz question and the app doesn't just mark it wrong — it rebuilds the concept in a different
> form, and tells me why in one line: **[read the reason line it actually shows]**. The node recolours
> on the map.

---

**BEAT 7 — The integrity turn · 2:06–2:22** (36 words)
`ON SCREEN:` open the agent-activity panel (the `Agents: …` header, then the source list), then open
the claims list and point at a **flagged** row.

> Now, the claims it threw away. **[say the real counts: N sources, M claims, K rejected]**. Here's
> one — with the verifier's reason. It couldn't tie this sentence to the passage it cited, so it never
> reached me. A study guide can't show you that.

`WHY:` the rejection doubles as error-handling proof (report §15.3) and it is the report's "not a
wrapper" evidence. Every AI demo shows its model succeeding; this one shows it being *policed*.

---

**BEAT 8 — Someone else's topic · 2:22–2:38** (30 words)
`ON SCREEN:` new tab, type the topic your outside person gave you, press Learn.

> This last one isn't my topic. **[Name]** picked it — **[topic]** — nothing to do with physics. Same
> pipeline: sources, plan, verified claims. It'll be ready in under a minute.

---

**BEAT 9 — Tech, who it's for, close · 2:38–2:58** (52 words)
`ON SCREEN:` the architecture diagram (from `README.md`), then the finished lesson.

> Under the hood: search, plan, generate, verify — one sandboxed generated demo per topic, Next.js on
> Vercel. **217** tests green; in testing the verifier caught ten of ten planted errors. It's built
> for a student two days before a midterm on exactly this topic. One question in, a lesson you can check.

---

**If you are running long, cut in this order:** Beat 8's "nothing to do with physics" half, then Beat 6's
final clause, then Beat 9's "one sandboxed generated demo per topic". **Never cut** Beat 4 (citation),
Beat 5 (the turn) or Beat 7 (the rejection) — those three carry the rubric.

## Delivery rules that make it watchable

- **Speech budget is 2:38 of talking in a 2:58 video.** Every extra sentence pushes real clicking out.
- **Silence is content.** The two marks in Beat 5 are the only places the viewer gets to interpret
  something themselves. Hold them; do not fill them.
- **Never narrate what is visible** ("here I'm clicking the button", "as you can see"). Say why it
  matters, or say nothing.
- **No apologising.** If something takes 20 s to load, describe what is happening; never say sorry.
- **Slower than feels natural, close to the mic.** 150 wpm is the target the word counts assume.
- **No music during Beat 1–2 or Beat 9** — the numbers need a clean ear; a quiet bed under the demo only
  is fine.
- Banned words: seamless, powerful, revolutionary, "we built", "our AI".

## If something breaks on camera

- Demo topic fails live → the UI falls back to the **cached run**. Finish the beat, then say plainly
  "that's the cached run, it says so here" — do not pass it off as live.
- Unseen topic fails → error state with `Try another topic`. Re-record that beat; do not fix it in the edit.
- A concept fails → the panel shows a retry button. Click once, keep going. A visible failure state is
  worth showing, it is not a ruined take.
- The double-slit sim doesn't appear in the plan → open the other nodes; a sim ships only on the concept
  the generator decided it fits, never force-fitted. Worst case, Beat 5 runs on the two-state probability
  sim instead (predict how many of 50 systems land left, then measure them one at a time) and you drop the
  detector sentence — the beat still works, it is just less visual.

## Q&A one-liners (memorise these, do not read them)

- **What did you cut?** The in-app pre/post test runner and the eval harness — with hours left I chose
  the verifier, the adaptive loop and a working deployment over an outcome measurement I couldn't run
  honestly.
- **What if the API is down?** It degrades to a labelled cached run for the demo topic and a clear retry
  state everywhere else — that is what you just watched happen.
- **How would you scale it?** Verification is the bottleneck; it is cached per topic, so it's paid once
  per topic rather than once per student.
- **Who is the user?** A self-directed learner in one specific subject who needs the prerequisite map and
  the sources behind a claim, not another summary.
- **Why not NotebookLM or a ChatGPT study guide?** Those give you prose. This gives you a prerequisite
  graph, a passage-level citation for every claim, and a loop that changes what you see based on what you
  missed.
- **Hardest problem?** Passage-level verification: proving a claim is entailed by the passage it cites,
  and failing safe when it isn't.

## Honesty rules

No participant study is claimed anywhere — say "engineering evidence", not "students improved". Do not
show a code editor or a terminal. The cached run is never presented as live. Do not exceed 3:00.

## Before you export

- [ ] Narration still fits the beats (the word counts here are the budget, not a suggestion)
- [ ] The four drifting numbers from the table at the top were re-read on screen
- [ ] Beat 5 has its two silent marks intact
- [ ] Nothing on screen says "fixture", "test123" or shows the deleted test mode
- [ ] Total runtime shown in the editor is **under 3:00**
