# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, live demo).
Spec: [`report/spec/phase2instr.pdf`](report/spec/phase2instr.pdf) · Rubric:
[`report/spec/phase2rubric.pdf`](report/spec/phase2rubric.pdf) · Report:
[`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why) · 🧪 needs a local
machine. Put initials after a task when you pick it up (`— RB` / `— AB`). **P1** costs real points
if not fixed · **P2** should fix · **P3** polish. Finished items move to **Done** as one line.

Workflow: commit straight to `dev` (short subject, bullet body, `Co-authored-by` trailer); merge
`dev` into `master` by PR with a merge commit (not squash) when it should go live. `master` and
`dev` are in sync as of 11/11 (#5), and production deploys again.

---

## Status (11/11)

The professor's critique (Analyze and Predict heavy, a sub-page data dump, a different site) is
addressed: Analyze has 5 question tabs on one tab level, Predict has Models and What-if, and
search, filters, layout, exports, colors, loading/error states, and Phase 1 ↔ Phase 2 links are
shared site-wide (details under Done). Format, lint, typecheck, `npm test` (63 pass), and
`npm run build` pass; production deploy succeeds.

Rubric areas still at risk (the 11/02 audit scored the app ≈ 47/54, report ≈ 18.5/20, GitHub
record ≈ 4.25/8; not re-graded since):

- **1.2 GitHub record (8 pts), the weakest area:** participation and issues (P1 below).
- **2 Presentation (6 pts):** not started (Final section).
- **2 Prediction (9) / report Evaluation (4):** only a weak median baseline (P2 persistence
  baseline); no uncertainty on model metrics.
- **3 Results (5):** the report's charts figure covers 3 of 7 chart types, and its screenshots and
  tab names predate the 11/11 restructure (P1).

---

## P1 — fix before submission

- [ ] **Re-take report figures and screenshots after the 11/11 restructure.** Tab names changed
      (Dataset/Statistics/Charts → Overview/Distribution/Relationships; Sensitivity/Scenarios →
      What-if). Update the report text, figures, and the demo script; old URLs still open the
      right view, so links in the report keep working.
- [ ] **Commit history and participation (rubric 1.2, 5 pts).** Don't rewrite history again. Both
      members commit weekly under their own git identity (credit AI with a `Co-Authored-By`
      trailer, not as author), and Arnav owns a visible share of the remaining work (e.g. the P2
      code items, slides). Open GitHub issues for the open items below and close them from
      commits (`Fixes #n`).

## P2 — should fix

### Code

- [ ] Add a persistence baseline (last year's NOₓ, or prior-year rate × this year's heat input)
      next to the median baseline. The median baseline is easy to beat, and graders will ask how
      much the models add over "same as last year". Report the result honestly in Q4.
- [ ] Tree tuning picked depth 16, the top of the grid. Extend the grid (20, 24, unlimited) and
      say so in the report.
- [ ] Sensitivity: show an inline message for min > max or a zero step instead of silently
      fixing them. (The 401-point cap now warns.)
- [ ] Spearman heat map takes 1.8 s (measured 11/02). Rank each column once when it has no
      missing values; update the report's Performance table and Known issues.
- [ ] `downloadBundle` revokes the object URL right after `a.click()`, which can cancel downloads
      in Safari. Revoke in a `setTimeout`.
- [ ] Tests: export metadata has every §7 field; OVAT and % change logic moved from the What-if
      components into `src/lib/model.ts` and unit-tested; `findVariable` rejects unknown keys.

### Report and docs

- [ ] Re-verify every "passes / green" claim (§Testing: `npm run validate`).
- [ ] Fix drifts: row cache is 5 minutes in code, "60 seconds" in the report (pick one); parity
      fixture is 124 KB, not 100 KB.
- [ ] Charts coverage: add one composite figure (histogram, scatter, ranking, state map) so all of
      §4.4 is visible.
- [ ] Integration: one sentence and one slide on why Next.js instead of Flask (the rubric says
      "existing Flask application"; the spec allows React).
- [ ] Proofread on paper; both confirm the contributions section. 🧪
- [ ] Update `pipeline_version` `5d5e7d0` → a current commit in `ml/models/metrics.json` and the
      `models` table (the next `ml:train` writes a new one).
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
- [ ] TRACI impacts of the predicted NOₓ on What-if (§6.4, optional).
- [ ] `saved_analyses` table + Save/Load analysis (§4.1 alternative to URLs).
- [ ] Residual plot on the Models tab; display CAS numbers with dashes.

---

## Weekly meetings (rubric 1.1, 12 pts)

Each meeting: show working progress live, explain one decision and one problem, give next week's
plan. Both members attend and speak.

| Week | Milestone (spec §10)              | What to show                                            |
| :--- | :-------------------------------- | :------------------------------------------------------ |
| 1    | Analytical data layer             | Overview tab, derived indicators, TRACI import (done)   |
| 2    | Descriptive and TRACI analysis    | Distribution, Compare groups, TRACI impacts (done)      |
| 3    | Interactive visualization         | The 11/11 restructure; shared search; Phase 1 ↔ 2 links |
| 4    | Prediction models                 | Models tab; persistence baseline                        |
| 5    | Sensitivity and scenario analysis | What-if (Ridge vs tree on SCR); report figures re-taken |
| 6    | Integration, testing, final       | Slides, rehearsed demo, final report PDF                |

---

## Done (summary)

All spec functions are built, tested, and on `dev` and `master`; see git history for detail.

- **Data layer (§3, §4.1, §4.3):** filters incl. emissions program, counts, missing-value table,
  URL round-trip, 29 variables (rates pooled, NULL-safe), `traci_factors` (migration 0009).
- **Statistics and comparison (§4.2, §4.5):** full stat set, grouped, Tukey outliers; 2–8 groups
  with CIs, Welch/MWU/ANOVA/KW, plain-language caveats; checked against NumPy/SciPy.
- **TRACI (§4.6):** exact substance mapping, 4 categories, per-MWh, disclaimer; Ghent 2024 worked
  example re-checked 11/02 (12,744,620 kg SO₂ eq). Each category ranks its own top 15 (11/11).
- **Charts (§4.4):** trend, bars, histogram/box, scatter (SVG fallback without WebGL),
  correlation, rankings, state map.
- **Prediction (§5):** NOₓ target, leakage rules + ablation, chronological split, baseline /
  Ridge / tree (test R² 0.49 / 0.83 / 0.95), parity test, pytest. Exports give the fit years
  (2016–2023) and the tuning split separately (11/11).
- **Sensitivity and scenarios (§6):** OVAT curve with baseline marks and shaded out-of-range,
  five named scenarios, range warnings, non-causal captions; Ridge | Tree | Both (11/11).
- **Exports (§7):** ZIP (CSV + PNG + `metadata.json`) on every chart and table,
  `/api/export?type=analysis`.
- **11/11 UI restructure (professor's critique):** Analyze = Overview / Distribution /
  Relationships / Compare groups / TRACI impacts, one tab level, results first, long text under
  "About this chart", tables collapsed; Predict = Models / What-if with a baseline card. Old
  URLs map to the new tabs. One `FacilitySearch` with suggestions on Explore, Analyze, Map
  (centers the globe/map on the pick), Predict, and Compare; one filter bar; "Download all" /
  "Download" labels; fuel and model colors kept apart; one loading/error pattern plus
  `app/error.tsx`; "Analyze these", "Analyze", and "Predict" links from Explore's dialogs.
- **Deploy:** `master` back to zod 3 via `git merge -s ours`; production deploys (11/11, #5).
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
| Analyze layout    | One tab per question, one tab level, results before controls.                           | Professor's critique (11/11); matches Explore and Map.                        |

## Risks

- **Fuel and unit type are per unit, not per year** (in the report's limitations).
- **Models disagree on SCR:** the tree barely responds; Ridge cuts Ghent 2 by ~59 %. Feature it
  (What-if, Both).
- **State map needs `cdn.plot.ly`**, and the build needs Google Fonts. Check the demo network.
- **Rubric says "Flask":** prepare the justification before the demo.

---

## Final — presentation and demo (§12.5) · start only when asked

- [ ] Slides in `report/phase2/slides/`: question → architecture → features → models vs
      baseline → sensitivity/scenario → limitations → contributions.
- [ ] `report/phase2/slides/slides-outline.md`: demo script with steps, inputs, expected numbers,
      timings, covering each §12.5 item:
  - [ ] The analytical question (Q1–Q4).
  - [ ] Build a dataset (filters or a description search), show statistics (Distribution).
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel on Overview (crossings 2023/2025);
        NOₓ-rate box plot by fuel on Distribution; backup: Pearson vs Spearman on Relationships.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline (Models tab).
  - [ ] What-if for Ghent unit 2 with Both: sensitivity curve + scenarios with an out-of-range
        warning.
  - [ ] Limitations.
- [ ] Both members speak; two timed rehearsals; pre-demo checklist (`git restore db.sqlite`,
      prod build, warm pages, network check).
