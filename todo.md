# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, live demo).
Spec: [`report/spec/phase2instr.pdf`](report/spec/phase2instr.pdf) · Rubric:
[`report/spec/phase2rubric.pdf`](report/spec/phase2rubric.pdf) · Report:
[`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why) · 🧪 needs a local
machine. Put initials after a task when you pick it up (`— RB` / `— AB`). **P0** do before
anything else · **P1** costs real points if not fixed · **P2** should fix · **P3** polish.

---

## P0 — Analyze/Predict restructure and site-wide UI alignment (do first)

Professor's critique: Analyze and Predict are heavy and confusing, a multi-sub-page data dump,
and they look and feel like a different site from Explore and Map. Everything below P0 is a
refinement, the report, or the slides, and the report figures, slides, and demo script all depend
on the final UI, so P0 comes first. **Keep every spec feature** (coverage checklist at the end of
this section); this is a reorganization, not a cut.

Evaluated 11/11 on `dev` against the running app (screenshots of every tab at 1440 px), using the
`create-viz` checklist (chart choice, titles, units, formatting, color meaning) and the
`build-dashboard` checklist (one primary chart, 2–4 KPIs, filters in the header, detail table
last, sensible defaults).

### Findings

| #   | Problem                                                                                                                                                                                                                                                                                                                                                | Where                |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------- |
| 1   | **Organized by technique, not by question.** Analyze has 5 tabs, and Charts adds 7 sub-tabs in a second tab row: 11 destinations. The histogram is under Charts, but the statistics it shows are under Statistics; bars by group are under Charts, but the group comparison is under Compare.                                                          | Analyze              |
| 2   | **The landing tab is metadata.** Analyze opens on Dataset: 4 KPIs, 9 grouping tiles, then 4 tables defining 29 variables (~3,000 px). It has no chart and no finding, so the first impression is a data dump.                                                                                                                                          | `dataset-tab.tsx`    |
| 3   | **No visual anchor; too many equal tiles.** Statistics shows 14 equal stat tiles, a 10-row outlier table, and a 15-column × 51-row table, but no picture of the distribution it describes.                                                                                                                                                             | `statistics-tab.tsx` |
| 4   | **Controls before content.** The ~250 px filter bar, then tab controls, then "Try" links push every result below the fold. Compare opens empty (no groups picked: a heading and nothing else). Statistics and Compare show a blank area, not a spinner, while loading.                                                                                 | all Analyze tabs     |
| 5   | **Tables repeat the charts.** Sensitivity puts a 21-row table under the curve, Scenarios a table under the bars, and Impacts a 51-row table of 13-digit numbers (`2,232,304,307,327` kg CO₂ eq) under 4 charts. Every chart already exports its data.                                                                                                  | Predict, Impacts     |
| 6   | **Too much prose.** Chart subtitles and section notes run 2–4 sentences (method + definition + caveat). Explore and Map use one line.                                                                                                                                                                                                                  | Analyze, Predict     |
| 7   | **The baseline picker takes 4 controls** (Model, Find facility, Year, a 40-row select) to choose one unit-year, and then shows its inputs as one run-on sentence. Scenarios shows the Model select but ignores it (it always plots both models). Year options are hard-coded (`YEARS` 2016–2025).                                                      | `predict-view.tsx`   |
| 8   | **Colors clash with their meaning elsewhere.** Ridge is blue and the tree is orange, but orange means Coal on every other page. TRACI categories use their own ad-hoc palette.                                                                                                                                                                         | Predict, Impacts     |
| 9   | **Why it feels like another site:** the components are shared, but the page layout differs. Explore and Map put results first (one table or map fills the page, compact controls, a one-line lead). Analyze and Predict put controls and text first, use two levels of tabs (underline tabs + a boxed segmented control), and stack full-width tables. | —                    |

### Analyze: 5 tabs, one tab level, organized by question (the Charts tab goes away)

**Done 11/11** (on `dev`): the 5 tabs below, old links mapped, unknown variables/fields reset to
defaults, error + retry on every chart, Compare bars + loading states, Impacts per-category top 15
with the table and factors collapsed, `src/app/error.tsx`, `scatter` fallback without WebGL.

| Tab                      | Question it answers                             | Contents (moved from)                                                                                                                                                                                                                                        | Spec             |
| :----------------------- | :---------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **Overview** _(default)_ | What's in my selection, and how did it change?  | 4 KPIs (unit-years, facilities, units, years); the trend chart as the main chart (Charts→Trend); state map + top-20 ranking side by side (Charts); collapsed **"Data quality & variables"** with the missing-value table and variable definitions (Dataset). | 4.1, 4.3, 4.4    |
| **Distribution**         | How is one variable spread, and what's unusual? | Variable + group-by; histogram/box plot first (Charts→Distribution); ≤ 6 tiles (count/missing, mean, median, SD, IQR); unusual observations; grouped table with all percentiles + export (Statistics); the 4 §4.2 examples.                                  | 4.2, 4.4, goal 5 |
| **Relationships**        | Which variables move together?                  | Scatter + correlation heat map (Charts).                                                                                                                                                                                                                     | 4.4, goal 5      |
| **Compare**              | How do groups differ?                           | Bars for all groups first (Charts→Bars); pick 2–8 for differences, CIs, tests, and the plain-language result (Compare). **Opens on "SCR vs no NOₓ control"**, not empty.                                                                                     | 4.5, 4.4 bars    |
| **Impacts**              | What are the potential TRACI impacts?           | Disclaimer, 4 small multiples (with the P1 top-15 fix), Total/per-MWh toggle; results table behind "Show table" in scaled units (Mt, kt); factors table in a disclosure.                                                                                     | 4.6              |

Rules for every tab: one main chart visible at 1440 × 900 without scrolling; at most 6 KPI tiles; tables after
charts, collapsed when they repeat a chart (the export stays); one-line subtitles, with
caveats and definitions in an "About this chart" disclosure; a useful default state. Map old
URLs (`tab=dataset|statistics|charts&chart=…`) to the new tabs in `parseAnalysisParams` so links in the
report and slides keep working.

### Predict: 2 sections instead of 3 tabs

**Done 11/11** (on `dev`): Models (test-MAE chart, metrics table, predicted vs actual +
importance, leakage and record collapsed) and What-if (picker, baseline card with each model's
prediction, sensitivity and scenarios on one page, Ridge | Tree | Both, tables behind "Show
values"). Model colors: Ridge indigo, tree fuchsia, baseline stone. Old tab links open What-if.

- **Models: "How good are the models?"** The comparison table with the baseline first, plus a
  small bar chart of test MAE per model as the visual anchor (§5.3); predicted-vs-actual and
  importance side by side; the leakage note and model record in a disclosure.
- **What-if: "How does one unit's prediction respond?"** One baseline card at the top (unit picker
  = the shared search below; years from the data; inputs as a key–value grid, not a sentence;
  actual NOₓ). Below it, the **sensitivity curve and the scenario bars on the same page**, both
  from that baseline. Model control: segmented **Ridge | Tree | Both** (§6.2 needs a model
  choice; "Both" overlays two curves and shows the SCR disagreement, the main demo story).
  Tables go behind "Show values". Old `tab=sensitivity|scenarios` URLs open What-if.

### Site-wide alignment (most of these remove code)

- [x] **One search box with suggestions, everywhere.** (11/11, `feat/shared-search`) Today there are four behaviors: Explore
      parses descriptions (`describeSearch`), Analyze matches name/operator/county as you type,
      Predict runs its own name-or-ID `LIKE` (`server/prediction.ts` `baselineOptions`), and
      Compare and Map have no search. Build one `<FacilitySearch>` combobox on one procedure
      `facilities.suggest({ q })`, reusing the `facilityConditions` search (name, operator,
      county, exact ID). It returns facilities and their units with state, fuel dot, and
      capacity. Enter runs the description parser, as on Explore. Use it in:
  - [x] Explore: adds suggestions; picking one filters to that facility (chip shows its name;
        a row click still opens the details).
  - [x] Analyze filter bar: gains description search. The parser already emits `yearMin`/`yearMax`,
        which Analyze uses.
  - [x] **Map (new):** picking a facility turns the globe or flies the flat map to it, rings it,
        and shows "Centered on … · Details"; a description sets filters as on Explore.
  - [x] Predict baseline: search → Year → Unit (that facility's units); `baselineOptions`
        replaced by `baselineUnits`; years come from the data.
  - [x] Compare group picker when grouping by facility or unit. This closes the P2 "80 of 1,590"
        item; keep the chip list for small groupings (fuel, state, control).
- [x] **One filter bar.** (11/11: Map uses `FacilityFilterBar`; Facility/Unit ID under Advanced; chips share the count row, so results start one row higher.)
- [x] **One page layout.** (11/11) `PageTitle` with a one-sentence lead, one underline tab row, then
      content. No second tab row.
- [x] **One export label set.** (11/11: "Download all" per page, "Download" per chart/section, "More formats".) Today exports are labeled "Download CSV" (Explore), "Download dataset" (Analyze),
      "Download" (sections), "Data" (charts), and "More options". Use "Download" + format through
      `ExportButton` everywhere.
- [x] **One color system.** (11/11: fuel colors for fuels, model colors for models, the default for single series.) Fuel colors from `getFuelTheme` (already used in Analyze). Models and
      TRACI categories get a palette that doesn't reuse Coal orange or Gas green.
- [x] **One number format** (11/11: Impacts table, Map chips, `formatPct` rounds before signing) for large quantities (`formatQuantity`: k/M/B, Mt) in the Impacts
      table, axes, and tiles. Also: Map fuel chips print `1139` next to `1,652`, and Scenarios
      mixes `+0.0 %` with `0.0 %`.
- [x] **One loading/empty/error pattern** (11/11) (`InlineLoading`, `EmptyState`) for Statistics and
      Compare (blank today). Do this together with the P1 error-handling item.
- [x] **Link Phase 1 and Phase 2.** (11/11: "Analyze these", "Analyze", "Predict" for the last complete year.) Explore's compare dock gets "Analyze in Compare"
      (`/analyze?tab=compare&compareBy=facility&groups=…`); the facility dialog gets "Analyze this
      facility"; the unit dialog gets "Predict this unit" (opens What-if with it as the baseline).
      Two "compare" features with no link between them is part of the "different site" feel.
- [x] `scattergl` has no fallback when WebGL is unavailable: headless Chrome shows "WebGL is not
      supported" in place of predicted-vs-actual. Fall back to `scatter`, as insurance for the
      demo machine.

### Order of work and done-when

1. `FacilitySearch` + `facilities.suggest` (unblocks Predict, Compare, and Map).
2. Analyze regroup + URL mapping; do the P1 Impacts top-15 fix and the P1 error states in the same
   pass.
3. Predict, 2 sections.
4. The remaining site-wide items. Good items for Arnav to own (rubric 1.2 participation): Map search,
   export labels, number formatting, loading states, Phase 1 → Phase 2 links.
5. Re-take the screenshots for the report figures and slides; update the tab names in the demo script.

Done when: every item in the checklist below is still reachable; Analyze has one tab level; each
tab shows a chart without scrolling at 1440 × 900; old URLs still open the right view;
`npm run validate`, `npm test`, and `npm run build` pass.

**Spec coverage checklist (must survive the restructure):** §4.1 counts, missing-value summary,
variables, URL state → Overview · §4.2 full statistics, grouped, 4 examples → Distribution ·
§4.3 derived indicators → catalog, all tabs · §4.4 line, bar, histogram/box, scatter, heat map,
ranking, state map, each with title, units, legend, tooltips, filters, and export → Overview,
Distribution, Relationships, Compare · §4.5 facilities/units, states/fuels/types, with vs
without a control, periods; differences, % differences, ranks, chart, CIs, tests, plain-language
result → Compare · §4.6 mapping, kg conversion, separate categories, per-MWh, TRACI version and
factors, disclaimer → Impacts · §5 baseline + 2 models, chronological split, metrics, leakage →
Models · §6.2 model, baseline, variable, min/max, step; input, prediction, absolute and % change
(table kept, collapsed) → What-if · §6.3 five scenarios + range warning, §6.4 curve, baseline point
and reference lines, scenario bars, tooltips, shading → What-if · §7 export + metadata on every chart and
table → unchanged.

---

## Grade estimate (audit 11/02, against the rubric)

Code, tests, and every number in the report were checked by hand (SQL against `db.sqlite`,
direct tRPC calls, `npm test` 60/61 + 1 skipped, `npm run test:py` 6/6, lint, typecheck,
Prettier). **`npm run build` fails** (P1-1).

| Rubric area                              |    Pts | Now      | Main deductions                                                             |
| :--------------------------------------- | -----: | :------- | :-------------------------------------------------------------------------- |
| 1.1 Weekly meetings                      |     12 | —        | Graded in meetings, not from the repo                                       |
| 1.2 Commit history                       |      3 | 1.5      | All Phase 2 code in 11 commits on 10/30–31; 9 authored by "Claude"          |
| 1.2 Team participation                   |      2 | 0.5      | Arnav: 1 commit authored, co-author on 25 (needs to explain that work)      |
| 1.2 Branch and merge                     |      1 | 0.75     | One large "Phase 2 Draft" PR; no feature branches                           |
| 1.2 Issues and documentation             |      1 | 0.75     | Good tracker and docs; no GitHub issues                                     |
| 1.2 Repository quality                   |      1 | 0.75     | Build broken; stale spec path and dataset count in README                   |
| 2 Analytical data layer                  |      7 | 6.5      | —                                                                           |
| 2 Descriptive and comparative            |      7 | 6.25     | Compare picker shows only 80 of 1,590 facilities                            |
| 2 TRACI impact assessment                |      8 | 7.25     | Impacts charts by facility/unit show the wrong top 15                       |
| 2 Interactive visualization              |     10 | 9.0      | Explanations still to be given in the demo                                  |
| 2 Prediction module                      |      9 | 8.0      | Only a weak median baseline; export metadata gives the wrong training years |
| 2 Sensitivity and scenario               |      8 | 7.25     | Numeric inputs only; 401-point cap is silent                                |
| 2 Integration and usability              |      5 | 3.0      | Build fails; no error states; bad input → 500; not Flask (justified)        |
| 2 Presentation quality and participation |      6 | 0        | Not started                                                                 |
| 3 Objectives and data sources            |      3 | 3.0      | —                                                                           |
| 3 Methods                                |      5 | 4.75     | —                                                                           |
| 3 Results and interpretation             |      5 | 4.5      | Charts figure covers 3 of 7 chart types                                     |
| 3 Evaluation, limitations, validation    |      4 | 3.75     | No uncertainty on model metrics; "validate passes" no longer true           |
| 3 Organization, reproducibility, writing |      3 | 2.5      | Small factual drifts (P2 report list)                                       |
| **Total (excl. meetings)**               | **88** | **70.0** | Projected ≈ 78–83 / 88 once P1 is done and the demo goes well               |

Summary: **report ≈ 18.5/20 (A)**, **application ≈ 47/54 (A−)**, **GitHub record ≈ 4.25/8
(weakest area)**, presentation not started.

Update 11/05: the scores above are from the 11/02 audit and weren't re-graded. On `dev`, format,
lint, typecheck, `npm test` (60 pass, 1 skipped), `npm run test:py` (6 pass), and `npm run build`
all pass, and the README, `DATABASE_BREAKDOWN.md`, and other docs were checked against the code
and database.

Update 11/11: re-checked the open P1/P2 code items against `dev` and found none fixed yet (no `src/app/error.tsx`,
`findVariable` still throws a plain `Error`, Impacts still uses one `aggregate` call with
`limit: 100`, `train_years` is still the tuning split, `downloadBundle` still revokes at once).
`master` is still at `69bacc4`, 10 commits behind `dev`. The professor's UI critique is now P0;
it bears on Interactive visualization (10), Integration and usability (5), and Presentation (6).

---

## P1 — fix before submission

- [ ] **Vercel production deploy fails on `master`.** Cause (deploy log, 11/05): the
      `chore(deps)` commit moved `master` to zod 4, and the type check fails on `z.record(z.unknown())`
      (`campd/client.ts:129`, `llm-search.ts:143`) and `errorMap` (`export.ts:44`). `dev` is on zod 3
      and deploys. Fix: commit the pending work on `dev`, run `git merge -s ours master` on `dev`, then
      merge `dev` into `master` by PR. A plain merge conflicts, but `master`'s squash has the same files
      as `dev`'s audit commit, so this only drops the `chore(deps)` commit. The 11/02 Google Fonts
      crash did not reproduce; if it returns, self-host IBM Plex with `next/font/local`.
- [ ] **Commit history and participation (rubric 1.2, 5 pts).** History was rewritten on 11/05
      (conventional messages, Arnav co-author trailers); don't rewrite it again. Arnav resets his
      clone to the new history. From now on: both members commit weekly under their own git
      identity (credit AI with a `Co-Authored-By` trailer, not as author), commits go straight to `dev` (11/11: no feature branches), and Arnav owns a visible share of the remaining work (e.g. the P1
      error-handling and P2 UI items, slides). Open GitHub issues for the items below and close
      them from PRs.
- [x] **Error handling (rubric: integration, 5 pts).** (11/11) Phase 2 tabs never show query errors and
      there is no `error.tsx`. `?variable=nope` throws `Unknown variable` as
      `INTERNAL_SERVER_ERROR` and the tab stays blank. Fix: throw `TRPCError("BAD_REQUEST")` in
      `findVariable`; fall back to defaults for unknown variable/dimension keys in
      `parseAnalysisParams`; show an inline error with retry in each tab; add `src/app/error.tsx`.
- [x] **Impacts tab shows the wrong top 15 for large groupings** (`impacts-tab.tsx`). The query
      keeps the 100 groups largest in the _first_ category, and every other chart picks its top 15
      from those. Checked: acidification per MWh by facility shows only 5 of the true top 15. The
      subtitle "the 15 largest of 1,590 groups" is then wrong. Fix: rank each category on the
      server (one `aggregate` call per category, `limit: 15`), keep the table call separate.
- [ ] **Model metadata gives the wrong training years.** The registered models are refit on
      2016–2023, but `models.train_years` (and so every Predict export's `trainYears`) says
      2016–2021. Training ranges for the warnings also come from 2016–2023. Fix in
      `ml/train.py`: store `fit_years` 2016–2023 and keep the tuning split separately, then
      `npm run ml:train`, `npm test` (parity), and check the Models tab and report wording.

## P2 — should fix

### Code

- [x] Compare tab group picker lists the first 80 groups alphabetically (facility: 80 of 1,590),
      so most facilities and units can't be compared without extra filters. Add a search box, or
      order by count and raise the limit. → Fixed by the P0 shared search (Compare picker).
- [ ] Add a persistence baseline (last year's NOₓ, or prior-year rate × this year's heat input)
      next to the median baseline. The median baseline is easy to beat, and graders will ask how
      much the models add over "same as last year". Report the result honestly in Q4.
- [ ] Tree tuning picked depth 16, the top of the grid. Extend the grid (20, 24, unlimited) and
      say so in the report.
- [ ] Sensitivity: warn when the 401-point cap cuts the curve short; show an inline message for
      min > max or a zero step instead of silently fixing them.
- [ ] Spearman heat map takes 1.8 s (measured 11/02). Rank each column once when it has no
      missing values; update the report's Performance table and Known issues.
- [ ] `downloadBundle` revokes the object URL right after `a.click()`, which can cancel downloads
      in Safari. Revoke in a `setTimeout`.
- [ ] Tests: export metadata has every §7 field; OVAT and % change logic moved from the tab
      components into `src/lib/model.ts` and unit-tested; `findVariable` rejects unknown keys.

### Report and docs

- [ ] Re-verify every "passes / green" claim after the build fix (§Testing: `npm run validate`).
- [ ] Fix drifts: row cache is 5 minutes in code, "60 seconds" in the report (pick one); parity
      fixture is 124 KB, not 100 KB; training years after the P1 fix.
- [ ] Charts coverage: add one composite figure (histogram, scatter, ranking, state map) so all of
      §4.4 is visible.
- [ ] Integration: one sentence and one slide on why Next.js instead of Flask (the rubric says
      "existing Flask application"; the spec allows React).
- [~] Spec rename: commit `report/spec/phase2instr.pdf` + `phase2rubric.pdf` (the old
  `ProjectPhase2.pdf` is the same text). `report/README.md` already points to them. Staged
  on `dev` (11/11), not yet committed.
- [ ] Proofread on paper; both confirm the contributions section. 🧪
- [ ] Finish the commit hash made stale by the history rewrite: update `pipeline_version`
      `5d5e7d0` → `ed8e24a` in `ml/models/metrics.json` and the `models` table (the next
      `ml:train` writes a new one).
- [ ] Commit the final `report/phase2/phase2-report.pdf`.

### Local checks 🧪

- [ ] Python 3.9 venv (README's documented minimum): `pip install -r requirements.txt`, then
      `npm run test:py`. If it passes, say so in the README and report §4.2.
- [ ] Hosted build: charts render, ZIP downloads work, Upload refuses writes.
- [ ] ZIP downloads in Safari and Chrome (PNG, CSV, `metadata.json`); every tab in dark mode.
- [ ] If scripts or migrations fail: `echo $DATABASE_URL` (a shell value overrides `.env`). If lint
      or types fail where they passed before: `npm ci`, then delete `.next/`.

## P3 — optional

- [ ] Pin exact Python versions (constraints file) so `ml:train` reproduces the committed models.
- [ ] Memoize chart `data`/`layout` so `Plotly.react` doesn't run on every parent render.
- [ ] OVAT over a categorical input (fuel, a control flag) as a bar chart.
- [ ] TRACI impacts of the predicted NOₓ on Sensitivity/Scenarios (§6.4, optional).
- [ ] `saved_analyses` table + Save/Load analysis (§4.1 alternative to URLs).
- [ ] Residual plot on the Models tab; display CAS numbers with dashes.

---

## Weekly meetings (rubric 1.1, 12 pts)

Each meeting: show working progress live, explain one decision and one problem, give next week's
plan. Both members attend and speak.

| Week | Milestone (spec §10)              | What to show                                            |
| :--- | :-------------------------------- | :------------------------------------------------------ |
| 1    | Analytical data layer             | Dataset tab, derived indicators, TRACI import (done)    |
| 2    | Descriptive and TRACI analysis    | Statistics, Compare, Impacts (done)                     |
| 3    | Interactive visualization         | Charts tab + exports; P1 build and error-handling fixes |
| 4    | Prediction models                 | Models tab; persistence baseline; training-years fix    |
| 5    | Sensitivity and scenario analysis | Sensitivity/Scenarios; impacts top-15 fix; report edits |
| 6    | Integration, testing, final       | Slides, rehearsed demo, final report PDF                |

---

## Done (summary)

All spec functions are built, tested, and on `dev`; see git history for detail.

- **Data layer (§3, §4.1, §4.3):** filters incl. emissions program, counts, missing-value table,
  URL round-trip, 29 variables (rates pooled, NULL-safe), `traci_factors` (migration 0009).
- **Statistics and comparison (§4.2, §4.5):** full stat set, grouped, Tukey outliers; 2–8 groups
  with CIs, Welch/MWU/ANOVA/KW, plain-language caveats; checked against NumPy/SciPy.
- **TRACI (§4.6):** exact substance mapping, 4 categories, per-MWh, disclaimer; Ghent 2024 worked
  example re-checked 11/02 (12,744,620 kg SO₂ eq).
- **Charts (§4.4):** trend, bars, histogram/box, scatter, correlation, rankings, state map.
- **Prediction (§5):** NOₓ target, leakage rules + ablation, chronological split, baseline /
  Ridge / tree (test R² 0.49 / 0.83 / 0.95), parity test, pytest.
- **Sensitivity and scenarios (§6):** OVAT curve with baseline marks and shaded out-of-range,
  five named scenarios for both models, range warnings, non-causal captions.
- **Exports (§7):** ZIP (CSV + PNG + `metadata.json`) on every chart and table,
  `/api/export?type=analysis`.
- **Report:** 32 pages in the Phase 1 structure; numbers re-checked 10/31 and spot-checked 11/02.

---

## Locked decisions

| Decision          | Choice                                                                                  | Why                                                                           |
| :---------------- | :-------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| Compute stack     | Stats, indicators, TRACI in TS on the server; models trained in Python, replayed in TS. | Keeps pandas/sklearn, works on the read-only Vercel deploy, instant what-ifs. |
| Prediction target | Annual NOₓ mass (short tons) per unit-year, regression.                                 | Every spec scenario (+10 % load, −5 % heat input, control change) changes it. |
| Charts            | Plotly.js behind `<Chart>`, lazy-loaded.                                                | Spec recommendation; zoom, tooltips, heat maps, PNG export built in.          |
| Web stack         | Next.js 16 + tRPC + Drizzle + SQLite. No Flask rewrite.                                 | Spec allows it ("React is optional"); justify it in the talk.                 |
| Modeling years    | Tune: train 2016–2021, validate 2022–2023. Final fit 2016–2023, test 2024–2025.         | §5.4 chronological split; 2016 is the first year with a prior-year input.     |

## Risks

- **Fuel and unit type are per unit, not per year** (in the report's limitations).
- **Models disagree on SCR:** the tree barely responds; Ridge cuts Ghent 2 by ~59 %. Feature it.
- **State map needs `cdn.plot.ly`**, and the build needs Google Fonts. Check
  the demo network.
- **Rubric says "Flask":** prepare the justification before the demo.

---

## Final — presentation and demo (§12.5) · start only when asked

- [ ] Slides in `report/phase2/slides/`: question → architecture → features → models vs
      baseline → sensitivity/scenario → limitations → contributions.
- [ ] `report/phase2/slides/slides-outline.md`: demo script with steps, inputs, expected numbers,
      timings, covering each §12.5 item:
  - [ ] The analytical question (Q1–Q4).
  - [ ] Build a dataset, show statistics.
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel (crossings 2023/2025); NOₓ-rate box plot
        by fuel; backup: Pearson vs Spearman correlation outlier.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline (Models tab).
  - [ ] Sensitivity curve + scenario chart with an out-of-range warning (Ghent unit 2).
  - [ ] Limitations.
- [ ] Both members speak; two timed rehearsals; pre-demo checklist (`git restore db.sqlite`,
      prod build, warm pages, network check).
