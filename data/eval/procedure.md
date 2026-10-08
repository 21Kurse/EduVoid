# Eval procedure and question provenance

Companion to `data/eval/questions.json` (AGENTS.md §6, §10: the external pre/post quiz, its
sources, and the procedure). Candidate search, rejected sources and the verbatim transcriptions
live in `docs/eval-candidates.md`; this file records what is actually shipped and why.

## 1. Design

- **Instrument:** 3 multiple-choice questions, administered **identically** in the pre-test and the
  post-test. Same-item pre/post is the standard concept-inventory design (FCI/QPCS-style: one
  instrument, two administrations) and it is the only design the available external items support
  without confounding difficulty - see §4. The `pre` and `post` arrays therefore repeat the same
  three items with identical `id`s; the app stores answers per part (`EvalRecord.pre` /
  `EvalRecord.post`), so the ids are deliberately not made unique across parts.
- **Transfer item:** `transfer-nptel-3-2` in **both** parts (the requirement is ≥1 transfer item per
  part). Transfer is marked in the **`id`** (`/transfer/i`), never in the prompt, because the prompt
  text must stay verbatim from the source and because labelling a question "TRANSFER" inside the
  test would prime the participant. `tests/eval.test.ts` asserts one transfer id per part.
- **No feedback, no coaching:** `components/eval-question.tsx` shows no correctness feedback and
  does not render `explanation`; `explanation` carries the answer-key pointer only.
- **Separate from the pipeline:** these questions are never generated, rewritten or "improved" by
  the app's agents, and no prompt or fixture in the pipeline contains them (§6).
- **Procedure:** participant code entered in `/test`; pre-test → learning session (the app) →
  post-test; answers + timestamps persist in `localStorage` (`eduvoid.eval.v1`); CSV export gives one
  row per participant per part with `n_questions`, `n_correct`, `fraction_correct` and timestamps.
  Sessions run on the owner's device (§13.8) so all records and exports stay in one place.

## 2. Questions: verbatim text, source, license, key

Every prompt and option below is copied character-for-character from the fetched source artifact.
No distractor, option or stem was written, reordered, merged or corrected by us. Pure markup
(`[[w:...|...]]`, `''italics''`) is stripped, and typeset mathematics is written in plain Unicode
(see §3).

### Q1 - `transfer-nptel-3-2` (transfer; idea: Born rule / measurement probabilities)

- **Prompt (verbatim):** "Let ψₙ(x) represents the normalized eigenfunctions corresponding to the
  linear harmonic oscillator problem n = 0,1,2,3,.... . Let Ψ(x,0) = (1/√3)·ψ₀(x) + (1/2)·ψ₅(x) +
  i·√(5/15)·ψ₉(x) represents the wavefunction at t = 0. If we make a measurement of energy, then the
  probability of finding the value 11/2 ħω will be"
- **Options (verbatim order):** (a) 0 (b) 1/4 (c) 1/3 (d) 1/2 - stored as `answer: 1`, i.e. `1/4`.
- **Source URL:** https://archive.nptel.ac.in/content/storage2/courses/115102023/downloads/mcq%20for%20module3.pdf
  (NPTEL, "Multiple Choice Questions in Basic Quantum Mechanics", *Module 3: Linear Harmonic
  Oscillator-I*, item **3.2**).
- **License:** CC BY-NC-SA. Stated by the distributor at https://archive.nptel.ac.in/footer.html:
  "Distributed under Creative Commons Attribution-NonCommercial-ShareAlike - CC-BY-NC-SA."
  ⚠️ **NC clause - attribution is given here and in `docs/eval-candidates.md`; the non-commercial
  restriction is flagged for the owner's explicit approval (see BLOCKERS.md).**
- **Where the answer key is published:** in the same PDF, printed immediately under the options as
  `[Answer (b)]`. Fetched 2026-10-08 (HTTP 200, 56 487 bytes, md5 `d27c270a74219696e85eda378fbc5b29`).
- **Key check (ours, not the source's):** E₅ = (5 + ½)ħω = 11/2 ħω and the ψ₅ coefficient is 1/2, so
  |c₅|² = 1/4 = option (b). Correct under the source's p = |c|² convention. **Caveat:** the state is
  not normalized (Σ|c|² = 1/3 + 1/4 + 5/15 = 11/12); under a strict p = |c|²/⟨Ψ|Ψ⟩ reading the
  probability would be 3/11 ≈ 0.273, which is not among the options. The item is used as published.
- **Also hard because:** it needs the oscillator spectrum Eₙ = (n + ½)ħω, which the demo lesson does
  not teach - expected to be the hardest of the three, in both parts.

### Q2 - `wv-diffraction-mechanism` (idea: interference, not a classical trajectory picture)

- **Prompt (verbatim):** "An understanding of the diffraction pattern associated with particles is
  based on"
- **Options (verbatim order):** (1) "Forces that the De Broglie pilot wave exert on individual
  particles." (2) "Interference between the component of the wave from each slit." (3) "Forces that
  the De Broglie pilot wave exert between pairs of particles." (4) "All of these nearly equivalent
  models explain diffraction." (5) "The fact that particles can make glancing collisions with the
  edge of a slit." - stored as `answer: 1`.
- **Source URL:** https://en.wikiversity.org/wiki/Quantum_mechanics/Course/Wave-particle_duality_quiz
  (Wikiversity / Quizbank, "Quantum mechanics/Course/Wave-particle duality quiz", version A; source
  text at the same URL with `?action=raw`). The same item also appears re-ordered in the page's
  `/Testbank` (versions B-H).
- **License:** CC BY-SA 4.0. Verified from the wiki's rights metadata
  (`action=query&meta=siteinfo&siprop=rightsinfo` → `https://creativecommons.org/licenses/by-sa/4.0/deed.en`).
  No per-page license override; no NC clause.
- **Where the answer key is published:** in the page source itself - MediaWiki quiz markup prefixes
  the correct option with `+` and the distractors with `-`. Fetched 2026-10-08 (HTTP 200, 5 491 bytes).
- **Key check (ours):** the standard explanation of single-particle diffraction is interference
  between the amplitude contributions from the two slits; the pilot-wave-force and
  glancing-collision options are non-standard alternatives. Key confirmed.

### Q3 - `wv-taylor-1909` (idea: interference built up one quantum at a time)

- **Prompt (verbatim):** "What was \"spooky\" about Taylor's 1909 experiment with wave interference?"
- **Options (verbatim order):** (1) "The light was so dim that the photoelectric effect couldn't
  occur" (2) "The light was dim, but it didn't matter because he was blind." (3) "The light was so
  dim that only one photon at a time was near the slits." (4) "The interference pattern mysteriously
  disappeared." - stored as `answer: 2`.
- **Source URL:** https://en.wikiversity.org/wiki/How_things_work_college_course/Quantum_mechanics_timeline/Quiz
  (Wikiversity / Quizbank, "How things work college course/Quantum mechanics timeline/Quiz", item 9;
  source text at the same URL with `?action=raw`).
- **License:** CC BY-SA 4.0 (same site-wide rights metadata as Q2; no per-page override).
- **Where the answer key is published:** `+`/`-` quiz markup in the page source. Fetched 2026-10-08
  (HTTP 200, 2 813 bytes).
- **Key check (ours):** Taylor's 1909 low-intensity interference is the classic demonstration that
  the pattern is not produced by classical particle-particle interaction - on the photon picture the
  arrivals were effectively one at a time. Key confirmed.
- **Known wart (source's own text):** option 2 is a flippant distractor ("...because he was blind").
  It is the source's option and is kept verbatim; it must not be edited if this item is used.
- **Provenance note:** the page sits in Quizbank's "College Physics" bank category, whose
  OpenStax-derived sub-bank is CC BY-NC-SA. The item itself is QM history and cites no OpenStax
  material, and the page's license is CC BY-SA 4.0. If the owner prefers zero OpenStax adjacency,
  drop Q3; the set then becomes 2 questions per part.

## 3. Transcription conventions (typeset -> text)

- Q1 lives in a typeset PDF whose equations are embedded objects (stacked fractions, radicals drawn
  as vector art, 6.9 pt subscripts). Text extraction alone yields garbled fragments, so the prompt
  was transcribed from the **rendered page**, read at 3× and again at 9-12× in the browser:
  numerator/denominator digits `1/3`, `1/2`, `5/15`; subscripts `0`, `5`, `9`; the factor `i`; the
  radicals over `3` and over `5/15`; and the ħ symbol were each verified individually on 2026-10-08.
- Fractions are written `a/b`, subscripts as Unicode `ψ₀`/`ψ₅`/`ψ₉`, the reduced Planck constant as
  `ħ`, and `·` is inserted for multiplication. Nothing else was changed; the source's own grammar
  ("Let ψₙ(x) represents ... n = 0,1,2,3,.... . Let ... represents the wavefunction at t = 0") is
  retained verbatim.
- Q2/Q3 are plain wiki text; only link markup and italic markup were stripped.

## 4. Known limitations (stated honestly)

1. **Three questions per part, two of them idea-2.** No external item meeting the requirements was
   found for "measurement and state update" or "superposition vs mixed state" (search log:
   `docs/eval-candidates.md` §5), so this instrument measures the Born rule (1 item) and interference
   (2 items) only.
2. **Only one transfer item exists** in the compliant sources (Q1); it is the same item in both
   parts. `transfer-nptel-3-3` (the twin item, same stem, key `0` for 7/2 ħω) is deliberately **not**
   used - with one instrument it would be redundant, and as a pre/post pair the two share a stem.
3. **Same-item pre/post** cannot separate learning from test familiarity. With n = 3-5 participants
   this is a demonstration, not a controlled study (§10), and the README/PROGRESS report it as such.
4. **Q1 is the hardest item** and leans on outside knowledge (oscillator spectrum), so a wrong answer
   is ambiguous between "no Born rule" and "no spectrum". Q1's source state is also not normalized
   (see §2) - the key is the source's, not a corrected probability.
5. **NC license:** Q1 is CC BY-NC-SA, so the repo ships non-commercial content (attributed above).
   Owner must confirm (BLOCKERS.md).
6. **Q3 provenance** is OpenStax-adjacent by Quizbank category, not by content (§2).

## 5. Verification log

- Fresh fetches on 2026-10-08 of all three artifacts: NPTEL PDF md5-identical to the copy whose
  mathematics was visually verified; both Wikiversity pages re-read at `?action=raw`, with the `+`
  answer marks and full option lists above reproduced from those fetches.
- Answer keys independently checked against Born-rule/statistical-interpretation physics (see the key
  checks in §2), including the normalization caveat on Q1 and the robustness of the `0` key on the
  unused twin item.
- `data/eval/questions.json` validates against `evalQuestionsSchema` and has no `notice` key, so
  `isSampleQuestions` is false and the SAMPLE banner in `/test` does not render (checked in the
  browser; see PROGRESS/GATE notes).
- `tests/eval.test.ts` asserts the shipped file's contract: validates, no `notice`, both parts
  non-empty and equal in length, ids unique within each part, and ≥1 transfer item per part.
