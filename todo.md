# epaData Phase 2 — tracker

**Due: Sunday 11/29/2026** (code, updated report, slides, live demo).
Spec: [`report/spec/phase2instr.pdf`](report/spec/phase2instr.pdf) · Rubric:
[`report/spec/phase2rubric.pdf`](report/spec/phase2rubric.pdf) · Report:
[`report/phase2/phase2-report.tex`](report/phase2/phase2-report.tex).

**The product is finished** (11/14): every spec function (§3–§7) is built, tested (108 TS + 10
Python tests), checked from a fresh clone of the README, merged to `master`, and deployed. No
open issues. What remains is the report, then the presentation.

Legend: `[ ]` todo · `[x]` done · 🧪 needs a person. Put initials on a task when you pick it up
(`— RB` / `— AB`). Commit under your own git identity (rubric 1.2 counts authors, so **Arnav
authors his share**), steadily through W47 and W48.

---

## 1. Report

- [ ] Re-take every figure (`report/phase2/figures/p2-*.jpg`): all charts changed in the
      Recharts move; add the new ones (R² chart, error by fuel, category sensitivity, scenario
      impacts). Rebuild the PDF; re-check every number against the app.
- [ ] Replace the 11 Plotly mentions in `phase2-report.tex` (charts are Recharts + D3; zoom is
      drag-to-zoom on scatter and line charts).
- [ ] Citations: add CAMPD to `report/shared/refs.bib` and cite it in Data and Methods; cite
      pandas, NumPy, scikit-learn, Next.js/React, Recharts, and SQLite (`gaffney2022sqlite`
      exists).
- [ ] Describe the 11/13–11/14 changes: plain-language readings, filter chips, short numbers,
      glossary, missing-value reasons and the idle-unit default, empty/backwards selections,
      impossible What-if inputs, category sensitivity, error by fuel, R² chart, scenario
      tooltips and TRACI impacts, all-test-predictions export, zoom.
- [ ] Limitations: fuel and unit type are per unit, not per year; CO₂ is missing for NOₓ-only
      programs; persistence beats the models; model responses are associations.
- [ ] Proofread on paper. 🧪

## 2. Presentation and demo (§12.5)

- [ ] Slides in `report/phase2/slides/`: question → architecture (and why not Flask) →
      features → models vs baseline → sensitivity/scenario → limitations → contributions.
- [ ] Demo script in `report/phase2/slides/slides-outline.md` with steps, inputs, expected
      numbers, and timings:
  - [ ] The analytical question (Q1–Q4).
  - [ ] Build a dataset (filters or a description search) and show statistics (Distribution);
        point at the missing-value reasons in Data quality.
  - [ ] Interpret ≥ 2 visualizations: CO₂ trend by fuel on Overview (crossings 2023/2025);
        NOₓ-rate box plot by fuel on Distribution; backup: Pearson vs Spearman.
  - [ ] TRACI impacts for Ghent 2024 (matches the worked example).
  - [ ] Models vs baseline, the intervals, error by fuel, and the persistence result.
  - [ ] What-if for Ghent unit 2 with Both: sensitivity curve, fuel as bars, scenarios with
        impacts, out-of-range warning.
  - [ ] Limitations.
- [ ] One sentence per chart type on what it shows and why it fits.
- [ ] Both members speak and can answer the questions below.
- [ ] Two timed rehearsals; pre-demo checklist (`git restore db.sqlite`, prod build, warm pages,
      network for CARTO map tiles and Google Fonts; if the demo runs in Safari, download one
      chart ZIP first, since #10's fix was only checked in Chrome).

### Prepared answers

- **Why not just use last year's value?** Persistence beats the models (18.5 t vs tree 26.3 t).
  It is the better forecast (Q4); the models are for responses to load, controls, and fuel,
  which persistence cannot express, and those responses are associations, not causal effects.
- **Why do the models disagree?** On SCR and fuel the tree barely responds (it splits on heat
  input and last year's rate); Ridge cuts Ghent 2 by ~59 % (SCR) and ~69 % (gas). The What-if
  readings say so.
- **Why not Flask?** Extend Phase 1 rather than rewrite it; the spec allows React; Python still
  trains the models (report: Architecture, Technical choices).
- **Why so many missing values?** EPA reporting gaps, not errors: units that didn't run,
  NOₓ-only programs without CO₂, steam-only units without MWh, no previous year. Never counted
  as 0.
- **What TRACI results don't mean:** potential impacts for comparison, not measured harm.
- **Who built what.**

## Weekly meetings (rubric 1.1, 12 pts)

Each meeting: show working progress live, explain one decision and one problem, give next week's
plan. Both members attend and speak.

| Week | Milestone (spec §10)              | What to show                                           |
| :--- | :-------------------------------- | :----------------------------------------------------- |
| 5    | Sensitivity and scenario analysis | What-if: curves, category bars, scenarios with impacts |
| 6    | Integration, testing, final       | Slides, rehearsed demo, final report PDF               |
