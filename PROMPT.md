# PROMPT.md: loop prompt

Feed this file as the prompt on every loop iteration. Each iteration starts with a fresh context; **the repo is your memory.**

## How the owner runs it

Either run inside the agent session by telling it "follow PROMPT.md until a stop condition", or, if the agent has a non-interactive/headless mode (verify this yourself), drive it from a shell loop:

```bash
i=0
while [ ! -f LOOP_COMPLETE ] && [ ! -f GATE_REACHED.md ] && [ $i -lt 40 ]; do
  <agent non-interactive command> "$(cat PROMPT.md)"
  i=$((i+1))
done
```

The loop halts on `LOOP_COMPLETE`, on `GATE_REACHED.md` (human gate), or after 40 iterations. Review `PROGRESS.md` and `BLOCKERS.md` at every halt. Use a branch or a git tag per task so any bad iteration is easy to roll back.

## Instructions to the agent

You are in an autonomous build loop for a hackathon project. Do exactly one task per iteration.

1. Read `AGENTS.md`, `TASKS.md`, the last 40 lines of `PROGRESS.md`, and `BLOCKERS.md`.
2. If `GATE_REACHED.md` exists, stop and print its contents. Do nothing else.
3. Find the first unticked task in `TASKS.md`, **skipping any task marked [OWNER]**. If it is a **GATE**, create `GATE_REACHED.md` stating what the owner must do, then stop.
4. Implement only that task. Do not touch unrelated files. Do not edit or weaken existing tests or `npm run check` to make things pass.
5. Run `npm run check`. If it fails, fix and retry up to 3 times. If still failing, revert uncommitted changes to the last good commit (`git reset --hard`; never rewrite pushed history), append the cause to `BLOCKERS.md`, and stop.
6. If the acceptance criteria are met: tick the box in `TASKS.md`, append to `PROGRESS.md` (task id, what changed, how you verified it, anything the owner should manually check), commit as `T<id>: <summary>`, and push with `git push origin main`. If the push is rejected, `git pull --rebase origin main` and retry; never force-push.
7. If every Core task (T-tasks) and every D-task is ticked, create an empty file `LOOP_COMPLETE`. Do not start Stretch tasks unless the owner explicitly asks.
8. End with a one-line status.

## Hard rules

- Never fake or hard-code outputs. Any fixture or cached content must be labeled as such in the UI; never present it as live generation. Never invent metrics in docs; use only real numbers from logs.
- `AGENTS.md` is the owner's spec. Framework tooling (e.g. Next.js) may try to overwrite or inject into it. Never overwrite it; if it changes unexpectedly, restore it with `git checkout -- AGENTS.md` and keep any tool-generated block below the spec only if it is harmless.
- Never invent model IDs, endpoints or API keys. If a value is missing, write the need to `BLOCKERS.md` and stop.
- Never commit secrets; keys live in `.env.local` only. The remote is https://github.com/21Kurse/EduVoid.git; do not change it.
- No new dependency without logging the reason in `DECISIONS.md`.
- Keep every LLM output schema-validated; every failure path must render a visible, non-crashing state.
- If a decision requires the owner, record it in `BLOCKERS.md` rather than guessing.
- Section 13 of `AGENTS.md` overrides earlier sections on conflict.
