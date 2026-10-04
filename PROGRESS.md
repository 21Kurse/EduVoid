# PROGRESS.md

One entry per completed task, newest at the bottom. Format: task id, what changed, how verified, owner notes.

## 2026-10-04 — T0: Scaffold and repo

- **What changed:** Next.js 16.3.8 (App Router, TS strict, Tailwind 4) scaffolded at repo root; `zod` + `vitest@5` added; `npm run check` = `typecheck && lint && test && build`; `turbopack.root` pinned in `next.config.ts` (Turbopack was picking up a stray lockfile above the repo); `.gitignore` extended per AGENTS.md §14; `.env.example` with LLM/search vars; `DECISIONS.md`, `PROGRESS.md`, `BLOCKERS.md` created; loop docs (`AGENTS.md`, `TASKS.md`, `PROMPT.md`) committed to the repo; minimal placeholder home page + metadata.
- **Verified:** `npm run check` passes (typecheck, eslint, vitest, production build); production server returns HTTP 200 with the placeholder heading (see PROGRESS notes below for the command); `git check-ignore .env.local` confirms env files are ignored; `git ls-files` shows no `.env.local` tracked.
- **Owner notes:** (1) Link the repo to Vercel (T0 acceptance, [DECIDED] deploy target). (2) Global git email is `ryumashimotsuki21@gmail.comm` (likely typo, `.comm`) — commits carry it until fixed: `git config --global user.email <correct>`. (3) G1 keys still open (see `BLOCKERS.md`).
