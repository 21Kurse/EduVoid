# BLOCKERS.md

Owner decisions or missing inputs that stop the loop. Empty means no blockers.

## OWNER VERIFY — adapted eval answer keys (5 minutes)

`data/eval/questions.json` ships 10 external items: 4 are **verbatim** from Wikiversity (key published
by the source itself) and **6 are adapted** into multiple choice from open-licensed artifacts, keeping
the source's own answer as the key. Please confirm the six adapted keys below — each quote is the
source's own wording, and full provenance is in `data/eval/procedure.md`.

| question id | key | source's own words (quote) |
|---|---|---|
| `pre-transfer-energy-well` | 1/3 | "the probability of measuring energy En is given by \|cn\|2" — MIT 8.04 Spring 2013, PS4 solutions (3d) |
| `pre-measurement-expectation` | 0 | "The probability of measuring an energy equal to (E^) is zero." — same solutions (3c) |
| `pre-coherence-vs-mixture` | a classical (incoherent) mixture | "reduced to the diagonal form describing a classical mixture of two probability packets" — LibreTexts, Likharev §10.1 |
| `post-transfer-momentum-collapse` | the measured momentum eigenstate | "Measuring pk = (3n, 5n, n)/L immediately collapses the wavefunction into the corresponding momentum eigenstate." — MIT 8.04 PS8 solutions (1d) |
| `post-born-rule-probability` | \|αj\|² | "the j-th outcome probability equal to Wj = \|αj\|²" — LibreTexts, Likharev §10.1 |
| `post-coherence-vs-mixture` | interference distinguishes coherence | "the coherence between the two component states → and ← is still preserved" — LibreTexts, Likharev §10.1 |

Verbatim items (`pre/post-diffraction-mechanism`, `pre/post-single-particle-1909`) need no key
verification: the Wikiversity wikitext marks the correct option with `+` and both the quiz page and
its Testbank were fetched on 2026-10-08.

Two licensing facts to confirm you are comfortable with (the task's allowed set includes both):
the Wikiversity items are **CC BY-SA 4.0**; the MIT OCW and LibreTexts items are **CC BY-NC-SA 4.0**
(non-commercial), used here with attribution and marked adapted. MIT OCW's terms explicitly permit AI
use subject to attribution + non-commercial + share-alike.

## OWNER VERIFY — submission rules and eval mix (from the owner's rules check, Oct 8)

1. **Repo public (rules: "publicly viewable").** Checked from this machine on 2026-10-08:
   `gh repo view 21Kurse/EduVoid` → `visibility: PUBLIC`. Re-confirm on the submission screen and
   don't flip it after the deadline.
2. **Video public.** The rules require the video to be posted online. When you upload it, set
   visibility to **Public** (not "Unlisted") and paste the URL into `docs/DEVPOST.md` and the
   Devpost form.
3. **Application/transfer share of the pre/post questions — confirm this mix is acceptable.** By the
   explicit `transfer` marker: **2 of 10** (one per part) — `pre-transfer-energy-well` (apply the
   Born rule to a given superposition) and `post-transfer-momentum-collapse` (apply the collapse
   postulate). By content, my read is **5 of 10 application/discrimination** and 5
   recall/recognition: the other three application items are `pre-measurement-expectation`
   (an expectation value is not an outcome), `pre-coherence-vs-mixture` and
   `post-coherence-vs-mixture` (coherent superposition vs classical ensemble); the recall items are
   `pre/post-diffraction-mechanism` (same stem both parts, re-ordered), `pre/post-single-particle-1909`
   (historical fact) and `post-born-rule-probability` (formula recall). The spec requires only ≥1
   transfer item per part, which we exceed; if you want a stronger "apply" claim in the writeup,
   say so before recording — swapping a recall pair for a new sourced applied item is the only way,
   and it is not worth doing after the video.

## Open owner items (AGENTS.md §11)

- **External quiz questions**: supplied and shipped (10 items, 5+5 paired). See the verification table
  above and `data/eval/procedure.md`. No placeholder remains.
- **Vercel env vars + redeploy** and **plan check for `maxDuration`** — see `GATE_REACHED.md`.
- **Test participants**: not required any more. The in-app pre/post runner was deleted on Oct 10
  (owner decision), so the app collects no participant scores and the docs claim none: the external
  instrument in `data/eval/` is administered by hand if you want it. Nothing is marked
  `[FILL IN AFTER SESSIONS]` in the current docs.

## Post-freeze candidates (log-only)

- Hero sim setup wall: the setup stream awaits the hero sim before `done`, contributing to the
  35–55 s setup wall on the demo topic. Candidate fix: emit hero lazily (fetch on first demand, like
  concepts). Logged by the owner 2026-10-05. Still open.
- Client-side abort (owner-assigned in T13, **shipped in T14**): both routes thread the client
  `AbortSignal` through `lib/transport.ts` into the provider fetch
  (`AbortSignal.any([timeout, req.signal])`), covered by `tests/abort.test.ts`. No action needed;
  kept only as a pointer if a regression resurfaces.
