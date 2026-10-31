# report/

One folder per phase. **Phase 2 is what we're working on now** (due 11/29).

| Path                                | What it is                                           |
| :---------------------------------- | :--------------------------------------------------- |
| `spec/ProjectPhase2.pdf`            | The course's Phase 2 assignment                      |
| `phase2/phase2-report.tex`          | **Phase 2 report source** (edit this)                |
| `phase2/phase2-report.pdf`          | Phase 2 report, built by `npm run report`            |
| `phase2/figures/`                   | Phase 2 screenshots (`p2-*.jpg`)                     |
| `phase2/slides/`                    | Phase 2 deck and demo script (to be created)         |
| `phase1/phase1-report.tex` / `.pdf` | Phase 1 report as submitted. Frozen: don't edit      |
| `phase1/figures/`                   | Phase 1 screenshots                                  |
| `phase1/slides/`                    | Phase 1 deck (`epaData-slides.pptx`) and demo script |
| `shared/preamble.tex`, `refs.bib`   | LaTeX preamble and bibliography used by both reports |

Build from the repository root with `npm run report` (Phase 2) or `npm run report:phase1`.
Each report finds its own `figures/` folder.
