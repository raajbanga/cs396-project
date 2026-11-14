# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, live demo).
Spec: [`report/spec/phase2instr.pdf`](report/spec/phase2instr.pdf) · Rubric:
[`report/spec/phase2rubric.pdf`](report/spec/phase2rubric.pdf) · Report:
[`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex).

Legend: `[ ]` todo · `[x]` done · 🧪 needs a person or a local machine. Put initials on a task
when you pick it up (`— RB` / `— AB`). **P1** costs rubric points · **P2** refinement · **P3**
optional.

Workflow: commit to `dev` under your own git identity (short subject, bullet body,
`Co-authored-by` trailer), push, and merge `dev` into `master` when it should go live. If the
merge is a squash, keep the `Fixes #…` lines in the squash message so the issues close, then
merge `master` back into `dev`.

---

## Rubric audit (11/12)

Every spec function (§3–§7) is built, tested, and verified in the browser. A fresh clone set up
from the README passes `npm run validate` (82 tests: 81 pass, 1 skipped) and `npm run test:py`
(10), and serves the app. No credentials in any of the 114 commits. The gaps below are about the
commit spread, one missing §6.4 element, search outside Explore, and pages that show numbers
without saying what they mean.

| Rubric area                      | Pts | State                                                   |
| :------------------------------- | --: | :------------------------------------------------------ |
| 1.1 Weekly meetings              |  12 | People (table below)                                    |
| 1.2 Commit history               |   3 | **At risk:** commits fall in 3 weeks (W41, W44, W46)    |
| 1.2 Team participation           |   2 | OK (Arnav shows on the contributor graph)               |
| 1.2 Branches, issues, repo       |   3 | OK (6 PRs, issues #6–#15, README current, no secrets)   |
| 2 Data layer, analysis, TRACI    |  22 | Met; **results shown, rarely interpreted** (P1 UX)      |
| 2 Visualization                  |  10 | Met; jargon and toggles unexplained (P1 UX)             |
| 2 Prediction                     |   9 | Met; persistence beats the models (rehearse the answer) |
| 2 Sensitivity and scenarios      |   8 | Baseline input and prediction lines in place (§6.4)     |
| 2 Integration and usability      |   5 | Search ranks on every page (11/13); hosted is 11/11     |
| 2 Presentation and participation |   6 | **Not started** (#15, Final)                            |
| 3 Report                         |  20 | Met; cite CAMPD and the software (P2)                   |

---

## P1 — costs points

- [x] **Search: one global selection, so rankings work on every page.** — RB (11/13)
  - [x] Rankings (11/13). Top N is now part of the filters (`topN`, `topBy`, `topDir`,
        `topLevel`, `rankGroup`): `topSelection` in `facilities.ts` keeps the first N facilities
        (their matching unit-years added up) or unit-years, and Explore, Map, Analyze, and every
        download apply it. "top 10 facilities by CO2 in 2025" gives 10 facilities on all three
        pages (38 unit-years); Explore's column sort is display order only. Advanced has Keep /
        Of / By / Order / Group on every page, one chip reads "Top 10 facilities by CO₂", and old
        `topN` links rank by their table sort. Test: `src/server/top-selection.test.ts`.
  - [x] On Analyze a description search keeps the 2015–2025 range unless it names years ("in
        2025" becomes 2025–2025).
  - [x] What-if and Compare groups' facility pickers: Enter picks the highlighted or first match
        (waiting for the list if needed), and says "No facility matches" otherwise. What-if no
        longer shows the old plant's name beside the new ID while loading.
  - [x] Parser: "NOx rate" ranks by NOₓ rate (lb/MMBtu, as on Analyze), "heat rate" and "carbon
        intensity" by those rates, and "units over 1000 MW" / "between 100 and 300 MW" filter on
        a new Capacity range (Advanced). "heat rate over 10" reports "over 10" as not
        understood: rates rank but have no min/max filter.
  - Note: a search that names no years ranks over all years on Explore and Map, but over
    2015–2025 on Analyze (its default range), so the top N can differ there; naming a year
    ("in 2024") gives the same rows everywhere.
- [ ] **Pages show numbers without saying what they mean** (rubric 2: "interprets results
      rather than merely displaying numbers"; "explain what each visualization shows and why it
      is appropriate"). Explore's facility dialog is the model: every headline number has a
      plain sub-label (heat rate "9.4 MMBtu/MWh", "≈ 1.7M homes"), and a short paragraph built
      from the data says what they mean. Phase 2 pages have numbers and controls, and the
      little explanation there is is hidden under "About this chart".
  - **Done 11/13:** every Analyze tab and Models opens with plain sentences built from the data
    (`src/lib/takeaways.ts`, tested): Overview (selection, total, yearly trend, top fuel's
    share, top facility's share), Distribution (typical range, mean vs median, top/bottom
    group, outliers), Relationships (strength in words; strongest and most opposed pairs),
    Compare (its Result, same style), Models (error in tons and %, gain over baseline, R²),
    What-if curve (each model's range). Big tables fold under "Show details"-style sections;
    numbers ≥ 10,000 show short (19.5B). Also done: glossary on table headers (`src/lib/glossary.ts`), TRACI reading (who leads,
    what "kg CO₂ eq" means), the persistence result on Models, scenario reading (largest change,
    biggest model disagreement), coefficients/importance in words, quick State/Fuel filters.
    Still open: definitions for terms inside sentences and subtitles (only headers have them).
  - Shared fixes, one place each: (1) a **reading line** under each chart title, computed from
    the data, saying what the chart shows (e.g. "Gas emitted more CO₂ than coal in 2023 and 2024; coal fell 41 % from 2015 to 2025"); (2) a **glossary tooltip** (one dictionary, an ⓘ next to the term) for MAE,
    RMSE, R², MAPE, IQR, P5–P95, Pearson/Spearman, log scale, kg CO₂ eq, standardized
    coefficient, α, tree depth/leaf, bootstrap interval, ablation; (3) "About this chart" says
    how to read the chart and why this chart type, not only the data source.
  - **Models (worst):** no sentence says how good the models are or what 26 t means; say it
    against a typical unit-year (median NOₓ), and state the persistence result (18.5 t beats
    both) since that is the main finding. Column headers (Val., MAE, RMSE, R², MAPE, "no
    same-year activity"), the interval small print, "α = 10", and "depth ≤ 20, leaves ≥ 20"
    are undefined. Predicted-vs-actual needs "above the line = over-predicted; log scales so
    small and large units both show". Ridge coefficients need a plain reading ("more heat
    input → more NOₓ; SCR → the largest cut") instead of "standardized, log(1 + NOₓ)". The
    "Model" picker sits mid-page and only drives the two charts under it; say so or move it.
  - **Overview:** every "About this chart" says only "CO₂ emitted, as reported". Add the trend
    reading, the top state, and the top facility's share.
  - **Distribution:** say what mean ≫ median means (a few large units dominate); define
    Q1–Q3, IQR, and P5–P95 in the table header; explain the Box plot and Log toggles and
    "Tukey's far-out fences" in words.
  - **Relationships:** "Pearson r = 0.7243" → "strong positive link (r = 0.72)"; explain
    Log–log (each step is ×10, so small and large plants both show); say when to pick Spearman.
  - **Compare groups:** already has a Result paragraph (good); explain the Statistic column
    (t, U, F, H, df) or hide it behind the plain Question column.
  - **TRACI impacts:** say what each category and "kg CO₂ eq / SO₂ eq / PM2.5 eq / O₃ eq"
    mean; add the reading (largest contributor, and whether Per MWh changes the order).
  - **What-if:** in the baseline card, say how far each model is from the actual (Ridge
    −28 %); on the curve, say the slope ("+10 % heat input → +x t with Ridge, +y t with the
    tree"); explain "% of baseline" vs the unit toggle.
- [ ] **Commit steadily in W47 and W48 (1.2 history, 3 pts).** Nothing was committed in W42,
      W43, or W45; the rubric discounts a burst before the deadline. Spread the remaining items
      over both weeks and both members.
- [x] **§6.4 baseline-prediction reference line.** One dashed horizontal line per model at its
      baseline prediction, in the model's color, plus the vertical one at the baseline input
      (11/13, with the chart rework). Re-take the sensitivity figure for the report.
- [x] **Charts on Recharts (shadcn charts), decluttered** (11/13). Plotly is gone; eight shared
      pieces in `src/components/charts/` (lines, bar list, columns, histogram, box plot, scatter,
      heat grid, state map) and one `ChartFrame` replace 14 hand-built configs. Quiet style:
      horizontal gridlines only, no boxes, values written on bars, color only for fuel, model,
      or sign (earthy palette in `globals.css`, also the Map's fuel colors). Lost: Plotly's
      drag-zoom; PNG export is kept (SVG → canvas). Re-take report figures.
- [ ] **Merge `dev` into `master` and redeploy before the demo.** The hosted build is still 11/11
      (no intervals, persistence, or the 11/12 fixes).
- [ ] (#15) Slides and demo script (Final section).

## P2 — refinements

App:

- [ ] **Empty selection on Analyze.** Filters that match nothing (or a reversed year range, which
      the selectors allow) show "0 unit-years" over empty charts with −1…6 axes; Compare groups
      says "None has no CO₂ mass value" and shows an empty tests table. Show one message with
      "Clear filters" in place of the tab, disable its downloads, and stop or explain a reversed
      year range.
- [ ] **Impossible What-if inputs.** A scenario change below −100 % or a sensitivity range below 0
      gives negative heat input or load; the models return 0 t with only the out-of-range
      warning. Say the value is impossible (as #8 does for the step).
- [ ] **Scenario tooltips show the inputs** (§6.4: "input values, predictions, absolute and
      percentage changes"): e.g. "heat input 25,064,832 MMBtu (−5 %)".
- [ ] **"High efficiency" follows the heat-input field.** With a positive heat-input change it
      raises fuel use; use the field's value only when it is negative, or a fixed −5 %, and say
      which.
- [ ] **Model predictions export (§7).** The Predicted-vs-actual download holds the 3,000-point
      plot sample for one model; export all 7,755 test unit-years with each model's prediction.
- [ ] **`facilities.getFacility` returns `undefined`** for an unknown ID (e.g.
      `/predict?facility=99999999`): the dialog says "No facility", but React Query logs an error
      and the dev overlay shows "1 Issue". Return `null`.

Report and repository:

- [ ] **Citations (report Organization, 3 pts).** CAMPD is only a URL in §References; add it to
      `report/shared/refs.bib` and cite it in §Data and Methods. Also cite pandas, NumPy,
      Next.js/React, and SQLite (`gaffney2022sqlite` exists).
- [ ] **Issues for the work above** (1.2 "issues and documentation"), assigned to who does it;
      reassign #8–#10 to Raaj, who did them.
- [ ] Re-take any figure whose view changes (sensitivity after the reference line), rebuild the
      PDF, and re-check the report against the app.
- [ ] Proofread on paper (34 pages). 🧪

Checks:

- [ ] Hosted build after the merge: charts, ZIP downloads, Upload refuses writes. 🧪
- [ ] ZIP downloads in Safari (Chrome checked 11/12; #10's delayed revoke is untested there). 🧪

## P3 — optional

- [ ] OVAT over a categorical input (fuel, a control flag) as a bar chart.
- [ ] TRACI impacts of the predicted NOₓ on What-if (§6.4, optional).
- [ ] Residual plot on the Models tab; display CAS numbers with dashes.

---

## Weekly meetings (rubric 1.1, 12 pts)

Each meeting: show working progress live, explain one decision and one problem, give next week's
plan. Both members attend and speak.

| Week | Milestone (spec §10)              | What to show                                            |
| :--- | :-------------------------------- | :------------------------------------------------------ |
| 1    | Analytical data layer             | Overview tab, derived indicators, TRACI import          |
| 2    | Descriptive and TRACI analysis    | Distribution, Compare groups, TRACI impacts             |
| 3    | Interactive visualization         | The 11/11 restructure; shared search; Phase 1 ↔ 2 links |
| 4    | Prediction models                 | Models tab with intervals; persistence beats the models |
| 5    | Sensitivity and scenario analysis | What-if (Ridge vs tree on SCR); input messages          |
| 6    | Integration, testing, final       | Slides, rehearsed demo, final report PDF                |

---

## Final — presentation and demo (§12.5) · start only when asked

- [ ] (#15) Slides in `report/phase2/slides/`: question → architecture (and why not Flask) →
      features → models vs baseline → sensitivity/scenario → limitations → contributions.
- [ ] `report/phase2/slides/slides-outline.md`: demo script with steps, inputs, expected numbers,
      and timings, covering each §12.5 item:
  - [ ] The analytical question (Q1–Q4).
  - [ ] Build a dataset (filters or a description search), show statistics (Distribution).
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel on Overview (crossings 2023/2025);
        NOₓ-rate box plot by fuel on Distribution; backup: Pearson vs Spearman on Relationships.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline (Models tab), the intervals, and the persistence result.
  - [ ] What-if for Ghent unit 2 with Both: sensitivity curve + scenarios with an out-of-range
        warning.
  - [ ] Limitations.
- [ ] One sentence per chart type on what it shows and why it fits (rubric: "explain what each
      visualization shows and why it is appropriate").
- [ ] Both members speak and can answer: why not Flask; why not last year's value; association
      vs causation; what TRACI results do not mean; who built what.
- [ ] Two timed rehearsals; pre-demo checklist (`git restore db.sqlite`, prod build, warm
      pages, network for `cdn.plot.ly` and Google Fonts).

---

## Decisions

| Decision          | Choice                                                                                  | Why                                                                           |
| :---------------- | :-------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| Compute stack     | Stats, indicators, TRACI in TS on the server; models trained in Python, replayed in TS. | Keeps pandas/sklearn, works on the read-only Vercel deploy, instant what-ifs. |
| Prediction target | Annual NOₓ mass (short tons) per unit-year, regression.                                 | Every spec scenario (+10 % load, −5 % heat input, control change) changes it. |
| Charts            | Recharts (shadcn charts) behind `ChartFrame` + `src/components/charts/`.                | Matches the shadcn UI; quieter; small; tooltips and PNG export kept, no zoom. |
| Web stack         | Next.js 16 + tRPC + Drizzle + SQLite. No Flask rewrite.                                 | Spec allows it ("React is optional"); justified in the report.                |
| Modeling years    | Tune: train 2016–2021, validate 2022–2023. Final fit 2016–2023, test 2024–2025.         | §5.4 chronological split; 2016 is the first year with a prior-year input.     |
| Analyze layout    | One tab per question, one tab level, results before controls.                           | Professor's critique (11/11); matches Explore and Map.                        |

## Risks and prepared answers

- **Persistence beats the models** (18.5 t vs tree 26.3 t): "why not just use last year?" It is
  the better forecast (Q4); the models are for responses to load, controls, and fuel, which
  persistence cannot express, and those responses are associations, not causal effects.
- **Models disagree on SCR:** the tree barely responds; Ridge cuts Ghent 2 by ~59 %. Show it
  with Both on What-if.
- **Rubric says "Flask":** the report's Architecture and Technical choices paragraphs have the
  argument (extend Phase 1 rather than rewrite it; the spec allows React).
- **Fuel and unit type are per unit, not per year** (in the report's limitations).
- **The state map needs `cdn.plot.ly`**, and the build needs Google Fonts. Check the demo network.

## Done

All spec functions (§3–§7) are on `dev`; git history and the closed issues have the detail.
Highlights: the 11/11 UI restructure after the professor's critique; persistence reference,
bootstrap intervals, and the extended tree grid (#6, #7, #14); export-metadata and What-if tests
(#11); report Q4, Figure 3, and Flask paragraph (#12, #13); What-if input messages, Spearman
0.3 s, Safari-safe downloads (#8–#10); Python 3.9 reproduces the models; dark mode and Chrome
ZIP downloads checked on every tab.
