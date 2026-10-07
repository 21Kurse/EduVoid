# BLOCKERS.md

Owner decisions or missing inputs that stop the loop. Empty means no blockers.

Open owner items (from AGENTS.md §11, tracked here until resolved):
- External quiz questions for `data/eval/questions.json` (T13 flow is built and verified against the clearly-labeled 2-question SAMPLE already in the file; the owner-supplied external exam file replaces it and must keep the same shape — see the `notice` field in the sample).

Post-freeze candidates (log-only; work on them only if the owner asks and time remains after T15):
- Hero sim setup wall: the setup stream awaits the hero sim before `done`, contributing to the 35–55 s setup wall on the demo topic. Candidate fix: emit hero lazily (fetch on first demand like concepts). Logged by owner 2026-10-05.
- Client-side abort does not currently cancel the in-flight server LLM call (abandoned generations keep spending provider budget). Fix: pass the client AbortSignal through to the NIM fetch in `lib/transport.ts`. **Assigned to T14** (cost-protection hardening, with a test that an aborted client request stops the upstream call) — listed here so it stays visible if it slips.
