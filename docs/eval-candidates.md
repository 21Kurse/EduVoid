# Eval question candidates (external, reusable)

Status: **candidate list only.** Nothing here is loaded by the app. `data/eval/questions.json` is
untouched. These items were **not** run through the generation pipeline, were not paraphrased, and
none of them were written by the agent.

Search date: **2026-10-08**. Researcher: Buffy (agent), for the owner's review.

## 0. What was required for an item to qualify

Each candidate below had to satisfy **all** of:

1. Already **multiple choice** (no conversion of open-ended items, no invented distractors).
2. An **answer key published by the source itself** (not "the answer is obvious").
3. **Fetched** during this session; question text, options and key copied from the fetched artifact.
   Items whose text could not be recovered faithfully were excluded (see §5).
4. An **explicit open license**: CC BY, CC BY-SA, CC BY-NC-SA, or public domain. All-rights-reserved
   or unlicensed pages were excluded even when the items were on-topic.
5. No **AI-use / ingestion restriction** on the page. (OpenStax pages carry one, so all OpenStax
   text and OpenStax-derived question banks were excluded on sight.)
6. Covers one of the four taught ideas:
   - **I1** Born rule / measurement probabilities
   - **I2** interference vs a classical mixture
   - **I3** measurement and state update
   - **I4** superposition vs mixed state

NC licenses are **flagged** rather than auto-rejected — that call is the owner's.

Transcription convention: both sources are typeset. Fractions are written `a/b`, subscripts `ψ₀`,
superscripts `x²`, and wiki markup (`[[w:…|…]]`, `''italics''`) is stripped. Nothing else is changed.

---

## 1. Source A — NPTEL (India) MCQ set, course 115102023

| Field | Value |
|---|---|
| Artifact used | `Multiple Choice Questions in Basic Quantum Mechanics` — *Module 3: Linear Harmonic Oscillator-I* (2-page PDF) |
| Exact URL | https://archive.nptel.ac.in/content/storage2/courses/115102023/downloads/mcq%20for%20module3.pdf |
| Page title | The PDF's own running title: "Multiple Choice Questions in Basic Quantum Mechanics", section heading "Module 3: Linear Harmonic Oscillator-I" (there is no HTML title; it is a bare PDF) |
| Author / institution | **NPTEL** — National Programme on Technology Enhanced Learning, a joint initiative of the IITs and IISc, funded by the Ministry of Education (India), distributed on `nptel.ac.in` / `archive.nptel.ac.in`. ⚠️ The PDF itself names no course, instructor or institution; the URL path identifies course `115102023`. The course's own description page could not be fetched (see §5), so the course title is **unverified**. |
| License | **CC BY-NC-SA** — ⚠️ **NC: owner decision required.** Wording verified at https://archive.nptel.ac.in/footer.html → "Distributed under Creative Commons Attribution-NonCommercial-ShareAlike - CC-BY-NC-SA." (`nptel.ac.in/faq` shows the same notice.) |
| Where the key is published | Inline in the same PDF, immediately after each item's options: `[Answer (b)]`. |
| Fetch evidence | `curl` 2026-10-08 → HTTP 200, `application/pdf`, 56 487 bytes; text extracted with PyMuPDF; the mathematics was additionally **verified visually** by rendering the page at 3× and 9–12× and reading it in the browser. No crawl restriction: `archive.nptel.ac.in/robots.txt` → 404 (no robots file); `nptel.ac.in/robots.txt` → "allow crawling everything by default". |
| Sibling modules (checked, no usable items) | module 1 (math preliminaries), module 2 (1-D Schrödinger solutions — contains one momentum-space probability item whose mathematics is not recoverable as text), module 4 (simple applications), module 5 / 8 (angular momentum / eigenvalues), module 6 (hydrogen), module 7 (bra-ket, coherent states). **No module in this set has an item on interference, measurement update, or mixed states.** |

### C1 — NPTEL item **3.2**

**Question (verbatim; mathematics transcribed from the rendered page — see the transcription note below):**

> Let ψₙ(x) represents the normalized eigenfunctions corresponding to the linear harmonic oscillator problem n = 0,1,2,3,.... . Let
>
> Ψ(x,0) = 1/√3 · ψ₀(x) + 1/2 · ψ₅(x) + i · √(5/15) · ψ₉(x)
>
> represents the wavefunction at t = 0. If we make a measurement of energy, then the probability of finding the value 11/2 ħω will be

**Options (verbatim order, printed as stacked fractions in the source):**

| # | Option | 0-based index |
|---|---|---|
| (a) | 0 | 0 |
| (b) | 1/4 | **1** |
| (c) | 1/3 | 2 |
| (d) | 1/2 | 3 |

**Answer:** **(b) → `answer: 1`.** Key line in the PDF: `[Answer (b)]`.

| Field | Value |
|---|---|
| Idea covered | **I1** (Born rule / measurement probabilities; energy-basis measurement on a superposition) |
| Transfer question? | **Partially.** It applies the Born rule to a *new setup* (harmonic-oscillator energy measurement rather than the taught double-slit/position or single-qubit case), which is transfer-like — but it also requires knowing the oscillator spectrum Eₙ = (n + ½)ħω, i.e. knowledge the demo lesson does not teach. Treat as **transfer-flavoured and above demo difficulty**, not as a clean transfer item. |
| Explanation field | `Answer key per https://archive.nptel.ac.in/content/storage2/courses/115102023/downloads/mcq%20for%20module3.pdf` (the source prints no rationale — none invented). |

**Defects / caveats the owner must weigh (all properties of the source, not edits):**

- **The state is not normalized.** Σ|c|² = 1/3 + 1/4 + 5/15 = **11/12**. The published key equals
  |c₅|² = 1/4 exactly, i.e. the source applies p = |c|² without normalizing. Read strictly
  (p = |c|²/⟨Ψ|Ψ⟩) the probability is (1/4)/(11/12) = **3/11 ≈ 0.273, which is not among the
  options**. For a five-person classroom demo this is latent, but a physics reviewer can legitimately
  dispute the key.
- The item tests |c|² arithmetic plus one piece of outside knowledge (E₅ = 11/2 ħω), so a wrong answer
  is ambiguous between "doesn't know the Born rule" and "doesn't know the oscillator spectrum".
- Grammar is the source's own ("Let ψₙ(x) represents …"), retained verbatim.

**Transcription note (applies to C1 and C2).** The PDF typesets the equations as embedded objects:
stacked fractions, radicals drawn as vector art, subscripts at 6.9 pt. Text extraction alone yields
garbled fragments, so the transcription above was produced from the **rendered page**, read at 3× and
again at 9–12× zoom in the browser. Verified characters: numerator/denominator digits `1/3`, `1/2`,
`5/15`; subscripts 0, 5, 9; the factor `i`; the radicals over `3` and over `5/15`; and the MT-Extra
symbol ħ. The leading `Ψ` and the parentheses are drawn as glyph art and do not appear in the text
layer; the source's equation objects render function arguments with little or no visible spacing, so
`Ψ(x,0)`, `ψ₀(x)` etc. are written here in standard form for readability. **If any character of this
item matters for the eval, re-read the PDF image before using it.**

### C2 — NPTEL item **3.3**

Identical stem to C1 with one change: the measured value is **7/2 ħω** instead of 11/2 ħω.

**Options:** (a) 0 | (b) 1/4 | (c) 1/3 | (d) 1/2 — verbatim, same order as C1.
**Answer:** **(a) → `answer: 0`.** Key line: `[Answer (a)]` (E₃ = 7/2 ħω and the state contains no ψ₃ term).

| Field | Value |
|---|---|
| Idea covered | **I1** |
| Transfer question? | Partially, same as C1 |
| Explanation field | `Answer key per https://archive.nptel.ac.in/content/storage2/courses/115102023/downloads/mcq%20for%20module3.pdf` |

**Caveat:** C1 and C2 are **near-duplicates** (same stem, same four options, one eigenvalue changed).
Using one in the pre-test and the other in the post-test risks measuring memory of the pre-test rather
than learning. They are better treated as a single item with two variants.

---

## 2. Source B — Wikiversity "Wave-particle duality quiz" (Quizbank)

| Field | Value |
|---|---|
| Artifact used | Quiz page (version A) and its Testbank page (versions B–H) |
| Exact URLs | https://en.wikiversity.org/wiki/Quantum_mechanics/Course/Wave-particle_duality_quiz · https://en.wikiversity.org/wiki/Quantum_mechanics/Course/Wave-particle_duality_quiz/Testbank · source wikitext: same URLs with `?action=raw` |
| Page title | "Quantum mechanics/Course/Wave-particle duality quiz" (and "…/Testbank") |
| Author / institution | Wikiversity contributors (the page belongs to the **Quizbank** question-bank project, categorised "Wikiversity quizzes placed on Wikipedia" and "Quizbank/conceptual quizzes used in intro physics"). No individual author is credited on the page. |
| License | **CC BY-SA 4.0** — verified from the wiki's own rights metadata: `https://en.wikiversity.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo` → `{"url":"https://creativecommons.org/licenses/by-sa/4.0/deed.en","text":"Creative Commons Attribution-Share Alike 4.0"}`; page footer: "Creative Commons Attribution-ShareAlike License". No per-page license override on either page. Not NC. |
| Where the key is published | In the page source itself: the MediaWiki quiz markup prefixes the correct option with `+` and the distractors with `-`. (The rendered quiz widget only reveals answers after submission; the `+`/`-` marks in the wikitext are the published key.) |
| Fetch evidence | `curl` 2026-10-08, HTTP 200, raw wikitext retrieved and read; rendered HTML fetched for the license footer. |
| Extra asset | The **Testbank** page publishes the same item pool re-ordered as versions B, C, D, E, F, G, H, including **re-ordered options**. If the owner wants two different surface forms (pre vs post), the source itself supplies them. |
| Item context | Several of these items describe a specific Wikimedia file (`Wave-particle duality.ogv`) — see the per-item quality flags. |

### C3 — "An understanding of the diffraction pattern associated with particles is based on" **(strongest item found)**

**Options (verbatim, in version-A order; `+` = correct):**

| # | Option (wikitext links stripped) | 0-based index |
|---|---|---|
| 1 | Forces that the De Broglie pilot wave exert on individual particles. | 0 |
| 2 | **Interference between the component of the wave from each slit.** (+) | **1** |
| 3 | Forces that the De Broglie pilot wave exert between pairs of particles. | 2 |
| 4 | All of these nearly equivalent models explain diffraction. | 3 |
| 5 | The fact that particles can make glancing collisions with the edge of a slit. | 4 |

**Answer:** option 2 → **`answer: 1`**.

| Field | Value |
|---|---|
| Idea covered | **I2** (interference is the mechanism, not a classical trajectory/pilot-wave picture) |
| Transfer question? | No |
| Explanation field | `Answer key per https://en.wikiversity.org/wiki/Quantum_mechanics/Course/Wave-particle_duality_quiz` |
| Quality | **Recommended.** Self-contained (names no video), conceptual, five options, plausible distractors. Option order differs between the quiz page and the Testbank versions — quote the version you use. |

### C4 — "…because particles are never observed to exhibit diffraction." → **false**

**Question (verbatim):**

> The first (*particle*) segment in *Wave-particle duality.ogv* does not depict a diffraction pattern when particles impinge upon two slits because particles are never observed to exhibit diffraction.

**Options:** `- true` / `+ false` → correct = **false**, 0-based index **1**.

| | |
|---|---|
| Idea covered | **I2** (the classical expectation: particles should not diffract) |
| Transfer question? | No |
| Explanation field | `Answer key per https://en.wikiversity.org/wiki/Quantum_mechanics/Course/Wave-particle_duality_quiz` |
| Quality | **Weak — only usable if the video is actually shown.** The stem is a statement *about a specific video file*, so it is not self-contained; as a bare test item it reads oddly. |

### C5 — "…because classical (Newtonian) physics fails to predict such diffraction." → **true**

Same stem as C4, same two options, correct = **true** → 0-based index **0**.
Idea **I2** · transfer: no · `Answer key per <URL above>` · quality: **weak, same video-dependency** as C4.
C4 and C5 are a natural true/false pair on the same idea.

### C6 — "the two waves emanating from the two slits can interfere with each other" → **true**

**Question (verbatim):**

> The (*wave*) second segment of *Wave-particle duality.ogv* is based on the fact that the two waves emanating from the two slits can interfere with each other.

**Options:** `+ true` / `- false` → correct = **true** → 0-based index **0**.
Idea **I2** · transfer: no · `Answer key per <URL above>` · quality: **weak** (video-dependent and close to tautological).

### C7 — Wikiversity "Quantum mechanics timeline" quiz, item 9

| Field | Value |
|---|---|
| Artifact used | Quiz page ("How things work college course/Quantum mechanics timeline/Quiz") |
| Exact URL | https://en.wikiversity.org/wiki/How_things_work_college_course/Quantum_mechanics_timeline/Quiz (source: same URL with `?action=raw`) |
| Page title | "How things work college course/Quantum mechanics timeline/Quiz" |
| Author / institution | Wikiversity contributors (Quizbank; "How things work college course"). NOTE: the page is categorised both under Quizbank's "How things work" bank and its "College Physics" bank — see the provenance caveat below. |
| License | **CC BY-SA 4.0** (same site-wide rights metadata as Source B; no per-page override) |
| Where the key is published | MediaWiki quiz markup in the page source: `+` marks the correct option |

**Question (verbatim):**

> What was "spooky" about Taylor's 1909 experiment with wave interference?

**Options (verbatim order):**

| # | Option | 0-based index |
|---|---|---|
| 1 | The light was so dim that the photoelectric effect couldn't occur | 0 |
| 2 | The light was dim, but it didn't matter because he was blind. | 1 |
| 3 | **The light was so dim that only one photon at a time was near the slits.** (+) | **2** |
| 4 | The interference pattern mysteriously disappeared. | 3 |

**Answer:** option 3 → **`answer: 2`**.

| Field | Value |
|---|---|
| Idea covered | **I2** (single-particle interference — the same pattern builds up one quantum at a time) |
| Transfer question? | No (it is a fact about the historical experiment, not an application to a new setup) |
| Explanation field | `Answer key per https://en.wikiversity.org/wiki/How_things_work_college_course/Quantum_mechanics_timeline/Quiz` |
| Quality | **Usable, with two warnings:** (a) one distractor is flippant ("…because he was blind") — it is the source's own option and must not be edited if the item is used verbatim; (b) it rewards recall of 1909 history as much as the interference concept. The other 9 items on that page are on quantum history/Planck units, **not** on the four ideas. |
| Provenance caveat | The page sits in Quizbank's "College Physics" bank category, and Quizbank's attribution page notes CC BY-NC-SA for items derived from OpenStax (https://en.wikiversity.org/wiki/OpenStax_University_Physics/Quizbank_attribution). The item quoted here cites no OpenStax material and the page's own license is CC BY-SA 4.0, but the OpenStax-derived-sets restriction means **the owner should confirm provenance before publishing**; if in doubt, drop C7 and keep C1–C6. |

---

## 3. Status: superseded on 2026-10-08

This survey counted only **already-multiple-choice items with a published key**, which capped the
result at 7 items and left ideas I1, I3, I4 (and every transfer slot) empty. The shipped instrument
therefore also **adapted** items into multiple choice from the same licence-checked artifacts — MIT
OCW 8.04 published *solutions* (PS4, PS8) and the LibreTexts *Essential Graduate Physics* §10.1
section — keeping each source's own answer as the key, per the task brief's adaptation rule. That
filled I1, I3, I4 and both transfer slots.

Final shipped set: **10 items, 5 pre + 5 post**, covering all four ideas; source, licence, key and
pairing tables are in `data/eval/procedure.md`. Only the two Wikiversity item families from
section 2 above were copied in unchanged; the NPTEL items (section 1) were **dropped** (see
`procedure.md` §6 — non-normalised source state). Everything in section 5 remains the record of what
was searched and why it is not in the file.
