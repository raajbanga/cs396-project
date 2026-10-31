# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, demo). Spec: [`report/spec/ProjectPhase2.pdf`](report/spec/ProjectPhase2.pdf).
Report source: [`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex) (layout: [`report/README.md`](report/README.md)).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why) · 🧪 needs a local
machine. Put initials after a task when you pick it up (`— RB` / `— AB`). Priority: **P1** must
fix before submission · **P2** should fix (costs points if missed) · **P3** polish / stretch.

---

## Audit 10/31 — grade

Checked every spec section (§1–§12) against the code, the database, and `phase2-report.tex` compiled
with tectonic (29 pages). Numbers spot-checked against `db.sqlite` and `ml/models/metrics.json`:
46,988 unit-years, the Ghent 2024 worked example, the SCR counts and all model metrics match.

| Area                                    | Grade  | Why                                                                                                                                                                    |
| :-------------------------------------- | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code vs spec §3–§7                      | **A**  | Every required function is built; only optional items left (saved analyses, custom scenario, TRACI of predicted NOₓ, residual plot).                                  |
| Repo hygiene §12.3                      | **A−** | Tests, migrations, env template fine; local Python venv is broken, so `test:py` and one `npm test` fail on this machine.                                              |
| Report content                          | **B+** | Methods, results, and honesty are strong. Missing two sections Phase 1 had, a few contradictions and number mismatches, thin traceability for §6.4/§7/§8/§12.5.         |
| Report as a deliverable                 | **C**  | Phase 2 has never been built into a committed PDF (the old `main.pdf` was the **Phase 1** report); two screenshots overflow their pages (one loses its caption).              |
| Presentation and demo §12.5             | **F**  | Not started.                                                                                                    |

---

## P1 — must fix before submission

### Report build and deliverable

- [ ] Build and commit `report/phase2/phase2-report.pdf` (`npm run report`); that is the file we submit.
- [x] Report folder reorganized into `phase1/`, `phase2/`, `shared/`, `spec/` (see `report/README.md`).
- [ ] **Figure 8 (`p2-impacts.jpg`) overflows the page by ~588 pt** (`phase2-report.tex:620`): the caption falls off page 20. Crop to the four charts or split into charts + table.
- [ ] **Figure 1 (`p2-dataset.jpg`) is a full-page screenshot** (overfull by 78 pt, `phase2.tex:128`); text is unreadable at print size. Crop to the tiles + the first rows of the variable table.
- [ ] TRACI equation runs 88 pt into the margin (`phase2-report.tex:462–466`): put the three formulas on separate lines (`align`).
- [ ] Model table is 25 pt too wide (`phase2-report.tex:640`): shorten model names or use `\small`/`tabularx`.

### Report content — sections Phase 1 had and Phase 2 lacks (§12.4 "refer to phase 1")

- [ ] **Technical details** section (Phase 1 §4): languages, database, frameworks/libraries with versions (Plotly.js, fflate, pandas, NumPy, scikit-learn, joblib, SciPy, pytest), external services (Plotly CDN for state outlines), scripts and configuration (`ml:train`, `traci:import`, `test:py`, `report`, Python venv).
- [ ] **Highlighted features** section (Phase 1 §5): 2–4 deep dives with code/SQL excerpts, e.g. pooled rates over a variable catalogue, TS↔sklearn parity with float32 thresholds, exact TRACI mapping (NOₓ vs NO₂), reproducible ZIP export + `metadata.json` excerpt.
- [ ] **Representative test cases** table (Phase 1 §6.3): input → expected → observed. Include a hand-written-SQL count check (e.g. KY 2023–2024 = 177 unit-years), the Ghent TRACI example, the SCR comparison, an out-of-range scenario, an export round-trip.
- [ ] **Performance** subsection (Phase 1 §6.4): table of load times (1.3 s cold selection, ~0.1 s per view, cache hit < 1 ms, Plotly lazy-load, training time).
- [ ] **Known issues** subsection (Phase 1 §6.5): state map needs internet, sampling on big charts, fuel/type not versioned, anything still open at submission.

### Report content — contradictions and wrong numbers

- [ ] **Objectives vs Scope contradict:** §1.4 Objectives says Phase 2 addresses O9 (multi-criteria evaluation); §1.5 Scope says multi-criteria scoring was not built. Drop O9 or explain. Also check the O-numbers against Phase 1 (`phase1-report.tex` lists O1–O7, O11, O12, so the deferred ones are O8–O10; confirm their wording).
- [ ] **Test counts disagree:** text says 60 TS tests / 1 skipped (`phase2-report.tex:710`), traceability says "57 + 6" (`:266`). Actual run: 61 tests, 2 skipped. Re-count after the venv fix and use one number everywhere.
- [ ] **SCR counts disagree** (`:572–579`): 1,547 vs 1,564 SCR unit-years and 479 vs 571 uncontrolled. Both are right (rate defined vs all records), but say so, or use one basis.
- [ ] "The two models **agree** on heat input (−5 %: Ridge −3.2 %, tree −9.1 %)" (`:677`): a 3× difference isn't agreement; reword to "same direction".
- [ ] Sensitivity paragraph: Ridge's baseline (2,972 t) under-predicts Ghent 2's actual 4,146 t by 28 %. Say so and give the tree's baseline too; otherwise a grader will notice.
- [ ] Q1: coal and gas cross in 2023 **and back** in 2025; say "crossed twice" explicitly to match the figure.

### Local environment 🧪

- [ ] `epaDataVENV/` has no `bin/` (broken venv). Recreate it: `python3 -m venv epaDataVENV && epaDataVENV/bin/pip install -r requirements.txt`. Until then `npm run test:py` fails and the `samples/` upload test fails (`openpyxl` missing).
- [ ] Then `npm run validate` and `npm run test:py` green; record the final counts in the report.

### Presentation and demo (§12.5)

- [ ] Slides (new deck; put it in `report/phase2/slides/`; Phase 1 deck is in `report/phase1/slides/`): question → architecture → features → model comparison vs baseline → sensitivity/scenario → limitations → contributions.
- [ ] Demo script (steps, inputs, expected numbers, timings), covering each §12.5 item:
  - [ ] Explain the analytical question (Q1–Q4).
  - [ ] Build a dataset, show stats.
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel (crossings 2023/2025); NOₓ-rate box plot by fuel; backup: Pearson vs Spearman correlation outlier.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline (Models tab).
  - [ ] Sensitivity curve + scenario chart with an out-of-range warning (Ghent unit 2).
  - [ ] Limitations.
- [ ] Split speaking roles; two timed rehearsals; pre-demo checklist (`git restore db.sqlite`, prod build, warm pages, check `cdn.plot.ly` on the demo network).

---

## P2 — should fix

### Report

- [ ] Traceability table gaps: add rows for §1 goal 5 (unusual observations), §4.4 facility-location map (Phase 1 Map page), §6.2 step size, §6.4 "same filters/units, image or data export", §7 each export type separately (dataset, stats, comparison, model results **and predictions**, sensitivity, scenarios, charts), §8 steps 5 and 10 (pandas at request time → TS; marked Changed), §12.5.
- [ ] Plan-vs-delivered table: add fully custom scenarios (only two % values editable), TRACI of predicted NOₓ (optional §6.4 "impact indicators"), residual plot, saved analyses.
- [ ] Assessment against objectives: also list the course objectives (O8–O12) Phase 2 claims, not only the spec goals.
- [ ] Charts coverage: only trend, box, and correlation are shown. Add one composite figure of histogram / scatter / rankings / state map so §4.4 is visibly met.
- [ ] Exports: show a trimmed `metadata.json` and the ZIP contents (Phase 1 had `download.jpg`); name the field that serves as §7's "dataset identifier".
- [ ] Data flow / reproducibility subsection (Phase 1 §3.4 equivalent): CAMPD → DB → TRACI import → analysis → export → re-open URL.
- [ ] Contributions: both check that the RB/AB split matches who did the work, including the report and slides. 🧪
- [ ] Proofread on paper once figures are fixed; check page breaks.

### Code / tests

- [ ] Export metadata test (`export-bundle.ts`): required §7 fields present.
- [ ] Move OVAT / % change logic out of the tab components into `src/lib/model.ts` and unit-test it.
- [ ] Record one count against hand-written SQL (feeds the test-case table above).

### Local checks 🧪

- [ ] Retrain with `npm run ml:train`, then `npm test` (parity must still pass); update the report/README tables if metrics move.
- [ ] Vercel read-only build: Analyze and Predict load, charts render, ZIP downloads work.
- [ ] ZIP downloads in Safari and Chrome (PNG, CSV, `metadata.json`).
- [ ] Every tab in dark mode.
- [ ] If scripts or migrations fail: `echo $DATABASE_URL` (a shell value overrides `.env`).

---

## P3 — stretch / optional

- [ ] `saved_analyses` table + "Save / Load analysis" menu (§4.1 alternative to URLs).
- [ ] Fully custom scenario editor.
- [ ] TRACI impacts of the predicted NOₓ on Sensitivity/Scenarios.
- [ ] Residual plot on the Models tab.
- [ ] `HistGradientBoostingRegressor` for the report only.

---

## Done (F0–F10, summary)

All spec functions are built, tested, and on `dev`; see git history for detail.

- **F0 foundations:** Plotly `<Chart>` (lazy, themed, PNG + data), `/analyze` and `/predict`, routers, shared `unitYearConditions`.
- **F1 dataset builder (§4.1):** Explore filters incl. emissions program, count tiles, missing-value table, grouping fields, URL round-trip, 2015–2025 default.
- **F2 indicators (§4.3):** CO₂/SO₂/NOₓ intensity, NOₓ rate, heat rate, capacity factor, YoY abs/%; computed on read; pooled rates; NULL-safe; tested.
- **F3 statistics (§4.2):** full stat set, grouped, four spec questions as "Try" links, Tukey far-out outliers, checked vs NumPy/SciPy.
- **F4 TRACI (§3, §4.6):** `traci_factors` (migration 0009), exact substance mapping, 4 categories (no eutrophication in TRACI 2.2), per-MWh, disclaimer, Ghent worked example.
- **F5 charts (§4.4):** trend, bars, histogram/box, scatter, correlation heat map, rankings, state choropleth; sampling stated.
- **F6 compare (§4.5):** 2–8 groups, differences, ranks, CIs, Welch/MWU/ANOVA/KW, plain-language caveats.
- **F7 models (§5):** NOₓ target, leakage rules + ablation, chronological split, baseline / Ridge / tree (test R² 0.49 / 0.83 / 0.95), `models` table, TS parity test, pytest.
- **F8 sensitivity/scenarios (§6):** OVAT curve with baseline marks and shaded out-of-range, five named scenarios for both models, range warnings, non-causal captions.
- **F9 exports (§7):** ZIP (CSV + PNG + `metadata.json`) on every chart/table, `/api/export?type=analysis`.
- **F10 hygiene (§12.3):** `npm run validate` green (in the cloud env), knip clean, no deprecations, README + `DATABASE_BREAKDOWN.md` updated.
- **F11 report draft:** all Phase 1-style sections except those listed under P1.

---

## Locked decisions

| Decision          | Choice                                                                                                                                          | Why                                                                                                 |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| Compute stack     | Hybrid: stats, indicators, TRACI in TS on the server; models trained offline in Python, exported as JSON, evaluated in TS.                      | Keeps pandas/sklearn, works on the read-only Vercel deploy, instant interactions.                   |
| Prediction target | Annual NOₓ mass (short tons) per unit-year, regression.                                                                                         | Every spec scenario (+10 % load, −5 % heat input, control change) changes it.                       |
| Charts            | Plotly.js (`plotly.js-dist-min`) behind `<Chart>`, lazy-loaded.                                                                                 | Spec recommendation; zoom, tooltips, box plots, heat maps, PNG export built in.                     |
| Web stack         | Next.js 16 + tRPC + Drizzle + SQLite. No Flask rewrite.                                                                                         | Spec allows it ("React is optional").                                                               |
| Modeling years    | 2015–2025. Train 2016–2021, validate 2022–2023, test 2024–2025.                                                                                 | §5.4 chronological split; 2016 is the first year with a prior-year feature.                         |

## Risks and open questions

- **Fuel/unit type are per unit, not per year** (in the report's limitations). Fuel-switched units get the wrong historical fuel.
- **Model disagreement on SCR:** tree barely responds; Ridge cuts Ghent 2 by ~59 %. Feature it in the talk, don't hide it.
- **State map needs `cdn.plot.ly`** at runtime; skip that chart if the demo network blocks it.
- **Time:** 4 weeks left with Thanksgiving; P1 first, P3 only if everything above is done.
