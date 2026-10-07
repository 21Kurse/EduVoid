# T15 complete — FEATURE FREEZE. Loop stopped, awaiting owner.

**Date:** 2026-10-07
**Last commit:** T15 `README + DECISIONS + freeze` (see `git log -1`), pushed to `origin/main`.

## Feature freeze is in effect

No new features from this point. **Bug fixes only.** Everything in `TASKS.md` through **T15** is done and verified.

## State at freeze

- **T14 Hardening** (`a002524`): per-IP rate limiting (clear 429 + `retry-after`, never a hang), deterministic topic-safety refusal (friendly 422, no lesson, no crash), client `AbortSignal` threaded to the upstream NIM fetch, and a **demo-safe cached run captured from a real pipeline run** (`data/cached/qm-superposition.json`) labeled exactly **"cached run"** and used only on live failure for the demo topic.
- **T15 Docs** : `README.md` (problem, user, Mermaid architecture, run + deploy instructions, honest limitations), completed `DECISIONS.md` with a filled cut list, and `.env.example`.
- Through T15: T0-T11, G3 findings F1-F4, T13 test mode (`ef25793`), T14 (`a002524`). T12 moved to Stretch (S4) by owner.
- **`npm run check` exit 0 — 150/150 tests across 24 files**, production build succeeds.
- **Root-cause fix logged this session:** nemotron-3-super was burning its completion budget on the reasoning channel for structured prompts and returning truncated prose with no JSON; schema calls now skip thinking, which took claims extraction from **0 → 61 claims** and unblocked the capture. See `DECISIONS.md`.

## Open owner items (do not block the freeze)

1. **Real `data/eval/questions.json`** — the file is still a clearly-labeled 2-question SAMPLE. Swap in the owner's external exam questions (`notice` field and `lib/eval.ts` cover the shape) without editing their content, then re-run the T13 tests.
2. **Target persona** — `README.md` carries a draft persona; the owner supplies the final wording (AGENTS.md §11 item 7).
3. **3-5 test participants** lined up for the pre/post sessions.
4. **Deploy + spend cap** — keys in Vercel only, provider spend cap set (see the README deploy checklist).

Post-freeze (optional, only if the owner asks): emit the hero sim lazily to cut the ~2.5 min setup wall; the eval harness (§8).

## Next: real-user testing (D1-D4)

Feature freeze means the app is now the **test subject**. Next is the scheduled real-user work — **pre-test → learning session → post-test on the owner's device, screen-recorded**, scores and CSV export collected in one place — followed by the demo script (D1), Q&A (D2), Devpost text (D3), and weird-input testing (D4). No feature work.

Delete this file to clear the gate.
