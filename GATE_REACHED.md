# READY FOR OWNER TESTING

Freeze-period closeout (P1-P5) is complete: the app is deployed-ready, the eval instrument is real,
the docs exist, and `npm run check` is green. What remains is owner-only work, listed at the bottom.

## State

- **Branch:** `main`, working tree clean, `HEAD == origin/main` (see the `freeze-candidate` tag).
- **Checks:** `npm run check` exit 0 — typecheck clean, `eslint .` clean, **214/214 tests across 28
  files**, production build succeeds.
- **Freeze rule still applies:** bug fixes only. Everything since T15 is a fix, a test, content, or
  documentation (`DECISIONS.md` records the reasoning for each).

## What was verified in this closeout (not just built)

- **Eval instrument (P1):** `data/eval/questions.json` is 10 external items (5 pre / 5 post) from
  open-licensed artifacts fetched 2026-10-08 — 4 verbatim (Wikiversity, CC BY-SA 4.0) and 6 adapted
  from MIT OCW 8.04 solutions and LibreTexts (CC BY-NC-SA 4.0), each keeping the source's own answer
  as the key with a quoted justification (`data/eval/procedure.md`). Browser round trip with the
  real file: no SAMPLE banner, 5 pre + 5 post answered, records saved with timestamps, and the real
  Export-CSV button produced two correct rows (`CHECK1,pre,…,5,4,0.800` / `CHECK1,post,…,5,3,0.600`).
  **Superseded 2026-10-10:** the in-app pre/post runner (page, components, store, tests) was deleted
  at the owner's request; the question file and its procedure remain as the run-by-hand instrument,
  and no participant results are claimed anywhere.
- **Placeholder sims (P2):** live generation, the cached run and the hero fallback all pass through
  one implemented-template gate; a non-physics topic rendered explainer + quiz + flashcards with no
  placeholder and no mismatched sim.
- **Unseen topics (P3):** five topics run end-to-end (niche, ambiguous, non-STEM, one word, one
  refusal) — no crashes, no hangs, all latencies inside budget; the one unfriendly state found (a
  probability sim under a programming concept) is fixed and re-verified in both directions.
- **Docs (P4):** `docs/DEMO.md` (~420 narration words), `docs/QA.md`, `docs/DEVPOST.md`, README
  updated to the shipped app.

## `maxDuration` report (assumption stated)

| Route | `maxDuration` | Verdict |
|---|---|---|
| `POST /api/generate` (SSE: sources → claims → verify → hero) | **300 s** | At the **Hobby maximum**, not over it |
| `POST /api/generate-concept` (one concept) | **120 s** | Fine |
| `POST /api/explain-back` (one grader call) | **60 s** | Fine |

**Assumption:** the project runs on the **Hobby** plan **with Fluid compute enabled** (default for new
projects), where the documented default and maximum is **300 s** on Hobby (Vercel docs "Functions
Limits", fetched 2026-10-08). If the project predates Fluid compute or is on a plan with the older
60 s cap, `/api/generate`'s 300 s is above the limit and must be lowered — check your plan, because
only you can see it. Measured set-up wall time is well inside either: 13-24 s on the five unseen
topics (2026-10-08) and 35-55 s on the demo topic in the owner's Oct 5 notes; the streaming design
means the mindmap appears before the stream finishes regardless.

## Security scan

- `git grep -nE "nvapi-|tvly-"` → matches only the **documentation lines in `PROGRESS.md` that quote
  the scan command itself**; no key material.
- `git log -p | grep -E "nvapi-|tvly-"` → the same single documentation line in one commit; **no key
  values anywhere in tracked files or history**.
- Keys live only in the gitignored `.env.local`. No secret was written to the repo, the docs, or a
  commit in this session.

## Owner-only tasks (in order)

1. **Verify the six adapted answer keys** — `BLOCKERS.md` → "OWNER VERIFY" has a 5-minute table:
   question id, key, and the source's own sentence justifying it. Also confirm you are comfortable
   with the CC BY-NC-SA items (used non-commercially, with attribution, marked adapted).
2. **Add the Vercel env var names and redeploy** — `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_DEFAULT`
   (+ optional per-role overrides), `SEARCH_PROVIDER`, `TAVILY_API_KEY`, optional
   `LLM_DISABLE_THINKING`. Values are **not** in the repo; copy them from `.env.local` in your Vercel
   project settings. Confirm the `maxDuration` assumption above and set your provider spend cap.
3. **Test the live URL in an incognito window** — the demo topic, then one topic of your choice
   (`docs/DEMO.md` names the safest: `Bayes' theorem`, 23.0 s setup / 3.6 s skeleton in the 2026-10-10
   probe; the French Revolution graph reads as a chronology — avoid it on camera). Watch for the
   "cached run" banner, which must never appear as live.
4. ~~Run the participant sessions~~ — **cancelled 2026-10-10**: test mode was deleted (owner
   decision) and no participant study is claimed. If you ever want one, `data/eval/questions.json`
   plus `data/eval/procedure.md` are the instrument to administer by hand.
5. **Rehearse and record** — `docs/DEMO.md` is the script and shot list; rehearsing with a timer 10×
   is in the plan for Oct 9. Keep the cached run out of the live segment.
6. **Cold-viewer review** (§15.6) before upload: someone who has never seen the project states in one
   sentence what it does and who it is for. If they cannot, rewrite the hook, not the demo.
7. **Submit by 09:00 EDT on Oct 10** (buffer only). The Devpost checklist is at the end of
   `docs/DEVPOST.md`.

## Known limitations to keep in front of you

Two sim templates only (physics-flavoured) — other topics get explanations, quizzes and flashcards;
verification is entailment, not truth; the safety check is deterministic and shallow; one-word
ambiguous topics can be thinly grounded (a claim-relevance gate is the next build); no participant
study is claimed — the pre/post instrument ships in `data/eval/` to be run by hand.
