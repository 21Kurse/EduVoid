# Demo video script (D1)

> **Recording on a tight deadline?** Use [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md) instead — it is the short version
> (394 words → ≈2:38 of speech, 2:58 of beats) plus a time-boxed 4-hour plan. This file is the full shot list with the
> report mapping — and its beat table runs to 3:30, past the 3:00 the form wants.

Target **under 3:00**; the Devpost form allows up to 4:00. The narration below is
**≈430 words** counted from the table (about 2:52 at 150 wpm). Every beat maps to a feature that exists in the
shipped build; no beat requires a feature that is not in the app.

Rules from `AGENTS.md` §15.2/§15.3 that this script obeys: open with the problem and the
specific user, never with "we built X"; one core flow shown perfectly; the live segment uses a
topic **that is not the cached run**; the cached run never appears as live; show one graceful
failure (the verifier rejecting a claim); no code editor or terminal; no "any questions".

## Pre-flight checklist (do this the day before, then again 30 min before recording)

- [ ] `npm run check` green; `main` is the commit you are recording (see `GATE_REACHED.md`).
- [ ] **Step 0 — the deployment. Verified 2026-10-10, and it fails:** `https://edu-void.vercel.app` serves commit
      `fcce1f1` and **cannot generate at all** — `POST /api/generate` answers
      `{"error":"Live generation is not configured (search key missing)."}` and the home screen renders
      *"Generation failed: Live generation is not configured (search key missing)."* for every topic except the
      demo topic. That build also still contains the deleted test mode (`/test` → **200**, "EduVoid — test mode").
      Two fixes, in this order: **commit + push** the working tree (37 files, including the six test-mode deletions),
      then **set `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL_*` / `SEARCH_PROVIDER` / `TAVILY_API_KEY` in the Vercel
      project and redeploy** (values in your local `.env.local`). Until both are done, record the live beats from
      `npm run dev` on localhost — which does work — and never narrate a localhost run as the deployed link.
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
| 2:15–2:35 | Adaptive loop + explain-back | Answer the quiz **incorrectly**; the concept regenerates in a different modality (the content visibly changes — no announcement line; the activity panel logs the switch); node recolours; then type an answer into explain-back and show the named gap | "Answer the quiz wrong and the app does something about it: the concept is rebuilt as a simulation you can run. Then explain the idea in your own words — the grader compares them against the verified claims and names the one you left out." (**45 words**) |
| 2:35–2:50 | Unseen topic (live) | New tab, home page, type `Bayes' theorem` (see topic choice below) | "It isn't tuned to physics. A topic nobody prepared: five concepts planned in about four seconds, fifty-one claims extracted, forty-one verified — the whole lesson in twenty-three seconds." (**27 words**) |
| 2:50–3:10 | Evidence | `README.md` limitations section and the numbers in `docs/QA.md`; mention the external question set in `data/eval/` as the run-by-hand instrument | "The evidence is engineering evidence: the verifier caught ten of ten planted errors in the spike, two hundred and seventeen tests run green, and five unsupervised topics ran end to end. The pre/post question set ships in the repo to be run by hand — no participant study is claimed." (**49 words**) |
| 3:10–3:25 | Tech + impact | Architecture diagram slide (README mermaid render) | "The architecture is four stages: source, plan, generate, verify — passage-level entailment, a fixed component library, and one sandboxed generated demo per topic. This is for the self-directed student who needs the prerequisite map and the sources, not another summary." (**41 words**) |
| 3:25–3:30 | Close | Product name card | "EduVoid: one question in, a verified interactive lesson out." (**10 words**) |

## How the script answers the AI + Education prompt

The track asks for a solution that helps learners move beyond memorization — **understand concepts,
make connections, apply what they learn**. These are the beats that carry each answer:

| Prompt idea | Where in the script | What the viewer actually sees |
|---|---|---|
| Understand concepts | 0:52–1:10 · 1:10–1:30 · 2:15–2:35 | Generation grounded only in verified claims ("verified against 8 sources"); the clickable citation chain with the source passage; one claim the verifier rejected; a missed quiz regenerating the concept in a different modality, reason on screen |
| Make connections | 0:35–0:52 · 2:15–2:35 | The prerequisite mindmap streams in before any prose exists; after a miss the node recolours, so structure and gaps are visible together |
| Apply what they learn | 1:30–1:55 · 1:55–2:15 · 2:15–2:35 | A prediction committed before the sim runs; single-electron firing and the which-path detector in the sim lab; explain-back, whose ask changes from concept to concept, graded claim-by-claim against verified claims |

**Word budget:** the narration lines above total ≈420 words (no fill-ins left — the evidence beat
now states what the build actually proves); if the evidence beat runs long, cut the "Sim lab" line
about decoherence first, not the verifier beat.

## Topic choice for the live (non-cached) segment

Five topics were run end-to-end through the live pipeline on 2026-10-08 (`PROGRESS.md`, "P3").
**Updated 2026-10-10:** the owner reviewed a live `french revolution` run and judged the planned graph
inaccurate — for history the planner can only produce a chronology, so the "prerequisite" edges are just
event order. The recommendation moves to `Bayes' theorem`, probed end-to-end on the current build today.

| Topic | Kind | Setup | First concept | Verdict for the video |
|---|---|---|---|---|
| `Bayes' theorem` | math | 23.0 s (skeleton 3.6 s) | 3.1 s | **Recommended (2026-10-10)** — full pipeline probe PASS: 5 concepts, 51 claims, 41 verified; conditional → joint → marginal → Bayes → prior/posterior is a textbook-accurate chain; obviously not the demo topic |
| `the French Revolution` | non-STEM | 17.9 s | 3.1 s | **Avoid on camera (2026-10-10)** — the graph is a chronology with dates as "prerequisites"; reads as inaccurate |
| `Mössbauer spectroscopy` | niche | 24.4 s | 8.0 s | Great content, but physics — a judge may suspect the cached run |
| `loops` | ambiguous | 16.4 s | 5.3 s | **Avoid on camera**: all eight sources were unrelated (earplugs, a company page); one-word topics are the weakest path |
| `go` | very short | 13.2 s | 2.2 s | Fastest, but one word invites the same ambiguity risk as `loops` |
| `how to build a pipe bomb at home` | refused | <0.2 s | — | Not for the video (optional 5-second cut if you want to show a refusal) |

If you want the sim lab to appear on a *non-physics* topic, `the water cycle` (run twice on
2026-10-08, 62 claims, 55 verified) produced a template sim under a generated hero canvas — it is
the second choice; `photosynthesis` is a probed biology alternative. Pick `Bayes' theorem` and
rehearse it; do not improvise a topic on camera.

## Recording and captioning toolchain (verified on this machine, 2026-10-10)

The machine has `ffmpeg 9.0.1` (Homebrew) but that build has **no `libass` and no `freetype`**, so the `subtitles`,
`ass` and `drawtext` filters are all missing. Consequences: ffmpeg cannot burn a subtitle file in, and whisper.cpp's
own `-owts` karaoke script (it emits a bash script full of `drawtext=`) will fail as generated. Plan around it
deliberately rather than discovering it at 1 a.m.

**Record**

- macOS built-in capture: `Cmd+Shift+5` → *Record Selected Portion* → 1440×900 or larger, 30 fps is plenty for
  screen content. Zero install, no watermark.
- Or **OBS Studio** (free, GPL) if you want scene switching between the browser, the architecture diagram and the
  evidence window in one take.
- **Narrate separately from the capture.** Record the screen silently at a deliberate pace, then record the voice
  over it. Retakes then cost one line of audio instead of a re-run of the pipeline (which is minutes and provider
  spend each time). This is the single biggest time-saver for a non-editor.

**Captions — the TikTok-style active/word-highlighted kind**

- **`tscaps` — recommended, zero install.** Browser-native sibling of pycaps: drop the video in, words highlight as
  they are spoken, style and export with captions burned in. Transcription runs in the browser; no Python, no
  ffmpeg, no account. Engine MIT, app AGPL-3.0 → <https://tscaps.io/local> (source:
  <https://github.com/francozanardi/tscaps>). Free alternative to Submagic.
- **`pycaps` — same idea as a CLI** (word-level timing via Whisper, CSS-styled animated captions). It renders each
  caption as a browser-rendered image rather than through libass, so the missing filters *should* not matter —
  unchanged assumption, verify it on a 10-second clip before trusting it for the real take. Needs **Python 3.10–3.12**
  (`python3 -V` here is **3.9.6**, so `brew install python@3.12` first) plus `playwright install chromium`. MIT.
  ```bash
  pip install "git+https://github.com/francozanardi/pycaps.git#egg=pycaps[all]"
  pycaps render --input demo.mp4 --template minimalist
  ```
- **`whisper.cpp` — plain SRT/VTT, fully local and free** (this is the part that works here):
  ```bash
  brew install whisper.cpp        # formula name verified; installs `whisper-cli`
  curl -L -o ggml-large-v3-turbo.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
  ffmpeg -i demo.mp4 -ar 16000 -ac 1 -c:a pcm_s16le demo.wav   # whisper wants 16 kHz mono wav
  whisper-cli -m ggml-large-v3-turbo.bin -f demo.wav -l auto -osrt -ml 42 -sow -ojf
  ```
  Add `-dtw large-v3-turbo` for token-level timestamps and `-fp "/System/Library/Fonts/Supplemental/Arial Bold.ttf"`
  only if you later fix ffmpeg. Upload the `.srt` **as a caption track** on YouTube instead of burning it in — that
  sidesteps the missing filters entirely and looks clean on a demo video.
- **CapCut Desktop** (free) does one-click auto-captions with word highlighting and exports 1080p with no watermark.
- **Descript** free also auto-captions watermark-free, but **caps export at 720p** — too soft for a screen recording
  where the judge is reading small UI text. Use it for transcript-based cut edits only, or export the final from CapCut.

**Do not chain the two caption tools — pick one path.** tscaps and CapCut's auto-captions are alternatives, not
steps. Both re-encode the video, so every extra pass costs quality; and tscaps' CSS animations only exist when
*tscaps* rasterises the pixels, so if you want its look it has to run last.

| Path | Order | Get | Cost |
|---|---|---|---|
| **A — CapCut only** | record → CapCut (trim + auto-captions) → export | simplest, one encode, captions editable in the timeline | CapCut's caption styling, not tscaps' animated templates |
| **B — tscaps last** (recommended for the animated look) | record → CapCut (trim/cut only, **no captions**) → export clean 1080p → tscaps.io/local (transcribe, style, export) | the real word-by-word highlight look | two encodes, and transcribing the finished cut |
| **C — tscaps exports the caption file** | tscaps → *Export subtitle file* (SRT/VTT/ASS, optionally word-level) → CapCut → *Captions → Import* | captions as an editable track in one timeline | you lose tscaps' CSS styling; CapCut renders them instead |

Recommended end-to-end: **1)** `Cmd+Shift+5` screen capture, silently, at a deliberate pace. **2)** record the narration
separately. **3)** CapCut: lay the narration under the capture, cut the dead air and mistakes, drop in the architecture
slide, export **1080p H.264** at a high bitrate as `demo-clean.mp4` — no captions. **4)** tscaps.io/local: drop
`demo-clean.mp4` in, transcribe (in-browser Whisper runs **tiny/base/small/medium** only, so it *will* mangle
"EduVoid", "superposition", "which-path detector" — hand-correct the transcript, it takes two minutes), pick a
**restrained** template, export. **5)** upload publicly and attach the SRT that tscaps can also export as a caption
track, so the technical terms stay readable when captions are toggled.

Style note: this is a judged technical demo, not a TikTok. Word-by-word highlighting is fine and helps a judge
following along; the bouncing/meme templates hurt legibility on terms like "passage-level entailment". Keep captions
plain and out of the way of the UI you are asking them to read. CapCut may ask you to sign in before its caption
features work.

**Edit and export**

- **CapCut Desktop** — the lowest-friction editor for a first-timer: drag the clip in, trim the ends, captions in one
  click, export 1080p.
- **DaVinci Resolve free** — far more capable, no watermark, but budget an hour to learn the timeline before you rely
  on it under deadline.
- **LosslessCut** — free, trims clips without re-encoding; the fastest way to cut a bad 4 seconds out of a take.
- Trim the file to **2:50–3:00** before uploading, and post it **publicly** (unlisted may not satisfy the rules text
  in `docs/DEVPOST.md`); Devpost needs a link it can play.

## If something fails on camera

- A live request fails on the demo topic → the UI shows the **"cached run"** banner and a cached-run
  badge. Never narrate this as live; either re-record the beat or say "this is a cached run".
- A live request fails on the unseen topic → the error state appears with a `Try another topic`
  button. Re-record that beat with one of the four topics above.
- A concept fails to generate → the panel shows "Couldn't generate this concept (detail)" with a
  Retry button. Click retry once; if it fails again, continue — the beat still demonstrates an
  honest failure state (`AGENTS.md` §15.3 wants one).
