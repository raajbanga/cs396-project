# epaData Phase 2 — PRD and tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, demo). Spec: [`report/ProjectPhase2.pdf`](report/ProjectPhase2.pdf).

Phase 2 turns the Phase 1 data-management site into a decision-support tool: descriptive
statistics, derived indicators, interactive charts, comparisons, TRACI impact indicators, a
prediction model, and sensitivity/scenario analysis, all exportable with reproducibility
metadata.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why) · 🧪 needs
a check on a local machine. Put an owner's initials after a task when someone picks it up, e.g.
`— RB` / `— AB`.

## Status at a glance (10/30)

| Area                          | State                                                                                    |
| :---------------------------- | :--------------------------------------------------------------------------------------- |
| F0–F10 (code)                 | Built, tested, pushed to `dev`. `npm run validate` and `npm run test:py` green.          |
| F11 report, F12 slides + demo | Not started. README and `DATABASE_BREAKDOWN.md` already updated.                         |
| Open code items               | Saved analyses (stretch), Download-page section, a few optional extras; see `[ ]` below. |

## Audit (10/30, second pass)

Checked every Phase 2 spec section against the code, the live app, and the docs. Fixed:

- [x] §4.1 emissions-program filter was missing (docs claimed it); now a whole-code match ("CSNOX" ≠ "CSNOXOS"), verified against Python.
- [x] Default 2015–2025 range was dropped by any URL parameter (`/analyze?tab=charts` analysed all 18 years).
- [x] Analysis row cache ignored imports for up to 60 s; keyed by latest import time now.
- [x] §4.5 rankings added to Compare; §6.2 min/max values in Sensitivity; §7 model-comparison export; "unusual observations" (Tukey far-out fences) on Statistics.
- [x] Segmented controls inside `<label>` flipped on caption click (a11y bug); `Field group`.
- [x] Deprecations: `@typescript-eslint/no-deprecated` on (0 hits); JSON named import fixed (build now warning-free); redundant `force-dynamic` removed, Home uses `connection()`; Python runs clean with `-W error`. Only remaining: drizzle-kit's transitive `@esbuild-kit/*` (upstream, dev-only).
- [x] Dead code: knip clean (21 unused exports made private, missing `@types/topojson-specification` declared).
- [x] UI: Analyze filter wall removed (year range up front, Advanced closed, no ignored Top-N); grouped 29-variable picker; numeric table columns right-aligned app-wide; chart headers fixed; Dataset tab regrouped; Compare chips; scenario table pivoted per model; humanized model features; best model scores in bold.

## 🧪 Needs local testing

- [ ] **Python 3.9 venv** (the README's tested setup): `pip install -r requirements.txt`, then
      `npm run test:py`. Requirements are now version floors that support 3.9; the committed
      models were trained with Python 3.13 / scikit-learn 1.9.1.
- [ ] **Retrain locally** with `npm run ml:train`, then `npm test`: retraining rewrites the
      models, the `models` rows, and `ml/fixtures/parity.json` together, so the parity test must
      still pass. Metrics may differ slightly with an older scikit-learn; update the README table
      if they do.
- [ ] **Vercel read-only build**: Analyze and Predict load, charts render, ZIP downloads work.
- [ ] **State map needs internet**: Plotly fetches the U.S. state outlines from `cdn.plot.ly` at
      runtime. Check it on the demo network, or skip that chart in the demo.
- [ ] **ZIP downloads** in Safari and Chrome (chart PNG, CSV, metadata.json all inside).
- [ ] **Shell `DATABASE_URL`**: a `DATABASE_URL` set in your shell overrides `.env` (the cloud
      session had a Postgres URL set and every script failed until it was pinned to
      `file:./db.sqlite`). Run `echo $DATABASE_URL` if migrations or scripts fail.
- [ ] Eyeball every tab in dark mode (headless screenshots only covered light mode).
- [ ] `npm run report`: compile both reports (see F11).

---

## Locked decisions

| Decision          | Choice                                                                                                                                                                                                                                                                              | Why                                                                                                                        |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| Compute stack     | **Hybrid.** Stats, indicators, TRACI, and chart data in SQL + TypeScript (tRPC). Models trained **offline** in Python (pandas, NumPy, scikit-learn), saved as `joblib` + a JSON export (coefficients / tree arrays) that TypeScript evaluates for live predictions and sensitivity. | Keeps the spec's pandas/sklearn, keeps the Vercel read-only deploy working (no Python at request time), fast interactions. |
| Prediction target | **Annual NOₓ mass (short tons) per unit-year**, regression.                                                                                                                                                                                                                         | Leak-free enough to be honest, and every spec scenario (+10 % load, −5 % heat input, control change) changes it.           |
| Charts            | **Plotly.js** (`plotly.js-dist-min` behind our own `<Chart>`; `react-plotly.js` not needed), lazy-loaded.                                                                                                                                                                           | Spec recommendation; zoom, tooltips, box plots, heat maps, and PNG export built in.                                        |
| Web stack         | Stay on Next.js 16 + tRPC + Drizzle + SQLite. No Flask rewrite.                                                                                                                                                                                                                     | Spec allows it ("React is optional"); the report's technology table already justifies the mapping.                         |
| Modeling years    | 2015–2025 only. Train 2016–2021, validate 2022–2023, test 2024–2025. 1996–98, 2006–08 and partial 2026 excluded.                                                                                                                                                                    | Spec §5.4 chronological split; 2016 is the first year with a prior-year feature; the older uploads have big year gaps.     |

---

## Where Phase 1 leaves us

| Phase 2 need (spec §)                   | Already have                                                                                                                 | Gap                                                                                               |
| :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| Multi-year CAMPD data (§3)              | 57,414 unit-years, 2015–2026 from the API + older uploads; `NULL` = not reported                                             | Nothing major. Fuel/unit type are per unit, not per year (see Risks)                              |
| TRACI factors (§3, §4.6)                | —                                                                                                                            | Everything: table, import, mapping, calculation, UI                                               |
| Dataset builder filters (§4.1)          | `facility-filters.ts`: year range, state, facility, unit, fuel, unit type, controls, program, op-time/load ranges, URL state | Counts panel (records/facilities/units/years), missing-value summary, variable list, saved config |
| Descriptive stats (§4.2)                | Totals and percentile thresholds inside describe-search                                                                      | Count/missing/min/max/mean/median/sd/Q1/Q3/IQR/percentiles, grouped stats                         |
| Derived indicators (§4.3)               | CO₂ intensity (lb/MWh) and heat rate stored per record, `NULL`-safe                                                          | SO₂ and NOₓ intensity, YoY abs/% change, capacity factor                                          |
| Visualization (§4.4)                    | Map + globe, metric bars in compare, granular time series                                                                    | Line, bar, histogram, box, scatter, correlation heat map, ranking charts, PNG/data export         |
| Comparison (§4.5)                       | Compare 2–4 facilities/units; ranking per state                                                                              | States / fuels / unit types / with-vs-without control / period vs period, % diffs, stats tests    |
| Prediction (§5)                         | —                                                                                                                            | Everything                                                                                        |
| Sensitivity and scenarios (§6)          | —                                                                                                                            | Everything                                                                                        |
| Export with metadata (§7)               | `/api/export` CSV for six Phase 1 types                                                                                      | Analysis/stats/model/scenario exports, chart export, metadata bundle                              |
| Tests, migrations, env template (§12.3) | node:test suites, drizzle migrations, `.env.example`, `npm run validate`                                                     | Tests for every new calculation; pytest for the Python pipeline; TS↔Python inference parity test  |
| Report and presentation (§12.4–12.5)    | `report/main.tex`, `epaData-slides.pptx`, `slides-outline.md` (Phase 1)                                                      | Phase 2 sections, new screenshots, new demo script                                                |

---

## Schedule (4 weeks, compressed from the spec's 6)

| Week | Dates         | Goal                                                                                                                         |
| :--- | :------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| 1    | 10/30 – 11/05 | F0 foundations, F1 dataset builder, F2 derived indicators, F4 TRACI table + import. Python env + feature extraction started. |
| 2    | 11/06 – 11/12 | F3 descriptive stats, F4 impact calculation + UI, F5 dashboard (first 4 chart types), F7 training pipeline.                  |
| 3    | 11/13 – 11/19 | F5 remaining charts, F6 comparisons, F7 models in the app, F8 sensitivity + scenarios.                                       |
| 4    | 11/20 – 11/26 | F9 exports, F10 tests + cleanup, F11 report, F12 slides + demo script. **Feature freeze 11/22.** Thanksgiving 11/26.         |
| —    | 11/27 – 11/29 | Buffer: rehearsal, screenshots, final `npm run validate`, deploy, submit.                                                    |

---

## F0 — Foundations

Shared plumbing every feature below depends on. Do this first.

- [x] Python deps in `requirements.txt` (version floors, not pins, so Python 3.9 still works 🧪).
- [x] `src/components/ui/chart.tsx`: lazy-loads Plotly, theme tokens light/dark, title + units + PNG export + data download on every chart.
- [x] Routes and nav: **Analyze** (`/analyze`: Dataset · Statistics · Charts · Compare · Impacts) and **Predict** (`/predict`: Models · Sensitivity · Scenarios).
- [x] Routers `analysis.ts` and `prediction.ts`; computations in `src/server/analysis.ts` and `src/server/prediction.ts`.
- [x] Shared WHERE builder: `unitYearConditions` in `facilities.ts`, used by Explore's unit-years, exports, and Analyze.
- [-] `src/lib/units.ts`: not needed; `SHORT_TON_KG` lives in `src/lib/traci.ts`, rates in `src/lib/analysis.ts`.

**Done when:** `/analyze` and `/predict` render behind the nav, a sample Plotly chart themes correctly and downloads a PNG, `npm run validate` passes.

---

## F1 — Analytical dataset builder (§4.1)

- [x] Analyze reuses the Explore filter bar (`FacilityFilterBar`); opens on 2015–2025 by default. Ranking (Top N) is ignored by analyses.
- [x] Summary tiles: unit-years, facilities, units, reporting years.
- [x] Missing-value table: every variable with kind, unit, how groups combine it, missing count and %, definition.
- [x] Grouping fields with distinct counts.
- [x] URL round-trip: filters + every tab choice (`src/lib/analysis-state.ts`).
- [ ] Record one count against hand-written SQL for the report's test table (e.g. KY 2023–2024 = 177 unit-years).
- [ ] Stretch: `saved_analyses` table (name, filter JSON, created_at) + "Save / Load analysis" menu.

**Done when:** pasting an `/analyze?...` URL into a new tab reproduces identical counts and missing-value table; counts match a hand-written SQL query (record it in the report's test table).

---

## F2 — Derived performance indicators (§4.3)

- [x] CO₂/SO₂/NOₓ intensity, NOₓ rate (lb/MMBtu), heat rate: **computed on read** in `src/lib/analysis.ts`, not stored (always consistent with the records; no backfill).
- [x] Year-over-year change (tons and %) per unit via a self-join on the previous year; per facility/state through grouping.
- [x] Capacity factor with leap years; > 100 % kept.
- [x] Groups pool rates as Σ numerator ÷ Σ denominator over rows where the rate is defined.
- [x] One variable catalogue (`buildVariables`) feeds the UI, exports' metadata, and the report.
- [x] Tests in `src/lib/analysis.test.ts`.

**Done when:** every indicator has a test for its `NULL` path, and no undefined value is ever rendered as 0.

---

## F3 — Descriptive statistics (§4.2)

- [x] `src/lib/stats.ts` with NumPy's linear quantiles.
- [x] Grouped statistics by every grouping field; the four spec questions are "Try" links.
- [x] Statistics tab with sortable table and ZIP download.
- [x] Cross-check: `src/lib/stats.test.ts` holds NumPy/SciPy reference values (no separate script needed).

**Done when:** the four spec example questions each have a one-click "Try" link and match the pandas cross-check.

---

## F4 — TRACI environmental and health impact indicators (§3, §4.6)

- [x] Extract `data/traci/traci_2_2_air.csv` from EPA's `traci_2_2.xlsx` with source, date, and SHA-256 in `data/traci/README.md`.
- [x] `traci_factors` table (migration 0009) and `npm run traci:import`.
- [x] Exact substance match: `CARBON DIOXIDE`, `SULFUR DIOXIDE`, `NITROGEN OXIDES` (not `NITROGEN DIOXIDE`, which differs for smog).
- [x] Verified categories: global warming (CO₂ 1), acidification (SO₂ 1, NOₓ 0.7), human health particulate (SO₂ 0.0611, NOₓ 0.00722), smog (NOₓ 24.79). **The TRACI 2.2 workbook has no eutrophication column**, so there is none.
- [x] Calculation as variables in `impactVariables`: Σ kg × factor within a category; per-MWh variants.
- [x] Missing pollutant → that category is **missing** for the unit-year (changed from the "partial" plan: a partial sum would understate). Missing counts show on the Dataset tab.
- [x] Impacts tab: by any grouping field, one chart per category in its own unit, total or per MWh, factor table, formulas.
- [x] Disclaimer on the tab and in export metadata.
- [x] Tests in `src/lib/analysis.test.ts`.
- [ ] Worked example for one facility-year in the report.

**Done when:** one facility-year's impacts are reproduced by hand in the report (worked example) and match the app to the displayed precision.

---

## F5 — Interactive visualization dashboard (§4.4)

All charts: descriptive title, axis units, legend, tooltips, driven by the F1 filters, PNG export (Plotly) + "Download data" CSV.

- [x] Trend, bars, histogram/box (log toggle), scatter (log–log), correlation heat map (Pearson/Spearman, n on hover), rankings (top/bottom 20 facilities or units), state choropleth.
- [x] Fuel classes use the Map page's colors.
- [x] Impact charts use the same `<Chart>`.
- [x] Sampling: distributions ≤ 20k values, scatter ≤ 4k points, said on the chart.
- [x] 🧪 State map needs `cdn.plot.ly` (see top).
- [ ] Write two interpretations for the talk. Candidates found while testing: coal vs gas CO₂ lines cross in 2023 and 2025; the NOₓ-rate box plot by fuel class; Pearson gives CO₂ intensity × heat rate = 1.00 because of a few tiny-load outliers, which Spearman does not.

**Done when:** at least two charts have written interpretations ready for the presentation (§12.5 requires interpreting two).

---

## F6 — Comparative analysis (§4.5)

- [x] Compare tab: 2–8 groups along any grouping field (states, fuels, unit types, NOₓ/SO₂ control class, years). Phase 1's facility/unit compare dialog stays.
- [x] Pooled value, difference and % difference from the first group, count, mean with 95 % CI, median, SD, and a CI chart.
- [x] Welch t, Mann–Whitney U, ANOVA, Kruskal–Wallis (tie-corrected) in TS, checked against SciPy. Effect sizes not shown beyond the differences.
- [x] Plain-language reading with the association-not-causation and non-independence caveats.

**Done when:** "units with vs without SCR, NOₓ intensity, 2024" produces numbers, a chart, and a sentence a non-statistician can read.

---

## F7 — Prediction module (§5)

Target: **annual NOₓ mass (short tons) per unit-year.** Pipeline lives in `ml/` (Python), app integration in TS.

- [x] `ml/train.py` (one script: extract, train, evaluate, save, register). Rows: train 25,116, validation 7,970, test 7,755.
- [x] Inputs: heat input, gross load, operating time, nameplate MW, unit age, prior-year NOₓ rate, prior-year operating time, primary fuel, unit type, 5 control flags (SCR, SNCR, low-NOₓ burner, injection, overfire air). Capacity factor and state left out (redundant / sparse).
- [x] Leakage rules + ablation without same-year activity (validation R²: Ridge 0.70, tree 0.84).
- [x] Chronological split; settings tuned on validation, refit on 2016–2023, tested once on 2024–2025.
- [x] Baseline, Ridge (log target), decision tree. Test MAE 109.4 / 58.5 / 26.3 t; R² 0.49 / 0.83 / 0.95.
- [ ] Stretch: `HistGradientBoostingRegressor` for the report only.
- [x] Metrics MAE, RMSE, R², MAPE (target ≥ 1 t); predicted-vs-actual chart. [ ] Residual plot (optional).
- [x] Saved models (`ml/models/*.joblib` + `.json`, `metrics.json`) and the `models` table, written by `npm run ml:train` (no separate register step).
- [x] `src/lib/model.ts` + parity test (`src/lib/model.test.ts`, 200 rows, 1e-6, float32 tree thresholds like scikit-learn).
- [x] Models tab: comparison table, predicted vs actual, importance/coefficients, model record. Per-unit lookup is the baseline picker on Sensitivity/Scenarios.
- [x] `ml/test_pipeline.py`, `npm run test:py`.
- [x] README documents `ml:train`, `test:py`, `traci:import`.

**Done when:** both models beat the baseline on the test years (or the report honestly explains why not), and the Models tab shows numbers read from the `models` table.

---

## F8 — Sensitivity and scenario analysis (§6)

All computed in TS from the F7 JSON models — instant, works on Vercel.

- [x] One input at a time from a minimum to a maximum, in its own unit or as % of the baseline value; table with value, prediction, Δ, Δ %. Default baseline: Ghent unit 2, 2024 (coal, no SCR).
- [x] Curve with baseline diamond, dashed reference lines, tooltips, shaded out-of-range regions, warning text.
- [x] Scenarios: load ±%, heat input ±%, add/remove SCR, fuel switch, high efficiency, for Ridge and tree side by side. [ ] Fully custom scenario (only the two % values are editable).
- [x] Grouped bar chart labeled with % change; faded bars and table warnings when outside the training range.
- [ ] Optional: TRACI impacts of the predicted NOₓ.
- [x] "Model response, not a causal effect" captions.
- [~] Tests: out-of-range and direction tests exist; [ ] OVAT/% change unit tests (logic lives in the tab components; move it to `src/lib/model.ts` if we test it).

**Done when:** the demo can take one real coal unit, add SCR and cut heat input 5 %, and show the curve, the bar chart, and a range warning.

---

## F9 — Saving and exporting results (§7)

- [x] Every chart's **Data** button and every stats/impacts table: ZIP with CSV, `metadata.json`, and chart PNG (`ExportButton`, `src/lib/export-bundle.ts`).
- [x] `metadata.json`: time, URL, software version + commit, database snapshot (unit-years, datasets, last import), filters, tab choices, variable definitions, TRACI factors, model record, baseline.
- [x] `/api/export?type=analysis`: every selected unit-year with all variables (ZIP); **Download dataset** on Analyze.
- [x] Download page: its intro points to the analysis exports on Analyze and Predict.

**Done when:** an exported ZIP alone is enough to re-create the result (re-open the URL in metadata → same numbers).

---

## F10 — Testing, quality, and repo hygiene (§12.3)

- [x] `npm test`: 60 passing (stats vs SciPy, indicators, TRACI, model parity, ranges). [ ] Export metadata test.
- [x] `npm run test:py`: 6 passing.
- [x] Small fixtures only (`ml/fixtures/parity.json`, 100 KB).
- [x] Migration 0009; committed `db.sqlite` has the TRACI and model rows.
- [x] `.env.example`: nothing new to configure.
- [x] `npm run validate` green. 🧪 Vercel deploy.
- [x] Performance: a new selection loads in ~1.3 s (2015–2025, 47k unit-years), then is cached for 60 s; each view computes in ~0.1 s.
- [x] Commits per feature on `dev`.

---

## F11 — Updated report (§12.4, same structure as Phase 1 `report/main.tex`)

Drafted as **`report/phase2.tex`** (Phase 1's `main.tex` text is untouched; both now share
`report/preamble.tex`). Figures `report/figures/p2-*.jpg` were captured from the production
build. Every number was produced by the app or the training pipeline.

- [x] Project description: four analytical questions (Q1–Q4), users, objectives, scope.
- [x] Functions implemented, one subsection each, with screenshots.
- [x] Requirement traceability table (§3–§12.3) and plan-vs-delivered table.
- [x] System design: architecture diagram (TikZ), life cycle of an analysis, new tables, prediction without Python.
- [x] Methods: variable definitions and missing rules, pooling, quantiles, tests and their assumptions, TRACI mapping + **Ghent 2024 worked example**, prediction target, inputs, leakage, split, models, metrics.
- [x] Results: Q1 coal→gas shift, Q2 SCR comparison + correlation outlier, Q3 state impacts (total vs per MWh), Q4 model table, ablation, sensitivity, scenario disagreement.
- [x] Testing, defects found, assessment against the goals; discussion; limitations; future work.
- [x] Contributions (Phase 1 roles mirrored: RB back end and models, AB interface and slides). 🧪 Both of you check that this matches who does the remaining work.
- [x] References (TRACI 2.2, scikit-learn, Ridge, CART, Welch, Mann–Whitney, Kruskal–Wallis, SciPy, Plotly) and AI disclosure.
- [x] Update README and `DATABASE_BREAKDOWN.md`.
- [ ] 🧪 `npm run report` (needs `tectonic`; it could not be installed in the cloud session, so neither report was compiled there). The source passed static checks (braces, environments, refs, citations, figure paths, escaping); fix whatever the first build reports.
- [ ] Proofread on paper; check figure sizes and page breaks once compiled.

---

## F12 — Presentation and demonstration (§12.5)

- [ ] Slides (update `report/epaData-slides.pptx` or new deck): analytical question → architecture → features → model comparison → sensitivity → limitations → contributions.
- [ ] Demo script in `report/slides-outline.md` style (steps, inputs, expected numbers, timings):
  - [ ] Explain the analytical question.
  - [ ] Build a dataset, show stats.
  - [ ] Interpret ≥ 2 visualizations (e.g. NOₓ intensity by control box plot; CO₂ trend by fuel).
  - [ ] TRACI impacts for one facility.
  - [ ] Models vs baseline.
  - [ ] Sensitivity curve + scenario chart with an out-of-range warning.
  - [ ] Limitations.
- [ ] Split speaking roles; two full rehearsals with a timer; pre-demo checklist (`git restore db.sqlite`, prod build, warm pages).

---

## Risks and open questions

- **Fuel/unit type are per unit, not per year.** _Not changed in code; must go in the report's limitations._ Fuel-switched units (e.g. Big Sandy BSU1 coal → gas) get the wrong historical fuel as a model feature. Options: move fuel/unit type onto `annual_records` (the API rows have it; listed in Phase 1 future work) or exclude units whose fuel changed. Decide in week 1.
- ~~**TRACI factor verification.**~~ Done: factors read from EPA's workbook; see F4.
- **Schedule.** 4 weeks for a 6-milestone spec, with Thanksgiving in week 4. F1–F5 and F7–F8 are the must-haves; F6 statistical tests and saved analyses are the first things to cut.
- **Plotly bundle size**: loaded only when a chart mounts.
- **Model disagreement on SCR**: the tree barely responds to adding SCR (it leans on last year's NOₓ rate), while Ridge cuts Ghent 2 by ~59 %. Good material for the report and demo; don't hide it.
- **Owners:** assign each F-section to RB or AB at the top of the section.
