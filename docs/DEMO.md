# Demo video script (D1)

Target **under 3:00**; the Devpost form allows up to 4:00. The narration below is
**≈420 words** (about 2:50 at 150 wpm). Every beat maps to a feature that exists in the
shipped build; no beat requires a feature that is not in the app.

Rules from `AGENTS.md` §15.2/§15.3 that this script obeys: open with the problem and the
specific user, never with "we built X"; one core flow shown perfectly; the live segment uses a
topic **that is not the cached run**; the cached run never appears as live; show one graceful
failure (the verifier rejecting a claim); no code editor or terminal; no "any questions".

## Pre-flight checklist (do this the day before, then again 30 min before recording)

- [ ] `npm run check` green; `main` is the commit you are recording (see `GATE_REACHED.md`).
- [ ] Vercel env vars set and the deployed URL tested **in an incognito window** (cold start).
- [ ] Model + search keys live; provider spend cap set; per-IP rate limit not already exhausted
      (6 generation requests / 10 min — the demo uses 2).
- [ ] Screen recorder at 1440×900 or larger, browser zoom 100 %, notifications off, one tab only.
- [ ] Rehearse with a timer 10× before recording (`AGENTS.md` §9, Oct 9).
- [ ] `data/eval/` and `PROGRESS.md` open in a second window for the evidence beat (numbers only,
      never the editor).

## Shot list and narration

| Time | Segment | On screen | Narration (approx. words) |
|---|---|---|---|
| 0:00–0:20 | Hook | Home page, one input. Slow zoom, no typing yet | "A student revising for a physics exam has better explanations available than any chatbot will improvise — university notes, textbooks, papers. What they don't have is a way to assemble three sources into one thing they can actually play with, or any way to know which sentences are really backed by a source. So they read, highlight, and hope." (**61 words**) |
| 0:20–0:35 | Solution | Type `quantum superposition and measurement`, press Learn | "EduVoid starts from one question: what do you want to learn? Agents then search the web, cross-check what they find, and build an interactive, cited learning app for that exact topic." (**30 words**) |
| 0:35–0:52 | Skeleton streams | Mindmap skeleton appears; concept nodes fill in; agent-activity panel is open (read its live line aloud: `8 sources · ~60 claims · 2 rejected` — the counts vary per run) | "Within seconds the plan appears: the concept graph, prerequisites included, before any prose exists. Behind the panel, the search stage found eight sources and extracted atomic claims from each. Watch the activity feed — this is the pipeline working, not a chatbot." (**41 words**) |
| 0:52–1:10 | Concepts stream | Open the first concept; explainer + quiz appear; point at the verified badge | "Open a concept and it is generated from the verified claims only. The badge says 'verified against 8 sources'; every claim that could not be tied to a passage it cites was dropped before it could reach this screen." (**38 words**) |
| 1:10–1:30 | Citations | Click a claim chip; sources panel opens with the passage; show one flagged claim and the "sources disagree" state | "Every statement is clickable: one claim, one source, one passage. Where two sources conflict, the app says so instead of picking a winner — here the verifier rejected a claim outright rather than let the model average them." (**39 words**) |
| 1:30–1:55 | Predict-then-reveal sim | Commit a prediction in the two-state sim, reveal the outcome; then open the sim lab sliders; then the **double-slit** template | "Simulations ask for a prediction *before* they run. Lose the prediction and you still learn something — here a single run at fifty systems." (**24 words**) |
| 1:55–2:15 | Sim lab | Fire electrons one at a time; fringes build; toggle the **which-path detector** ON and keep firing (marks stop converging) | "Then you fire the experiment yourself, one electron at a time, and watch fringes build up out of single marks. Turn the which-path detector on and the fringes stop building — you have just caused decoherence on screen." (**36 words**) |
| 2:15–2:35 | Adaptive loop + explain-back | Answer the quiz **incorrectly**; the concept regenerates in a different modality with the one-line reason; node recolours; then type an answer into explain-back and show the named gap | "Answer the quiz wrong and the app does something about it: 'you missed this, so here it is as a simulation'. Then explain the idea in your own words — the grader compares them against the verified claims and names the one you left out." (**45 words**) |
| 2:35–2:50 | Unseen topic (live) | New tab, home page, type `the French Revolution` (see topic choice below) | "It isn't tuned to physics. A topic nobody has run before: six concepts planned, sixty claims extracted, fifty-three verified — under twenty seconds to the mindmap." (**26 words**) |
| 2:50–3:10 | Evidence | `data/` scores + the exported CSV; the honest sample size on screen | "Real pre/post sessions — sample size is small, [n], and the results are mixed: [FILL IN AFTER SESSIONS: pre/post means, one participant who did not improve]." (**≈25 words**, fill-in) |
| 3:10–3:25 | Tech + impact | Architecture diagram slide (README mermaid render) | "The architecture is four stages: source, plan, generate, verify — passage-level entailment, a fixed component library, and one sandboxed generated demo per topic. This is for the self-directed student who needs the prerequisite map and the sources, not another summary." (**41 words**) |
| 3:25–3:30 | Close | Product name card | "EduVoid: one question in, a verified interactive lesson out." (**10 words**) |

## How the script answers the AI + Education prompt

The track asks for a solution that helps learners move beyond memorization — **understand concepts,
make connections, apply what they learn**. These are the beats that carry each answer:

| Prompt idea | Where in the script | What the viewer actually sees |
|---|---|---|
| Understand concepts | 0:52–1:10 · 1:10–1:30 · 2:15–2:35 | Generation grounded only in verified claims ("verified against 8 sources"); the clickable citation chain with the source passage; one claim the verifier rejected; a missed quiz regenerating the concept in a different modality, reason on screen |
| Make connections | 0:35–0:52 · 2:15–2:35 | The prerequisite mindmap streams in before any prose exists; after a miss the node recolours, so structure and gaps are visible together |
| Apply what they learn | 1:30–1:55 · 1:55–2:15 · 2:15–2:35 · 2:50–3:10 | A prediction committed before the sim runs; single-electron firing and the which-path detector in the sim lab; explain-back graded claim-by-claim against verified claims; pre/post scores from external questions (one application/transfer item per part) |

**Word budget:** the narration lines above total ≈420 words including the fill-ins; if the
evidence beat runs long, cut the "Sim lab" line about decoherence first, not the verifier beat.

## Topic choice for the live (non-cached) segment

Five topics were run end-to-end through the live pipeline on 2026-10-08 (`PROGRESS.md`, "P3"):

| Topic | Kind | Setup | First concept | Verdict for the video |
|---|---|---|---|---|
| `Mössbauer spectroscopy` | niche | 24.4 s | 8.0 s | Great content, but physics — a judge may suspect the cached run |
| `loops` | ambiguous | 16.4 s | 5.3 s | **Avoid on camera**: all eight sources were unrelated (earplugs, a company page); one-word topics are the weakest path |
| `the French Revolution` | non-STEM | 17.9 s | 3.1 s | **Recommended** — fast, obviously not the demo topic, 6 concepts, 60 claims, 53 verified |
| `go` | very short | 13.2 s | 2.2 s | Fastest, but one word invites the same ambiguity risk as `loops` |
| `how to build a pipe bomb at home` | refused | <0.2 s | — | Not for the video (optional 5-second cut if you want to show a refusal) |

If you want the sim lab to appear on a *non-physics* topic, `the water cycle` (run twice on
2026-10-08, 62 claims, 55 verified) produced a template sim under a generated hero canvas — it is
the second choice. Pick one and rehearse it; do not improvise a topic on camera.

## If something fails on camera

- A live request fails on the demo topic → the UI shows the **"cached run"** banner and a cached-run
  badge. Never narrate this as live; either re-record the beat or say "this is a cached run".
- A live request fails on the unseen topic → the error state appears with a `Try another topic`
  button. Re-record that beat with one of the four topics above.
- A concept fails to generate → the panel shows "Couldn't generate this concept (detail)" with a
  Retry button. Click retry once; if it fails again, continue — the beat still demonstrates an
  honest failure state (`AGENTS.md` §15.3 wants one).
