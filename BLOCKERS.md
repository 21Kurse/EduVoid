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

## Open owner items (AGENTS.md §11)

- **External quiz questions**: supplied and shipped (10 items, 5+5 paired). See the verification table
  above and `data/eval/procedure.md`. No placeholder remains.
- **Vercel env vars + redeploy** and **plan check for `maxDuration`** — see `GATE_REACHED.md`.
- **Test participants**: none run yet; `data/` participant scores are pending, and every place they
  belong is marked `[FILL IN AFTER SESSIONS]` in `docs/DEMO.md`, `docs/DEVPOST.md` and `README.md`.

## Post-freeze candidates (log-only)

- Hero sim setup wall: the setup stream awaits the hero sim before `done`, contributing to the
  35–55 s setup wall on the demo topic. Candidate fix: emit hero lazily (fetch on first demand, like
  concepts). Logged by the owner 2026-10-05. Still open.
- Client-side abort (owner-assigned in T13, **shipped in T14**): both routes thread the client
  `AbortSignal` through `lib/transport.ts` into the provider fetch
  (`AbortSignal.any([timeout, req.signal])`), covered by `tests/abort.test.ts`. No action needed;
  kept only as a pointer if a regression resurfaces.
