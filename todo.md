# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, live demo).
Spec: [`report/spec/phase2instr.pdf`](report/spec/phase2instr.pdf) · Rubric:
[`report/spec/phase2rubric.pdf`](report/spec/phase2rubric.pdf) · Report:
[`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex).

**Order of work:** finish the product against the spec first (§1–§3 below), then the report (§5),
then the presentation (§6).

Legend: `[ ]` todo · `[x]` done · 🧪 needs a person or a local machine. Put initials on a task
when you pick it up (`— RB` / `— AB`). Each item names the spec section it serves.

Workflow: commit to `dev` under your own git identity (short subject, bullet body,
`Co-authored-by` trailer), push, and merge `dev` into `master` when it should go live. Put
`Fixes #…` in the merge or squash message so issues close, then bring `dev` back level with
`master`.

---

## Status (11/13)

Every spec function (§3–§7) is built, tested (98 tests), and live: `master` deployed 11/13 with
the Recharts charts, the filter-chip search, plain-language readings, and the phone-layout fixes.
History was regrouped into 28 feature commits on 11/13 (same final tree).

What's left in the product is a few spec details (§6.4 tooltips, §7 predictions export and
pipeline version), robustness for empty or impossible inputs, and the last explanation gap.

---

## 1. Product: spec gaps

- [ ] **Scenario tooltips show inputs and absolute change** (§6.4: "labels or tooltips showing
      input values, predictions, absolute changes, and percentage changes"). They show the
      prediction and % change only. Add the changed input ("heat input 25.1M MMBtu, −5 %") and
      the change in tons. Check the sensitivity curve's tooltip has the same four.
- [ ] **Export every model's test predictions** (§7: "model evaluation results and
      predictions"). Predicted-vs-actual downloads the 3,000-point plot sample for one model;
      export all 7,755 test unit-years with each model's prediction and the error.
- [ ] **Update `pipeline_version` in the model metadata** (§7 "software or pipeline version";
      #14), so exports name the pipeline that trained the models.
- [ ] **Plain-language definitions inside sentences and subtitles** (§1.9 "explain methods,
      assumptions, results, and limitations clearly"; §4.5 "assumptions and conclusions in plain
      language"). Table headers already explain MAE, R², IQR, MAPE… on hover
      (`src/lib/glossary.ts`). Still undefined where they appear in text: log scale,
      Pearson/Spearman, kg CO₂ eq, standardized coefficient, α, tree depth/leaves, bootstrap
      interval, ablation, and the Box plot / Log / "% of baseline" toggles.

## 2. Product: robustness

- [ ] **Empty selection on Analyze.** Filters that match nothing (or a reversed year range,
      which the selectors allow) show "0 unit-years" over empty charts; Compare says "None has no
      CO₂ mass value". Show one message with "Clear filters" instead of the tab, disable its
      downloads, and block or explain a reversed range.
- [ ] **Impossible What-if inputs.** A scenario change below −100 % or a sensitivity range below 0
      gives negative heat input or load, and the models return 0 t with only the out-of-range
      warning. Say the value is impossible (as #8 does for the step).
- [ ] **"High efficiency" scenario follows the heat-input field**, so a positive heat-input change
      raises fuel use. Use the field only when it is negative (or a fixed −5 %) and say which.
- [ ] **`facilities.getFacility` returns `undefined`** for an unknown ID
      (`/predict?facility=99999999`); React Query logs an error. Return `null`.

## 3. Product: optional (only if time allows)

- [ ] OVAT over a categorical input (fuel, a control flag) as a bar chart (§6.2).
- [ ] TRACI impacts of the predicted NOₓ on What-if (§6.4 "or impact indicators").
- [ ] Residual plot on the Models tab.
- [ ] Chart zoom (§4.4 lists it as a reason Plotly is recommended; not a requirement).

## 4. Checks and repository

- [ ] **Close issues #6–#14.** Done in code (persistence #6, tree grid #7, step message #8,
      Spearman #9, Safari revoke #10, tests #11, report #12/#13); #14 stays open until §1 is done.
      The 11/13 squash had no `Fixes` lines.
- [ ] **Commit steadily in W47 and W48, both members** (rubric 1.2 history, 3 pts). Since the
      11/13 history regroup every commit is authored by Raaj with Arnav as co-author, and
      GitHub's contributor graph counts authors only, so **Arnav should author** his share of
      the remaining items.
- [ ] Hosted build: charts, ZIP downloads, Upload refuses writes. 🧪
- [ ] ZIP downloads in Safari (#10's delayed revoke untested there). 🧪

## 5. Report (after the product)

- [ ] Re-take every figure: all charts changed in the Recharts move (sensitivity also has the
      baseline-prediction lines now). Rebuild the PDF; re-check numbers against the app.
- [ ] Citations: add CAMPD to `report/shared/refs.bib` and cite it in Data and Methods; cite
      pandas, NumPy, Next.js/React, and SQLite (`gaffney2022sqlite` exists).
- [ ] Describe the 11/13 changes: plain-language readings, filter chips, short numbers, glossary.
- [ ] Proofread on paper. 🧪

## 6. Presentation and demo (last; §12.5)

- [ ] (#15) Slides in `report/phase2/slides/`: question → architecture (and why not Flask) →
      features → models vs baseline → sensitivity/scenario → limitations → contributions.
- [ ] Demo script in `report/phase2/slides/slides-outline.md` with steps, inputs, expected
      numbers, and timings:
  - [ ] The analytical question (Q1–Q4).
  - [ ] Build a dataset (filters or a description search) and show statistics (Distribution).
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel on Overview (crossings 2023/2025);
        NOₓ-rate box plot by fuel on Distribution; backup: Pearson vs Spearman.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline, the intervals, and the persistence result.
  - [ ] What-if for Ghent unit 2 with Both: sensitivity curve, scenarios, out-of-range warning.
  - [ ] Limitations.
- [ ] One sentence per chart type on what it shows and why it fits.
- [ ] Both members speak and can answer: why not Flask; why not last year's value; association
      vs causation; what TRACI results do not mean; who built what.
- [ ] Two timed rehearsals; pre-demo checklist (`git restore db.sqlite`, prod build, warm pages,
      network for CARTO map tiles and Google Fonts).

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
| 5    | Sensitivity and scenario analysis | What-if (Ridge vs tree on SCR); readings; §1 fixes      |
| 6    | Integration, testing, final       | Slides, rehearsed demo, final report PDF                |

## Decisions

| Decision          | Choice                                                                                  | Why                                                                           |
| :---------------- | :-------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| Compute stack     | Stats, indicators, TRACI in TS on the server; models trained in Python, replayed in TS. | Keeps pandas/sklearn, works on the read-only Vercel deploy, instant what-ifs. |
| Prediction target | Annual NOₓ mass (short tons) per unit-year, regression.                                 | Every spec scenario (+10 % load, −5 % heat input, control change) changes it. |
| Charts            | Recharts (shadcn charts) behind `ChartFrame` + `src/components/charts/`.                | Matches the shadcn UI; quieter; small; tooltips and PNG export kept, no zoom. |
| Web stack         | Next.js 16 + tRPC + Drizzle + SQLite. No Flask rewrite.                                 | Spec allows it ("React is optional"); justified in the report.                |
| Modeling years    | Tune: train 2016–2021, validate 2022–2023. Final fit 2016–2023, test 2024–2025.         | §5.4 chronological split; 2016 is the first year with a prior-year input.     |
| Analyze layout    | One tab per question; plain answers first, big tables folded.                           | Professor's critique (11/11); "interpret, not only display" (rubric 2).       |
| Search            | Filter chips with "+ Filter"; State and Fuel always one click away.                     | The old Basic/Advanced panels were hard to navigate.                          |

## Risks and prepared answers

- **Persistence beats the models** (18.5 t vs tree 26.3 t): "why not just use last year?" It is
  the better forecast (Q4); the models are for responses to load, controls, and fuel, which
  persistence cannot express, and those responses are associations, not causal effects.
- **Models disagree on SCR and fuel switches:** the tree barely responds; Ridge cuts Ghent 2 by
  ~59 % (SCR) and ~69 % (gas). The What-if reading says so; show it with Both.
- **Rubric says "Flask":** the report's Architecture and Technical choices paragraphs have the
  argument (extend Phase 1 rather than rewrite it; the spec allows React).
- **Fuel and unit type are per unit, not per year** (in the report's limitations).
- **The Map page needs CARTO tiles** and the build needs Google Fonts: check the demo network.
  (The Analyze state map is local since the Recharts move.)

## Done (highlights; git history has the detail)

- 11/13: Recharts charts with the §6.4 baseline-prediction lines; filter-chip search with quick
  State/Fuel; short numbers; plain-language readings on every Analyze and Predict tab; glossary
  on table headers; persistence result on Models; TRACI and scenario readings; phone layouts.
  Merged to `master` and deployed.
- 11/13: rankings (Top N) are part of the selection on every page; NOₓ rate, heat rate, intensity
  rankings; capacity filter; Enter picks in facility pickers.
- 11/12: persistence reference, bootstrap intervals, extended tree grid (#6, #7); export and
  What-if tests (#11); report Q4, Figure 3, Flask paragraph (#12, #13); What-if input messages,
  Spearman 0.3 s, Safari-safe downloads (#8–#10).
- 11/11: UI restructure after the professor's critique; shared search on every page.
