# epaData Phase 2 — PRD and tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, demo). Spec: [`report/ProjectPhase2.pdf`](report/ProjectPhase2.pdf).

Phase 2 turns the Phase 1 data-management site into a decision-support tool: descriptive
statistics, derived indicators, interactive charts, comparisons, TRACI impact indicators, a
prediction model, and sensitivity/scenario analysis, all exportable with reproducibility
metadata.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why). Put an
owner's initials after a task when someone picks it up, e.g. `— RB` / `— AB`.

---

## Locked decisions

| Decision          | Choice                                                                                                                                                                                                                                                                              | Why                                                                                                                        |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| Compute stack     | **Hybrid.** Stats, indicators, TRACI, and chart data in SQL + TypeScript (tRPC). Models trained **offline** in Python (pandas, NumPy, scikit-learn), saved as `joblib` + a JSON export (coefficients / tree arrays) that TypeScript evaluates for live predictions and sensitivity. | Keeps the spec's pandas/sklearn, keeps the Vercel read-only deploy working (no Python at request time), fast interactions. |
| Prediction target | **Annual NOₓ mass (short tons) per unit-year**, regression.                                                                                                                                                                                                                         | Leak-free enough to be honest, and every spec scenario (+10 % load, −5 % heat input, control change) changes it.           |
| Charts            | **Plotly.js** (`react-plotly.js` + `plotly.js-dist-min`), lazy-loaded per page.                                                                                                                                                                                                     | Spec recommendation; zoom, tooltips, box plots, heat maps, and PNG export built in.                                        |
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

- [ ] Add Python deps to `requirements.txt`: `pandas`, `numpy`, `scikit-learn`, `joblib`, `scipy`, `pytest` (pin versions).
- [ ] Add `plotly.js-dist-min` + `react-plotly.js` (+ types); build a `<Chart>` wrapper in `src/components/ui/` that lazy-loads Plotly (`next/dynamic`, `ssr: false`), applies light/dark theme tokens, and always sets title, axis titles with units, and the PNG export button.
- [ ] New routes and nav entries (after Map, before Retrieve): **Analyze** (`/analyze`) with tabs _Dataset · Statistics · Charts · Compare · Impacts_, and **Predict** (`/predict`) with tabs _Models · Sensitivity · Scenarios_.
- [ ] New tRPC router `src/server/api/routers/analysis.ts` (keep `facilities.ts` from growing past 1.1k lines).
- [ ] Extract the filter → SQL `WHERE` builder so Explore and Analyze share one implementation (one source of truth for "the selected records").
- [ ] Shared `src/lib/units.ts` for unit constants and labels (`SHORT_TON_KG = 907.18474`, lb/ton, display units).

**Done when:** `/analyze` and `/predict` render behind the nav, a sample Plotly chart themes correctly and downloads a PNG, `npm run validate` passes.

---

## F1 — Analytical dataset builder (§4.1)

- [ ] Analyze → Dataset tab reuses the Explore filter form: year range, state, facility, unit, primary fuel, unit type, control technology, program code, min operating time, min gross load.
- [ ] Summary panel: selected **records, facilities, units, years**.
- [ ] Missing-value summary: per variable, count and % `NULL` in the selection (table + small bar).
- [ ] "Variables available" list: numeric metrics + derived indicators (F2) with unit and definition; categorical fields with distinct counts.
- [ ] Filters round-trip through URL params (same keys as Explore) — the URL _is_ the analysis config.
- [ ] Stretch: `saved_analyses` table (name, filter JSON, created_at) + "Save / Load analysis" menu.

**Done when:** pasting an `/analyze?...` URL into a new tab reproduces identical counts and missing-value table; counts match a hand-written SQL query (record it in the report's test table).

---

## F2 — Derived performance indicators (§4.3)

- [ ] Add SO₂ intensity and NOₓ intensity (lb/MWh) next to the existing CO₂ intensity in `deriveRates` (`src/lib/emissions-metrics.ts`); store on `annual_records` via a migration + backfill, or compute in SQL — pick one and document it.
- [ ] Year-over-year absolute and % change per unit and per facility (SQL `LAG()` window over year), `NULL` when either year is missing or the prior value is 0.
- [ ] Capacity factor = gross load ÷ (nameplate MW × hours in year), `NULL` when nameplate is missing/0; flag > 100 % rather than clamping.
- [ ] Aggregated intensities are **ratio of sums** (Σ emissions ÷ Σ load over records where both are reported), never mean of ratios. Document this.
- [ ] Indicator definitions (formula + unit + `NULL` rule) in one exported constant, reused by the UI tooltips, exports' metadata (F9), and the report.
- [ ] Unit tests: division by zero, missing numerator, missing denominator, leap year in capacity factor, YoY with gaps.

**Done when:** every indicator has a test for its `NULL` path, and no undefined value is ever rendered as 0.

---

## F3 — Descriptive statistics (§4.2)

- [ ] `src/lib/stats.ts`: count, missing count, min, max, mean, median, sample SD, Q1, Q3, IQR, chosen percentiles (default 5/10/90/95). Use one documented quantile method (linear interpolation, same as NumPy's default).
- [ ] Grouped statistics: group by state, fuel, unit type, year, control technology, facility; aggregate = mean / median / total / count. Covers the spec's examples (avg CO₂ by state, median NOₓ intensity by fuel, total SO₂ by year, avg heat rate by unit type).
- [ ] Analyze → Statistics tab: variable picker, group-by picker, sortable results table, CSV download.
- [ ] Cross-check script `scripts/check_stats.py`: pandas computes the same stats on a fixture; a test compares them with `stats.ts` to 1e-9.

**Done when:** the four spec example questions each have a one-click "Try" link and match the pandas cross-check.

---

## F4 — TRACI environmental and health impact indicators (§3, §4.6)

- [ ] Download EPA TRACI 2.2 characterization factors; commit a **small** extracted CSV (`data/traci/traci_2_2_air.csv`, only CO₂/SO₂/NOₓ to air) with a README citing the source file and access date. Do not commit the full workbook.
- [ ] Migration: `traci_factors` table — `traci_version`, `substance`, `cas`, `medium` (= air), `impact_category`, `cf_value`, `cf_unit`, `source_note`.
- [ ] Explicit pollutant map (code constant, not name matching): CAMPD `co2MassTons` → TRACI carbon dioxide; `so2MassTons` → sulfur dioxide; `noxMassTons` → nitrogen oxides. Fail loudly if a mapped substance has no verified factor.
- [ ] Import script `npm run traci:import` (idempotent upsert, records version).
- [ ] Look up and verify which categories apply (expected: global warming — CO₂; acidification — SO₂, NOₓ; eutrophication — NOₓ; smog formation — NOₓ (+SO₂ if present); particulate-matter human health — SO₂, NOₓ). Record each factor + unit in the report.
- [ ] Calculation in `src/lib/traci.ts`: `mass_kg = short_tons × 907.18474`; `impact_c = Σ_i mass_kg,i × CF_i,c` **within a category only**; optional `impact_c ÷ gross_load_MWh`. Missing pollutant → that pollutant's contribution is missing, and the result says "partial" with which pollutant was absent (do not silently treat as 0).
- [ ] Analyze → Impacts tab: aggregate by facility / unit / state / fuel / year; one column (or chart panel) per category, each in its own equivalent unit; toggle "per MWh"; every result shows TRACI version + factors used.
- [ ] Plain-language disclaimer on the tab and in exports: potential impact for comparison, not measured illness, exposure, or damage.
- [ ] Unit tests: conversion constant, single-pollutant hand calc, multi-pollutant sum, categories never mixed, partial-missing case, per-MWh with zero load.

**Done when:** one facility-year's impacts are reproduced by hand in the report (worked example) and match the app to the displayed precision.

---

## F5 — Interactive visualization dashboard (§4.4)

All charts: descriptive title, axis units, legend, tooltips, driven by the F1 filters, PNG export (Plotly) + "Download data" CSV.

- [ ] Line: emissions, gross load, and intensity over time (by group, up to ~8 series).
- [ ] Bar: compare states / fuels / facilities / units / control technologies on any metric or indicator.
- [ ] Histogram + box plot: distribution of a chosen variable, optional group split (log-scale toggle — emissions are heavily skewed).
- [ ] Scatter: any two variables, colored by fuel/unit type, hover shows unit and year.
- [ ] Correlation heat map: Pearson (and Spearman toggle) across numeric variables, pairwise-complete, n shown in tooltip.
- [ ] Rankings: top/bottom N facilities or units as horizontal bars (reuse Phase 1 ranking SQL).
- [ ] Map: state choropleth of a chosen metric/indicator (reuse `public/geo/us-states-10m.json`); keep existing facility map linked.
- [ ] Impact charts (F4) reuse the same bar/line components.
- [ ] Sampling guard: scatter/histogram over > 20k points → sample or bin server-side, and say so on the chart.

**Done when:** at least two charts have written interpretations ready for the presentation (§12.5 requires interpreting two).

---

## F6 — Comparative analysis (§4.5)

- [ ] Extend Compare beyond 2–4 facilities/units to groups: **states, fuels, unit types**, **with vs without a selected control** (e.g. SCR), **period A vs period B**.
- [ ] Output per comparison: summary stats per side, absolute and % difference, rank, normalized indicators (intensities), a chart.
- [ ] Statistics (use `scipy` offline for verification, implement in TS for the app): 95 % CI for the mean (t), Welch two-sample t-test, Mann–Whitney U, one-way ANOVA (+ Kruskal–Wallis) for 3+ groups, correlation. Show p-value and effect size.
- [ ] Plain-language result sentence generated per test, including assumptions and the "association, not causation" caveat (e.g. SCR units differ in age and size too).
- [ ] Tests: each statistic against SciPy output on a fixed fixture.

**Done when:** "units with vs without SCR, NOₓ intensity, 2024" produces numbers, a chart, and a sentence a non-statistician can read.

---

## F7 — Prediction module (§5)

Target: **annual NOₓ mass (short tons) per unit-year.** Pipeline lives in `ml/` (Python), app integration in TS.

- [ ] `ml/extract.py`: pull unit-years 2015–2025 from `db.sqlite` into a pandas frame; drop rows with missing target; document row counts at each filter step.
- [ ] Features: gross load, heat input, operating hours, capacity factor, nameplate MW, primary fuel, unit type, NOₓ control set (multi-hot: SCR, SNCR, LNB, DLN, water injection, …), state (or EPA region if too sparse), unit age, **prior-year NOₓ rate (lb/MMBtu)**, prior-year operating hours.
- [ ] **Leakage rules (write them in the report):** never use same-year NOₓ, NOₓ intensity, or anything computed from them. Run an ablation without same-year heat input/load to show how much of the score is "the unit ran more" vs genuine prediction.
- [ ] Split: train 2016–2021, validate 2022–2023 (tuning), test 2024–2025 (reported once). No random split.
- [ ] Models: **baseline** = median NOₓ by fuel × unit type (train years); **Ridge** (log-target, scaled numerics, one-hot categoricals); **Decision tree regressor** (depth tuned on validation). Stretch: `HistGradientBoostingRegressor` for the report only.
- [ ] Metrics on validation and test: MAE, RMSE, R², MAPE (only on rows with target ≥ 1 ton; say why). Also residual plot and predicted-vs-actual scatter.
- [ ] Save each model: `ml/models/<name>.joblib` + `ml/models/<name>.json` (preprocessing params, coefficients or tree node arrays, feature list, training-range min/max per feature, metrics, split years, sklearn version, git SHA).
- [ ] Migration: `models` table (id, name, target, features JSON, params JSON, train/val/test years, metrics JSON, artifact path, pipeline version, created_at). `npm run ml:register` loads the JSON files into it. Optional `model_predictions` table for test-set predictions.
- [ ] `src/lib/model-inference.ts`: evaluate Ridge and tree JSON in TS. **Parity test**: TS predictions on 200 fixture rows equal sklearn's to 1e-6.
- [ ] Predict → Models tab: comparison table (baseline vs Ridge vs tree, val and test), predicted-vs-actual chart, residuals, feature importance / coefficients, per-unit prediction lookup.
- [ ] `ml/test_pipeline.py` (pytest): split has no year overlap, no leaked columns, baseline metric reproducible, JSON export round-trips.
- [ ] `npm run ml:train` documented in README (needs the venv; the app itself does not).

**Done when:** both models beat the baseline on the test years (or the report honestly explains why not), and the Models tab shows numbers read from the `models` table.

---

## F8 — Sensitivity and scenario analysis (§6)

All computed in TS from the F7 JSON models — instant, works on Vercel.

- [ ] One-variable-at-a-time: pick model, baseline unit-year, one numeric input, min/max, step (absolute or %). Hold all else constant. Table: input value, prediction, Δ abs, Δ %.
- [ ] Sensitivity curve (Plotly): varied input on x, prediction on y; marked baseline point; dashed reference lines at baseline input and prediction; tooltips with value/prediction/Δ/Δ%; **shaded region outside the training range** with a warning.
- [ ] Named scenarios vs baseline: gross load +10 %, heat input −5 %, fuel or NOₓ-control category changed (e.g. add SCR), combined high-efficiency (load same, heat input −5 %, add SCR). Users can edit percentages and add a custom scenario.
- [ ] Scenario bar chart: baseline + each scenario, labeled with % change = (scenario − baseline) ÷ baseline × 100.
- [ ] Out-of-range warning per scenario when any changed input leaves the training min/max (or category unseen in training).
- [ ] Optional: also show the TRACI acidification/eutrophication/smog result of the predicted NOₓ (F4 × F7) so scenarios speak in impact units too.
- [ ] Persistent caption: "model response, not a causal effect."
- [ ] Tests: OVAT holds other inputs fixed; % change formula; out-of-range detection at the boundaries; tree model produces step curves (sanity).

**Done when:** the demo can take one real coal unit, add SCR and cut heat input 5 %, and show the curve, the bar chart, and a range warning.

---

## F9 — Saving and exporting results (§7)

- [ ] Exports: filtered analytical dataset, summary/grouped stats, comparison results, TRACI results, model evaluation + test predictions, sensitivity table, scenario table, chart data (CSV) and chart image (PNG via Plotly).
- [ ] Format: **ZIP** = `data.csv` + `metadata.json` (+ `chart.png` when relevant). Use `fflate`.
- [ ] `metadata.json`: analysis timestamp, dataset identifier (dataset IDs + DB last-import time), filters and variables, indicator definitions (from F2), TRACI version + factors (F4), model name/features/params, train/val/test years (F7), app version + git SHA.
- [ ] Extend `/api/export` with the new types (same route, new `type` values) rather than a parallel route.
- [ ] Download page gets an "Analysis exports" section listing them.

**Done when:** an exported ZIP alone is enough to re-create the result (re-open the URL in metadata → same numbers).

---

## F10 — Testing, quality, and repo hygiene (§12.3)

- [ ] `npm test` covers: stats, indicators, TRACI, comparisons, model inference parity, sensitivity/scenarios, export metadata.
- [ ] `pytest ml/` covers the training pipeline; add `npm run test:py`.
- [ ] Small fixtures only (`ml/fixtures/`, `src/lib/__fixtures__/`); no large raw data, no keys.
- [ ] Migrations for every new table; `npm run db:migrate` works from a fresh clone; committed `db.sqlite` updated with TRACI + models rows.
- [ ] `.env.example` updated if anything new is configurable.
- [ ] `npm run validate` green; Vercel read-only build works with the new pages.
- [ ] Performance check: Analyze tab on all 2015–2025 records responds < 1 s locally (add indexes if not).
- [ ] Commit history: small, descriptive commits per feature.

---

## F11 — Updated report (§12.4, same structure as Phase 1 `report/main.tex`)

- [ ] Project description: Phase 2 analytical question(s) and goals; intended users.
- [ ] Functions implemented: one subsection per F1–F9 with screenshots (`report/figures/`).
- [ ] Requirement traceability table for Phase 2 spec §4–§7.
- [ ] System design: updated architecture diagram (hybrid TS + offline Python), new tables in the ER diagram.
- [ ] Methods: indicator definitions, quantile method, TRACI mapping + worked example, statistical tests and assumptions, model features, leakage rules, split, metrics.
- [ ] Results: model comparison table vs baseline, ablation, sensitivity and scenario findings, two interpreted charts.
- [ ] Testing: new test cases, parity test, stats cross-checks.
- [ ] Limitations: potential vs actual impacts, model ≠ causation, fuel/unit type not versioned per year, extrapolation outside training range, sparse pre-2015 data.
- [ ] Planned-vs-delivered table for Phase 2; individual contributions; references (TRACI 2.2, CAMPD, scikit-learn, Plotly); generative AI disclosure.
- [ ] Update README (remove "Phase 2 is not part of this repository"), `DATABASE_BREAKDOWN.md`.
- [ ] `npm run report` builds cleanly.

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

- **Fuel/unit type are per unit, not per year.** Fuel-switched units (e.g. Big Sandy BSU1 coal → gas) get the wrong historical fuel as a model feature. Options: move fuel/unit type onto `annual_records` (the API rows have it; listed in Phase 1 future work) or exclude units whose fuel changed. Decide in week 1.
- **TRACI factor verification.** Need the actual TRACI 2.2 file and to confirm a nitrogen-oxides air factor exists for each category before using it (spec forbids approximate name matching).
- **Schedule.** 4 weeks for a 6-milestone spec, with Thanksgiving in week 4. F1–F5 and F7–F8 are the must-haves; F6 statistical tests and saved analyses are the first things to cut.
- **Plotly bundle size** on Vercel — lazy-load only on chart pages.
- **Owners:** assign each F-section to RB or AB at the top of the section.
