# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, demo). Spec: [`report/spec/ProjectPhase2.pdf`](report/spec/ProjectPhase2.pdf).
Report source: [`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex) (layout: [`report/README.md`](report/README.md)).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why) · 🧪 needs a local
machine. Put initials after a task when you pick it up (`— RB` / `— AB`). Priority: **P1** must
fix before submission · **P2** should fix (costs points if missed) · **P3** polish / stretch.

---

## Status (10/31)

Report P1 pass done: [`report/phase2/phase2-report.pdf`](report/phase2/phase2-report.pdf) builds
clean (32 pages, no overfull boxes or undefined refs). Every number in it was re-checked against
`db.sqlite`, `ml/models/metrics.json`, direct model calls, or hand-written SQL.

| Area                        | Grade  | Notes                                                                                                             |
| :-------------------------- | :----- | :---------------------------------------------------------------------------------------------------------------- |
| Code vs spec §3–§7          | **A**  | Only optional items left (P3).                                                                                    |
| Repo hygiene §12.3          | **A**  | `npm run validate` green; `npm test` 61 (60 pass, 1 skipped: needs uncommitted `dataImports/`); `test:py` 6 pass. |
| Report                      | **A−** | Phase 1 structure complete; contradictions fixed. Left: proofread, one more charts figure.                        |
| Presentation and demo §12.5 | —      | Not started; waits for the go-ahead (last section).                                                               |

---

## P1 — report pass (done 10/31)

- [x] Report folder reorganized into `phase1/`, `phase2/`, `shared/`, `spec/` (see `report/README.md`).
- [x] Layout: Impacts and Dataset screenshots cropped; TRACI equations split (`align`); model table fits; long URL breaks; listings no longer split across pages; figures float (`[!htbp]`, float pages top-aligned) so tall screenshots no longer leave half-empty pages.
- [x] New sections in the Phase 1 structure: Technical details (§4), Highlighted features (§7, four listings incl. a real `metadata.json`), Representative test cases (13 rows, SQL-checked), Performance (measured), Known issues.
- [x] Added "Data flow and reproducibility" (§3.4).
- [x] Objectives: O8–O10 listed with Phase 1 wording; O9 marked not built (not in the spec); O11 now met (deployed at cs396-project.vercel.app).
- [x] Test counts: 61 TS (17 new in three files) + 6 pytest, the same everywhere.
- [x] SCR counts: one sentence explains 1,564/571 records vs 1,547/479 with a defined rate.
- [x] Scenarios: "same direction", not "agree"; fuel switch and high-efficiency numbers re-checked.
- [x] Sensitivity: both models under-predict Ghent unit 2 (Ridge 2,972 t, tree 2,738 t vs 4,146 t) because its NOₓ rate rose from 0.227 to 0.314 lb/MMBtu; now stated.
- [x] Q1: coal and gas lines cross twice (2023, 2025).
- [x] Performance claim fixed: views are 11–220 ms, but the Spearman heat map takes ~1.9 s (now in Known issues).
- [x] Traceability: rows added for §1 goal 5, §4.4 maps, §6.2 step, §6.4 (impact response marked not met, optional), each §7 export, §8 steps 5/10.
- [x] Plan vs delivered: custom scenarios, impacts of predicted NOₓ, residual plot, O9 added.
- [x] Assessment table covers the nine spec goals and O8–O12.
- [x] Local venv rebuilt (`epaDataVENV`, Python 3.15); `npm test` and `npm run test:py` green.
- [x] Local `node_modules` was out of sync with the lockfile (zod 4 installed, `^3.24` declared → 2 lint errors); `npm ci` fixed it. Stale `.next/` types from that install cleared. `npm run validate` green.
- [x] README: Prettier fix for the report-table edit; Python line now says trained on 3.13, `test:py` passes on 3.15.
- [x] Report no longer claims the pipeline runs on Python 3.9 (floors allow it; not re-run).

---

## P2 — should fix

### Report

- [ ] Charts coverage: only trend, box, and correlation are shown. Add one composite figure of histogram / scatter / rankings / state map so §4.4 is visibly met.
- [ ] Proofread on paper (wording and figure order; page breaks are clean as of 10/31).
- [ ] Contributions: both confirm the RB/AB split before submission. 🧪
- [ ] Commit `report/phase2/phase2-report.pdf` with the final version.

### Code / tests

- [ ] Export metadata test (`export-bundle.ts`): required §7 fields present.
- [ ] Move OVAT / % change logic out of the tab components into `src/lib/model.ts` and unit-test it.
- [ ] Spearman heat map: rank each column once when it has no missing values (1.9 s → well under 1 s); update the report's Performance table and Known issues if done.

### Local checks 🧪

- [ ] Python 3.9 venv (the README's documented setup): `pip install -r requirements.txt`, then `npm run test:py`. If it passes, say so in the report's §4.2 and README.
- [ ] Retrain with `npm run ml:train`, then `npm test` (parity must still pass); update the report/README tables if metrics move.
- [ ] Hosted build: charts render and ZIP downloads work (Predict and Upload pages checked 10/31).
- [ ] ZIP downloads in Safari and Chrome (PNG, CSV, `metadata.json`).
- [ ] Every tab in dark mode.
- [ ] If scripts or migrations fail: `echo $DATABASE_URL` (a shell value overrides `.env`).
- [ ] If lint or types fail on a machine where they passed before: `npm ci` (installs exactly the lockfile), then delete `.next/`.

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
- **F11 report:** all Phase 1-style sections, checked numbers, clean build.

---

## Locked decisions

| Decision          | Choice                                                                                                                     | Why                                                                               |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| Compute stack     | Hybrid: stats, indicators, TRACI in TS on the server; models trained offline in Python, exported as JSON, evaluated in TS. | Keeps pandas/sklearn, works on the read-only Vercel deploy, instant interactions. |
| Prediction target | Annual NOₓ mass (short tons) per unit-year, regression.                                                                    | Every spec scenario (+10 % load, −5 % heat input, control change) changes it.     |
| Charts            | Plotly.js (`plotly.js-dist-min`) behind `<Chart>`, lazy-loaded.                                                            | Spec recommendation; zoom, tooltips, box plots, heat maps, PNG export built in.   |
| Web stack         | Next.js 16 + tRPC + Drizzle + SQLite. No Flask rewrite.                                                                    | Spec allows it ("React is optional").                                             |
| Modeling years    | 2015–2025. Train 2016–2021, validate 2022–2023, test 2024–2025.                                                            | §5.4 chronological split; 2016 is the first year with a prior-year feature.       |

## Risks and open questions

- **Fuel/unit type are per unit, not per year** (in the report's limitations). Fuel-switched units get the wrong historical fuel.
- **Model disagreement on SCR:** tree barely responds; Ridge cuts Ghent 2 by ~59 %. Feature it in the talk, don't hide it.
- **State map needs `cdn.plot.ly`** at runtime; skip that chart if the demo network blocks it.
- **Time:** 4 weeks left with Thanksgiving; P1 first, P3 only if everything above is done.

---

## Final — presentation and demo (§12.5) · start only when asked

Don't start this until the team asks for it.

- [ ] Slides in `report/phase2/slides/` (Phase 1 deck is in `report/phase1/slides/`): question → architecture → features → model comparison vs baseline → sensitivity/scenario → limitations → contributions.
- [ ] `report/phase2/slides/slides-outline.md`: demo script (steps, inputs, expected numbers, timings), covering each §12.5 item:
  - [ ] Explain the analytical question (Q1–Q4).
  - [ ] Build a dataset, show stats.
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel (crossings 2023/2025); NOₓ-rate box plot by fuel; backup: Pearson vs Spearman correlation outlier.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline (Models tab).
  - [ ] Sensitivity curve + scenario chart with an out-of-range warning (Ghent unit 2).
  - [ ] Limitations.
- [ ] Split speaking roles; two timed rehearsals; pre-demo checklist (`git restore db.sqlite`, prod build, warm pages, check `cdn.plot.ly` on the demo network).
