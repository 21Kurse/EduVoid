# GATE G2 REACHED — pipeline complete, owner fact-check required

Per `PROMPT.md`, the loop stops here. **T8 has NOT been started.** G2 is an
[OWNER] gate: you read the generated demo-topic content for factual
correctness and approve or list fixes.

## What is waiting for you at G2

The full live pipeline is deployed code on `main` (T4 source → T5 plan →
T6 generate → T7 verify, streamed end-to-end):

- Run the app (`npm run dev` or `npm run start`), enter
  **"quantum superposition and measurement"**, and read every concept:
  - claim chips under each concept title (flagged items show their reason),
  - the `✓ verified against N sources · M/T claims supported` badge,
  - the agent-activity panel (bottom-left) for sources / claims / verdicts.
- Fact-check targets you flagged at G1-time: quiz items about |+⟩/|−⟩ basis
  measurement conventions, Born-rule wording, and any sim parameters.
- The fixture (`fixtures/qm-superposition.json`) fact-check list in
  `PROGRESS.md` (T1 entry) still applies to that file if it is ever reused.

## Numbers behind this gate

- Planted-error verifier probe: **10/10 caught** (threshold ≥8, §13.4) —
  `npm run probe:verify`.
- Live pipeline probe (last run): 8 sources (4.4 s) → skeleton 44 s →
  28 claims verified 28/28 → 5/5 concepts → done 97.4 s, error=none —
  `npm run probe:generate`.
- `npm run check` exit 0, 65/65 tests.

## If you find factual errors

List them as concept + claim/component; the fix path is prompt or verifier
tightening (set `LLM_MODEL_VERIFIER` to a stronger model and re-run
`npm run probe:verify`), not hand-editing generated content. Clear the gate
by deleting this file; the loop resumes at T8 (Cited claims UI).
