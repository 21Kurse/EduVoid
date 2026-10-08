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

## 3. Coverage and counts

**7 items met every stated requirement** (2 from NPTEL, 5 from Wikiversity), **below the 8–10 goal**:

| Idea | Items | Notes |
|---|---|---|
| **I1** Born rule / measurement probabilities | **C1, C2** | Both from one NPTEL item family; near-duplicate stems; NC license; non-normalized state (key = |c|²) |
| **I2** interference vs classical mixture | **C3, C4, C5, C6, C7** | C3 + C7 are self-contained; C4/C5/C6 are tied to a video file |
| **I3** measurement and state update | **0** | See §5 — the only item found on this idea (Wikiversity "observer is present") publishes a meta-answer ("all of these arguments have been used, the validity of some are 'uncertain'"), which cannot be scored |
| **I4** superposition vs mixed state | **0** | No compliant item found anywhere |
| **Transfer items** | **0 clean** | C1/C2 are transfer-flavoured but require outside knowledge and are arguably "hard recall" |

Recommended subset if the owner wants the safest 4: **C1, C2, C3, C7** (self-contained, no video).
There is no compliant fifth self-contained item.

## 4. Proposed pre/post split

The eval file wants a `pre` array and a `post` array of equal size. Given the shortage, only two
splits are defensible:

**Option 1 — same items in both parts (recommended).** Put the recommended 4 (C1, C2, C3, C7) in
**both** `pre` and `post`, with distinct `id`s (e.g. `nptel-3.2` and `nptel-3.2-post`). The schema
(`lib/eval.ts`) does not require the two arrays to differ, and a same-item pre/post design is the
standard way to measure gain. It avoids the fairness problem below and keeps n = 4 questions per part.

**Option 2 — different items, 2 + 2 (only if the owner insists on different surface items):**

| Part | Idea 1 slot | Idea 2 slot |
|---|---|---|
| `pre` | C1 (NPTEL 3.2) | C3 (diffraction mechanism, 5 options) |
| `post` | C2 (NPTEL 3.3) | C7 (Taylor 1909) |

Stated problems with Option 2, so they are on the record:

- C1 and C2 share a stem, so the post-test partially measures memory of the pre-test.
- C3 (explain a mechanism) and C7 (recall a historical result) are **not difficulty-matched** even
  though both are "idea 2" — the pairing is thematic, not psychometric.
- **No pairing exists for I3 or I4**, because no candidate item exists for either idea.
- **No transfer pair exists**, so the "≥1 transfer item per set" requirement cannot be met from these
  sources. The only transfer-flavoured items (C1/C2) require the harmonic-oscillator spectrum.

## 5. What was searched and rejected (the failure log)

| Source checked | Why it is not in the list |
|---|---|
| **OpenStax** (Physics / College Physics "Multiple Choice" pages, e.g. `openstax.org/books/physics/pages/21-multiple-choice`) | Excluded by rule: OpenStax pages carry an AI-use/ingestion restriction, so its items were not evaluated further. All OpenStax-derived Quizbank sets were excluded with it. |
| **Wikiversity "OpenStax University Physics / Quizbank attribution"** | Noted as the reason OpenStax-derived Quizbank sets stay out: a search-result snippet of that page says the set "is licensed (CC BY-NC-SA) … Download for free at http://cnx.org/content/col12074/latest/". The page itself was not fetched in full. |
| **MIT OpenCourseWare** (8.04 lectures 4 and 10, "clicker bonanza"; 8.05) | MCQs exist only inside lecture **videos/transcripts**; no static item + key artifact to copy verbatim. |
| **OpenLearn / Open University** ("Introduction to quantum computing", quiz section 8) | The quiz *does* embed a key in the page HTML (`data-correctanswer="2"`, hidden feedback divs) and contains one Born-rule item — but its options are **typeset-math images** (not text), so they cannot be copied verbatim; the question was excluded. The site also served 403 to non-browser clients (needed the browser harness), and the fetched page footer showed "©1999-2026. All rights reserved. The Open University" with no course-level CC statement in the HTML → license could not be verified. |
| **Wikiversity "Wave-particle duality quiz" — the "observer is present" item** (on I3) | Key is published as `+ While all of these arguments have been used, the validity of some are "uncertain"(pun intended).` — a meta-statement, not a gradeable answer. Excluded; this is the closest anything came to idea I3. |
| **MDPI *Education Sciences* 14(10):1113** (QPCS validation, CC BY 4.0) | Paper prints item-level statistics and some keys in prose (Q12→a, Q13→b, Q22→a, Q24→b, Q25→c) but **not the item texts**; the instrument itself is not reproduced. Excluded. |
| **arXiv 2608.14459 — "…Quantum Computing Conceptual Survey" (QCCS), License: CC BY 4.0** | The paper states its license as CC BY 4.0 (so it passed the license test) and it targets exactly I1–I4 in qubit language — but it **does not print the instrument items** (Appendices are assessment objectives, pilot population, CTT statistics). Excluded for lack of verbatim items. Worth revisiting if the authors release the instrument. |
| **arXiv 2602.22388v3 — phase-kickback QCCS item paper** | License is the arXiv perpetual non-exclusive license (**not** an open CC/PD license), the item is reproduced as a **figure image** ("Correct response: 'b'"), and the topic (phase kickback) is not one of the four ideas. Excluded. |
| **UNLV (J. Secrest) quantum-course PDFs incl. "Answer Table for the Multiple-Choice Questions"; Ole Miss PHYS 451 final (15 MCQs)** | Real QM MCQ sets with keys, but the pages checked carry **no license statement** → all-rights-reserved by default. Excluded. |
| **e-PG Pathshala (MHRD, India)** | `https://epgp.inflibnet.ac.in/` returns **HTTP 401** (auth required); module PDFs not reachable → nothing could be fetched verbatim. Excluded. |
| **LibreTexts** (ADAPT Commons, phys.libretexts.org) | ADAPT Commons is a JS app requiring a session; the MindTouch search API returns `missing required token`; no MCQ page with a published key on these four ideas was found. Excluded. |
| **H5P Studio (eCampusOntario)** | Catalogue search found no quantum-superposition/measurement question set. Excluded. |
| **PhET** ("Quantum Wave Interference" teaching resources) | Page returned no readable text; no clicker-question bank with a published key exists on the site. Excluded. |
| **Physics Stack Exchange / Wikipedia / Wikibooks QM pages** | CC BY-SA but no MCQ-with-key artifacts (user Q&A and prose only). Excluded. |
| **CUNY OER portal (`opened.cuny.edu`)** | Indexes CC BY-NC-SA physics courses (including an OCW "Quantum Physics III"), but the underlying artifacts are OCW/course pages without MCQ banks. Nothing fetched verbatim. Excluded. |

Not caused by the rules, but worth recording: the **NPTEL course page itself is not reachable**
(`archive.nptel.ac.in/courses/115102023/` → 404, `/content/storage2/courses/115102023/` → 403), so the
course title/instructor for the NPTEL MCQ set is unverified.

## 6. Decisions the owner now has to make

1. **NC license (NPTEL, C1 + C2):** accept CC BY-NC-SA (share-alike + non-commercial) or drop them?
   Dropping them leaves only idea I2 items.
2. **The non-normalized state in C1/C2:** accept the source's convention (key = |c|²) or drop.
3. **Idea I3 and I4 have no candidates** and there are **no transfer items** — either accept a
   2-idea / 4-item test, or source those items another way (the most promising unfound candidates are
   the QCCS instrument items if the authors publish them, and any university exam archive released
   under CC BY).
4. **Video-dependent items (C4, C5, C6):** use only if the lesson will show `Wave-particle duality.ogv`.
5. **C7 provenance:** confirm it is not OpenStax-derived before publishing.
6. Nothing here has been copied into `data/eval/questions.json`; that file still holds the labelled
   2-question SAMPLE. If these candidates are adopted, the sample-specific assertions in
   `tests/eval.test.ts` must be rewritten and `BLOCKERS.md` updated, as previously agreed.
