# DECISIONS.md

Deviations from [DEFAULT]s, dependency justifications, and spike results. Newest entries at the bottom. The Cut list lives at the end.

## 2026-10-04 — T0: Scaffold and repo

- **Repo layout.** T0 says "clone it and work inside the clone"; PROMPT.md offers the alternative of connecting an existing directory to the remote. Used the alternative: `git init` in the thread-workspace root (which already holds `AGENTS.md`/`TASKS.md`/`PROMPT.md`), added `origin`, aligned with `origin/main` (initial commit had `.gitignore`, `LICENSE`, `README.md`). The loop docs are committed at repo root, so "the repo is your memory" holds.
- **Scaffold transport.** Root was non-empty, so `create-next-app` ran in a temp dir and was rsynced in, excluding `.gitignore`/`README.md` to preserve the remote's files. rsync clobbered `AGENTS.md` with Next's auto-generated agent-rules stub; the full spec was restored from the thread's instruction copy.
- **Next.js agent-rules block.** Next 16 tooling upserts a managed `<!-- BEGIN:nextjs-agent-rules -->` block into `AGENTS.md` on dev/build (idempotent, `node_modules/next/dist/server/lib/generate-agent-files.js`). Kept: it warns that Next 16 APIs may differ from training data (checked against `node_modules/next/dist/docs/` before writing app code). `CLAUDE.md` (`@AGENTS.md`) kept as the generated pointer.
- **Dependencies added** (logged per PROMPT.md hard rule):
  - `zod` — mandated by AGENTS.md §2/§3 for schema validation.
  - `vitest` (dev) — chosen over Jest: first-class TS/ESM, no config needed alongside Next, fast. Test runner only; no testing-library until a task needs component tests (T2 review).
  - `@types/node` bumped `^20` → `^22` — vitest 5 peer range; local runtime is Node v22.23.1.
- **npm audit (5 high) accepted, not "fixed".** All trace one dev-only chain: `braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next@16.3.8` (ReDoS in glob patterns, lint tooling only, not runtime). npm's only fix path is downgrading to `eslint-config-next@14` — a breaking downgrade worse than the advisory. Revisit if a patched `eslint-config-next` ships.
- **`.gitignore`.** Extended GitHub's Node template in place (it already covers `node_modules`, `.env*` with `!.env.example`, `.next`, `out`, `dist`, `coverage`, `*.log`); appended §14 items it lacked (`.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`, `*.swp`, `.vercel/`) plus `.freebuff/` (local client metadata).
- **Home page.** Minimal placeholder ("What do you want to learn?" heading) instead of scaffold branding; the real single-question UI is T2.

## Model spike (G1)

- Not yet run — waiting on owner-supplied model ID / endpoint / key. Results will be recorded here.

## Cut list

- (empty — nothing cut yet)
