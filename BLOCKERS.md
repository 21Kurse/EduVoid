# BLOCKERS.md

Owner decisions or missing inputs that stop the loop. Empty means no blockers.

Open owner items (from AGENTS.md §11, tracked here until resolved):
- **Confirm the CC BY-NC-SA (non-commercial) item in the external eval set.** `data/eval/questions.json` now ships real external questions (NPTEL + Wikiversity Quizbank, chosen from `docs/eval-candidates.md`); its one transfer item is NPTEL content under CC BY-NC-SA, and it was the only transfer item available. Attribution is recorded in `data/eval/procedure.md`, but NC was flagged as an owner call — drop Q1 (`transfer-nptel-3-2`) if NC does not fit the submission.

Post-freeze candidates (log-only; work on them only if the owner asks and time remains after T15):
- Hero sim setup wall: the setup stream awaits the hero sim before `done`, contributing to the 35–55 s setup wall on the demo topic. Candidate fix: emit hero lazily (fetch on first demand like concepts). Logged by owner 2026-10-05.
- (resolved in T14) Client-side abort now cancels the in-flight server LLM call: both routes thread the client `AbortSignal` through `lib/transport.ts` into the provider fetch (`AbortSignal.any([timeout, req.signal])`), covered by `tests/abort.test.ts`. Kept here only as a pointer in case a regression resurfaces.
