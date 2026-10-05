# PROGRESS.md

One entry per completed task, newest at the bottom. Format: task id, what changed, how verified, owner notes.

## 2026-10-04 — T1: Types and fixture

- **What changed:** `lib/spec.ts` — zod schemas for `CurriculumSpec` (§4) with passage-level citations per §13.4, plus `superRefine` checks: globally unique IDs (sources/passages/concepts/claims/questions), every claim's passage+source refs resolve, quiz answer index in range, edges reference real concepts and are not self-loops. `lib/graph.ts` — Kahn acyclicity/topo-sort + prerequisite helpers. `fixtures/qm-superposition.json` — 5 concepts (states-and-superposition → measurement-and-probabilities / interference-and-the-double-slit → measurement-changes-the-state → superposition-vs-mixture), 5 prerequisite edges, 2 placeholder sources, 13 passages all labeled `fixture` with `about:fixture#…` URLs (no invented titles/URLs). Tests: `tests/spec.schema.test.ts`, `tests/graph.test.ts`, `tests/fixture.json.test.ts` (19 tests total). No new dependencies.
- **Verified:** `npm run check` exit 0 — typecheck clean, 19/19 vitest tests pass (fixture validates against the real schema; acyclic with a total topo order; every claim/question cites existing passage IDs; every passage labeled `fixture`), production build compiles.
- **Owner fact-check at G2** (fixture content, all placeholder-cited but written to be physically accurate):
  1. Qubit state is a weighted combination α|0⟩ + β|1⟩ with complex amplitudes; |α|² + |β|² = 1.
  2. Born rule: computational-basis measurement gives 0 w.p. |α|², 1 w.p. |β|²; individual runs random, frequencies converge over many shots.
  3. Amplitudes (not probabilities) combine and can cancel → interference; one-particle-at-a-time double slit still builds fringes; which-path detection destroys them.
  4. Measurement updates the state (immediate re-measurement in the same basis repeats the outcome); one shot cannot reveal amplitudes (tomography needs many copies); superposition is basis-relative (|0⟩ is a superposition of |+⟩/|−⟩).
  5. Superposition (definite phase relations, can interfere) vs mixture (classical coin flip, cannot); decoherence = phase information leaking to the environment.
- **Owner notes:** quiz answers/sim parameters are also fact-checkable at G2. The two quiz items about |+⟩/|−⟩ basis results rely on the standard X-basis measurement conventions.


## 2026-10-04 — T0: Scaffold and repo

- **What changed:** Next.js 16.3.8 (App Router, TS strict, Tailwind 4) scaffolded at repo root; `zod` + `vitest@5` added; `npm run check` = `typecheck && lint && test && build`; `turbopack.root` pinned in `next.config.ts` (Turbopack was picking up a stray lockfile above the repo); `.gitignore` extended per AGENTS.md §14; `.env.example` with LLM/search vars; `DECISIONS.md`, `PROGRESS.md`, `BLOCKERS.md` created; loop docs (`AGENTS.md`, `TASKS.md`, `PROMPT.md`) committed to the repo; minimal placeholder home page + metadata.
- **Verified:** `npm run check` passes (typecheck, eslint, vitest, production build); production server returns HTTP 200 with the placeholder heading (see PROGRESS notes below for the command); `git check-ignore .env.local` confirms env files are ignored; `git ls-files` shows no `.env.local` tracked.
- **Owner notes:** (1) Link the repo to Vercel (T0 acceptance, [DECIDED] deploy target). (2) Global git email is `ryumashimotsuki21@gmail.comm` (likely typo, `.comm`) — commits carry it until fixed: `git config --global user.email <correct>`. (3) G1 keys still open (see `BLOCKERS.md`).
