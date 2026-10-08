# External eval questions — procedure and provenance

`data/eval/questions.json` holds the pre/post instrument for test mode (§6). Every item is
**external**: sourced from an open-licensed third-party artifact that was **actually fetched** on
2026-10-08, never written from memory and never produced by this app's pipeline. Generated in-app
quizzes remain a separate code path (`lib/quiz-dedupe.ts`, `lib/generate.ts`); nothing here is run
through the pipeline's prompts or fixtures.

`docs/eval-candidates.md` records the wider search (including what was rejected and why).

## 1. Sources used

| # | Artifact | URL | Institution / author | License (verified 2026-10-08) | Where the key is published |
|---|---|---|---|---|---|
| S1 | Wikiversity, *Quantum mechanics/Course/Wave-particle duality quiz* (version A) | https://en.wikiversity.org/wiki/Quantum_mechanics/Course/Wave-particle_duality_quiz | Wikiversity contributors (Quizbank question-bank project) | **CC BY-SA 4.0** — `action=query&meta=siteinfo&siprop=rightsinfo` returns `https://creativecommons.org/licenses/by-sa/4.0/deed.en` (re-checked today) | In the page source (wikitext): `+` prefixes the correct option |
| S2 | Same quiz, *Testbank* (versions B–H) | https://en.wikiversity.org/wiki/Quantum_mechanics/Course/Wave-particle_duality_quiz/Testbank | as S1 | as S1 | as S1 |
| S3 | MIT OpenCourseWare 8.04 *Quantum Physics I* (Spring 2013), Problem Set 4 + solutions | PS: https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013/resources/mit8_04s13_ps4/ · solutions: https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013/resources/mit8_04s13_ps4_sol/ | MIT / Prof. Allan Adams | **CC BY-NC-SA 4.0**, and the OCW terms explicitly permit AI use with attribution + non-commercial + share-alike conditions (checked today) | In the published solution PDF (part-by-part answers) |
| S4 | MIT OpenCourseWare 8.04, Problem Set 8 + solutions (same course/term) | PS: https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013/resources/mit8_04s13_ps8/ · solutions: https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013/resources/mit8_04s13_ps8_sol/ | as S3 | as S3 | as S3 |
| S5 | LibreTexts, *Essential Graduate Physics — Quantum Mechanics* (Likharev), §10.1 "Quantum measurements" | https://phys.libretexts.org/Bookshelves/Quantum_Mechanics/Essential_Graduate_Physics_-_Quantum_Mechanics_(Likharev)/10%3A_Making_Sense_of_Quantum_Mechanics/10.01%3A_Quantum_measurements | Konstantin K. Likharev, via LibreTexts | **CC BY-NC-SA 4.0** — page footer: "shared under a CC BY-NC-SA 4.0 license"; no AI/ingestion restriction found on the page (checked today) | The page states the rules with their equations; the answers used here are the page's own statements, quoted below |

Excluded by rule: **OpenStax** (AI-ingestion notice) and anything OpenStax-derived; sources with no
license statement; items whose text could not be read faithfully.

## 2. Items, keys and type

| id | idea | type | source | key | note |
|---|---|---|---|---|---|
| `pre-transfer-energy-well` | I1 Born rule | **adapted** | S3 (P4.3, part d) | option "1/3" | transfer item (new setup: infinite well) |
| `pre-measurement-expectation` | I3 measurement | **adapted** | S3 (P4.3, part c) | option "0" | |
| `pre-diffraction-mechanism` | I2 interference vs classical pictures | **verbatim** | S1 | option 1 | |
| `pre-single-particle-1909` | I2 single-particle interference | **verbatim** | S1 | option 2 | |
| `pre-coherence-vs-mixture` | I4 superposition vs mixture | **adapted** | S5 | option 1 | |
| `post-transfer-momentum-collapse` | I3 measurement | **adapted** | S4 (P8.1, part d) | option 1 | transfer item (new setup: 3-D free particle) |
| `post-born-rule-probability` | I1 Born rule | **adapted** | S5 | option 1 | |
| `post-diffraction-mechanism` | I2 (same item family as the pre pair) | **verbatim** | S2 (version D) | option 3 | source's own re-ordered variant |
| `post-single-particle-1909` | I2 (same item family as the pre pair) | **verbatim** | S2 (version E) | option 0 | source's own re-ordered variant |
| `post-coherence-vs-mixture` | I4 superposition vs mixture | **adapted** | S5 | option 2 | |

## 3. Pre → post pairing

| pre | post | idea covered | match rationale |
|---|---|---|---|
| `pre-transfer-energy-well` | `post-born-rule-probability` | I1 — measurement probabilities = \|amplitude\|² | concrete numeric case (pre) ↔ general postulate (post); the pre item is the transfer application |
| `pre-measurement-expectation` | `post-transfer-momentum-collapse` | I3 — what a single measurement yields / state update | expectation-vs-outcome (pre) ↔ collapse to the measured eigenstate (post); the post item is the transfer application |
| `pre-diffraction-mechanism` | `post-diffraction-mechanism` | I2 — interference is the mechanism | identical stem, options re-ordered by the source's own testbank (version A → version D) |
| `pre-single-particle-1909` | `post-single-particle-1909` | I2 — one quantum at a time still interferes | identical stem, source's own re-ordered variant (version A → version E) |
| `pre-coherence-vs-mixture` | `post-coherence-vs-mixture` | I4 — coherent superposition vs classical mixture | description of a dephased state (pre) ↔ the experiment that distinguishes coherence (post) |

Every pre item has exactly one post counterpart on the same idea; both parts have 5 items; each part
contains at least one transfer item (ids containing `transfer`).

## 4. Adapted items — key justification (quotes are the sources' own words)

Rule applied: the source's own correct answer is kept as the key, justified by a short quote from the
fetched artifact; distractors are common misconceptions (forgetting to square the amplitude; treating
an expectation value as a possible outcome; treating a dephased state as coherent; assuming the state
survives a measurement unchanged).

| id | key | source quote (< 15 words) |
|---|---|---|
| `pre-transfer-energy-well` | 1/3 | "the probability of measuring energy En is given by \|cn\|2" (S3, solution 3d) |
| `pre-measurement-expectation` | 0 | "The probability of measuring an energy equal to (E^) is zero." (S3, solution 3c) |
| `pre-coherence-vs-mixture` | classical mixture | "reduced to the diagonal form describing a classical mixture of two probability packets" (S5) |
| `post-transfer-momentum-collapse` | measured momentum eigenstate | "Measuring pk = (3n, 5n, n)/L immediately collapses the wavefunction into the corresponding momentum eigenstate." (S4, solution 1d) |
| `post-born-rule-probability` | \|αj\|² | "the j-th outcome probability equal to Wj = \|αj\|²" (S5) |
| `post-coherence-vs-mixture` | interference | "the coherence between the two component states → and ← is still preserved" (S5, coherent stage) |

Verbatim items carry the source's key line unchanged (`+` in the wikitext). Their `explanation`
field is `Answer key per <source URL>` because the source prints no rationale; nothing was invented.

## 5. Transcription notes

- Wikiversity items: wiki markup stripped (`[[w:Interference (wave propagation)|Interference]]` →
  "Interference"), links removed, text otherwise unchanged. S1 and S2 are the same item family; only
  option order differs, and the key index follows the version actually quoted.
- MIT items: the source's mathematics is retained (state ψA, energies En, momentum (ħ/L)(3, 5, 1)).
  The pre-item distractor "√(1/3)" is the source coefficient *before* squaring.
- LibreTexts items: the source's symbols are used (|α⟩, αj, Wj). Option text is plain ASCII
  (`|αj|2`) because the eval UI renders plain text, not math.
- Nothing in this file is generated by the app; no question was paraphrased from memory.

## 6. Honest limitations

- **Two of the five pairs are the source's own re-ordered variants of the same stem.** They measure
  retention of the idea rather than transfer, and a post answer can be partly primed by the pre item.
  Three pairs (I1, I3, I4) use different artifacts.
- **Difficulty matching is approximate and thematic, not psychometric.** No item statistics exist for
  this 5-person demonstration set; `n` is small by design and reported honestly in the README.
- **I4 (superposition vs mixture) has no verbatim multiple-choice item in any source found** — both
  I4 items are adapted from S5. The earlier search (`docs/eval-candidates.md` §5) reached the same
  conclusion across OpenStax-free sources.
- **NPTEL items were dropped** in this revision. Its one Born-rule item family exists under
  CC BY-NC-SA with a published key, but the source state is not normalised (Σ|c|² = 11/12) so its key
  is arguable, and the PDF's typeset equations could not be re-verified character-by-character in
  this session. Replaced by S3/S5 items; the earlier NC question in `BLOCKERS.md` is therefore moot.
- Items are used non-commercially, with attribution, and the adapted ones are marked as adapted
  (CC BY-NC-SA share-alike obligations are noted here; see `BLOCKERS.md` for the owner checklist).
