# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, live demo).
Spec: [`report/spec/phase2instr.pdf`](report/spec/phase2instr.pdf) · Rubric:
[`report/spec/phase2rubric.pdf`](report/spec/phase2rubric.pdf) · Report:
[`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why) · 🧪 needs a local
machine. Put initials after a task when you pick it up (`— RB` / `— AB`). **P1** costs real points
if not fixed · **P2** should fix · **P3** polish. Finished items move to **Done** as one line.

Workflow: commit straight to `dev` under your own git identity (short subject, bullet body,
`Co-authored-by` trailer); merge `dev` into `master` by PR with a merge commit (not squash) when it
should go live. #16 was squash-merged; `dev` merged `master` back on 11/12, so they share history
again. `dev` is ahead of `master` by the 11/12 prediction and report work.

---

## Status (11/12)

The professor's critique (Analyze and Predict heavy, a sub-page data dump, a different site) is
addressed: Analyze has 5 question tabs on one tab level, Predict has Models and What-if, and
search, filters, layout, exports, colors, loading/error states, and Phase 1 ↔ Phase 2 links are
shared site-wide (details under Done). `npm run validate` passes on 11/12 (81 tests: 80 pass, 1
skipped; 10 pytest); production deploy succeeded on 11/11.

Rubric 1.2 (GitHub record) cleanup is done (11/11): no commit is authored by Claude (the 9
Phase 2 commits of 10/30 were re-authored as Raaj, keeping their AI co-author trailers; trees
unchanged), `master` and `dev` share history, stale branches are gone, README and docs use the
current tab names, and open work is in issues #6–#15 split by area. What 1.2 still needs is
Arnav's own commits (#8, #9, #10, #15).

Rubric areas still at risk (the 11/02 audit scored the app ≈ 47/54, report ≈ 18.5/20; not
re-graded since):

- **1 Presentation (6 pts):** not started (#15, Final section).
- **2 Prediction (9) / report Evaluation (4):** addressed 11/12 — test metrics have 95 %
  intervals, and a persistence reference (last year's rate × heat input) is reported. It beats
  both models (18.5 t vs tree 26.3 t); Q4 says so and why. Rehearse the answer for the demo.

---

## P2 — should fix

### Code

- [ ] (#8) Sensitivity: show an inline message for min > max or a zero step instead of silently
      fixing them. (The 401-point cap now warns.) The grid now lives in `sensitivityGrid`
      (`src/lib/model.ts`, tested), which still normalizes the inputs; add the message in
      `sensitivity.tsx` and extend the tests.
- [ ] (#9) Spearman heat map takes 1.8 s (measured 11/02). Rank each column once when it has no
      missing values; update the report's Performance table and Known issues.
- [ ] (#10) `downloadBundle` revokes the object URL right after `a.click()`, which can cancel downloads
      in Safari. Revoke in a `setTimeout`.
- [ ] Merge `dev` into `master` by PR (merge commit) once the 11/12 work is reviewed; the
      `Fixes #6/#7/#11–#14` trailers close those issues then.

### Report and docs

- [ ] Proofread on paper (34 pages since 11/12); both confirm the contributions section. 🧪
- [ ] (#15) The Flask slide from #13 belongs in the slides: the report's Architecture paragraph
      has the argument (extending Phase 1 vs re-implementing it; spec allows React).

### Local checks 🧪

- [ ] Hosted build: charts render, ZIP downloads work, Upload refuses writes.
- [ ] ZIP downloads in Safari (Chrome checked 11/12; Safari is the one #10 is about).
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
| 4    | Prediction models                 | Models tab with intervals; persistence beats the models |
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
- **Report, 11/11:** all 10 figures re-taken from the new tabs; §4, traceability, tests, and
  contributions use the new tab names; a paragraph on the redesign.
- **GitHub record, 11/11:** Claude-authored commits re-authored; issues #6–#15 assigned.
- **Report:** 32 pages in the Phase 1 structure; numbers re-checked 10/31 and spot-checked 11/02.
- **Prediction, 11/12 (#6, #7, #14):** persistence reference in `train.py` and `metrics.json`
  (not served); it beats both models, and `ml/reformulations.py` shows three reformulations
  don't close the gap. Tree grid to 20/24/unlimited (the tree stops at depth 18 by itself).
  Cluster-bootstrap 95 % intervals on test metrics, shown on the Models tab. Retrained from
  `567665c`, which `pipeline_version` now records.
- **Tests, 11/12 (#11):** §7 metadata check (`missingMetadata`) with builders the pages and server
  export share; What-if math moved to `src/lib/model.ts` and tested; `findVariable` in
  `src/lib/analysis.ts` throws `UnknownVariableError` (still HTTP 400).
- **Report, 11/12 (#12, #13):** Q4 rewritten (persistence, intervals, reformulations); Figure 3
  (histogram, scatter) completes §4.4; Models figure re-taken; Flask paragraph; cache drift
  fixed; PDF rebuilt (34 pages). `npm run report` uses the bundle URL since the relay is down.
- **Python 3.9, 11/12:** on 3.9.25 (pandas 2.3, NumPy 2.0, scikit-learn 1.6) pytest passes and a
  retrain in a scratch worktree reproduces every reported number (tree MAE within 0.0001 t);
  README and report §4.2 say so.
- **Dark mode and Chrome downloads, 11/12:** every page and tab screenshotted in dark mode; the only
  defect, near-black CI error bars on Compare groups and Models, now take the theme's text color
  (`<Chart>`). Chart ZIPs from all 5 Analyze tabs and both Predict tabs downloaded in Chrome:
  CSV, PNG, and `metadata.json` in each, every §7 item present.

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
- **Persistence beats the models:** expect "why not just use last year?" Answer: it is the better
  forecast (Q4); the models are for responses to load, controls, and fuel, which persistence
  cannot express, and those responses are associations, not causal effects.
- **State map needs `cdn.plot.ly`**, and the build needs Google Fonts. Check the demo network.
- **Rubric says "Flask":** prepare the justification before the demo.

---

## Final — presentation and demo (§12.5) · start only when asked

- [ ] (#15) Slides in `report/phase2/slides/`: question → architecture → features → models vs
      baseline → sensitivity/scenario → limitations → contributions.
- [ ] `report/phase2/slides/slides-outline.md`: demo script with steps, inputs, expected numbers,
      timings, covering each §12.5 item:
  - [ ] The analytical question (Q1–Q4).
  - [ ] Build a dataset (filters or a description search), show statistics (Distribution).
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel on Overview (crossings 2023/2025);
        NOₓ-rate box plot by fuel on Distribution; backup: Pearson vs Spearman on Relationships.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline (Models tab), the intervals, and the persistence result.
  - [ ] What-if for Ghent unit 2 with Both: sensitivity curve + scenarios with an out-of-range
        warning.
  - [ ] Limitations.
- [ ] Both members speak; two timed rehearsals; pre-demo checklist (`git restore db.sqlite`,
      prod build, warm pages, network check).
