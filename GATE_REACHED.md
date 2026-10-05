# GATE G1 reached — owner action required

The loop is stopped here (PROMPT.md step 3). T0–T3 are done and pushed; the
next task is T4 (Source stage), which is blocked until you clear this gate by
**deleting this file**.

## What you must provide

Add to `.env.local` at the repo root (never commit it — it is git-ignored):

1. **Exact GLM Flash model ID** → `LLM_MODEL_DEFAULT=...`
   (the precise string from your provider's docs — nothing is guessed in code)
2. **Provider endpoint** → `LLM_BASE_URL=...`
   (OpenAI-compatible base, e.g. `https://<provider>/v1` — include the version path)
3. **API key for the GLM endpoint** → `LLM_API_KEY=...`
4. **Search API key** → `TAVILY_API_KEY=...` (Tavily is the [DEFAULT] provider;
   tell me if you'd rather use Brave/Exa and I'll swap the provider in `lib/search.ts`)
5. **Backup stronger-model key + model ID** (optional but recommended, §13.4):
   only needed if the spike shows the flash model catching < 8/10 planted errors —
   then set `LLM_MODEL_VERIFIER` / `LLM_MODEL_PLANNER` (same or separate endpoint
   via `LLM_BASE_URL`; a second endpoint would need its own env vars — tell me and
   I'll extend the wrapper).

Optional role overrides: `LLM_MODEL_PLANNER`, `LLM_MODEL_GENERATOR`,
`LLM_MODEL_VERIFIER`, `LLM_MODEL_GRADER` (default: all fall back to `LLM_MODEL_DEFAULT`).

## How to run the spike

```bash
# after writing .env.local:
npm run spike
```

It prints:

- **(a)** JSON validity rate against the real `CurriculumSpec` zod schema over
  10 runs (plus per-run latency and retries used)
- **(b)** a planted-error verifier pass: 10 factually wrong claims, each judged
  **only** against its cited passage — how many it catches (threshold: ≥ 8/10,
  amendment 4)

Then paste the output into `DECISIONS.md` under "Model spike (G1)" (or just tell
me the numbers and I'll record them), and decide role routing:
flash for everything, or a stronger model for `verifier`/`planner`.

## When you're done

Delete `GATE_REACHED.md` and tell me to continue — the loop resumes at T4.
The spike can be re-run anytime; results land in `DECISIONS.md`.
