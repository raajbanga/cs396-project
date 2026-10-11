# epaData presentation outline

Speaker notes for [`epaData-slides.pptx`](epaData-slides.pptx); the same text is in each slide's notes pane.
This file is also the demo script: slides 8–17 are the ten live-demo steps, with the exact clicks, inputs,
and expected numbers.

- **Timing:** about 5:30 of slides + 7:30 of live demo = 13:00. Steps 4 and 9 can be cut.
- **Reading this file:** top-level bullets are what to say; sub-bullets are cues. **Bold** terms are
  defined the first time they appear.
- **Speakers:** listed in each heading (and in the slide notes), not on the slides.
- **Expected numbers** assume the demo starts from the committed `db.sqlite` and the steps run in order.
  They were checked by replaying the steps on a copy of the database.

## Before the demo (not timed)

1. `git restore db.sqlite`, so the database matches the committed copy (rehearsals change it).
2. Check `.env` has `CAMPD_API`.
   - optional: `npm run sync:campd -- --year 2026` picks up a newly published EPA quarter; then re-check
     the numbers in slides 8 and 10
3. Start a production server, which has no first-visit compile delays: `npm run build && npm start`.
4. Open <http://localhost:3000>, then open each page in the navigation bar (Explore and its three tabs,
   Map, Retrieve, Upload, Download) once, so the first live click is fast.
5. Rehearsal check: Retrieve → State KY, Facility IDs `6071`, 2023 to 2023 → **Preview year from the EPA**.
   - it should list 8 Unchanged: the API key and network work
   - click **Cancel**
6. Have `samples/annual-emissions-sample.csv` visible in Finder for drag-and-drop.
7. Zoom the browser to about 110 % so tables are readable from the back of the room.

## Introduction

### 1. Title — Raaj + Arnav (0:15)

- Good afternoon. We are Raaj Banga and Arnav Bawankule.
  - both stand; Raaj opens
- This is epaData, our Phase 1 project for CS396.
- It collects EPA power-plant emissions data, checks it, and stores it in SQLite.
  - **SQLite** = a relational database kept in one file, with no separate database server
- You can then search, compare, and download that data.
  - one-sentence pitch; don't elaborate yet
- Plan: about five minutes of design, seven of live demo, then challenges and who did what.

### 2. EPA emissions data is authoritative but hard to use — Arnav (0:40)

- Power plants report their fuel use, generation, and emissions to the EPA.
  - **SO₂** = sulfur dioxide · **NOₓ** = nitrogen oxides · **CO₂** = carbon dioxide
- The EPA publishes those reports through CAMPD and its CAM API.
  - **CAMPD** = Clean Air Markets Program Data, the EPA's emissions data for power plants
  - **CAM API** = CAMPD's web interface for downloading that data in code
- The data is authoritative, but a simple question is hard to answer.
  - e.g. “Which Kentucky coal units emitted over 500,000 t of CO₂ in 2025?”
  - needs the right endpoint, a join with facility data, and a hand-applied threshold
  - and one API call per year for any history
- Spreadsheet extracts arrive with no easy way to check them.
  - missing values · negative numbers · the same unit-year twice
  - **unit** = one boiler or turbine inside a plant (a **facility**)
  - **unit-year** = one unit's totals for one year; the main record in our database
- Once sources are mixed, nobody knows which file a number came from.
- epaData stores 1,619 facilities, 5,204 units, and 50,947 unit-years from 2015 to 2026.
  - point at the figures under the home page title
  - 6,909 audit flags = records our data-quality rules marked as questionable

## System design

### 3. One Next.js app, one SQLite file — Raaj (0:50)

- epaData is one Next.js application containing both the interface and the server.
  - **Next.js** = a web framework that runs React pages and server code in one project
  - **React** = the library that builds the interface from components
  - one codebase, one process to run
- The first page arrives already rendered by the server, with its data filled in.
- After that, every search is a typed tRPC call.
  - **tRPC** = typed remote procedure calls: the browser calls server functions, and both sides share the same types
  - 17 procedures in total
- Every input is validated with Zod before it reaches the database.
  - **Zod** = a library that checks data against a declared schema and rejects anything else
- Two plain HTTP routes handle file upload and CSV export.
- All logic sits in shared server modules.
  - query builders · CAMPD client · one write path (ingest.ts) used by every import
- Every query goes through Drizzle ORM to one SQLite file.
  - **ORM** = object-relational mapper: builds SQL from TypeScript code
  - **Drizzle** = the ORM we use; it also runs the schema migrations
- Only two things leave the server process.
  - uploaded files → a Python parser
  - retrievals → the EPA CAM API
  - optional: **OpenRouter** = a gateway to hosted large language models (**LLM**s); dashed because it is optional
- API keys stay on the server; the browser never calls the EPA or OpenRouter itself.

### 4. Two ways in, one write path, approval first — Raaj (0:40)

- Data enters two ways: Retrieve and Upload.
  - Retrieve calls the EPA CAM API
  - Upload accepts CSV or Excel files in the CAMPD column layout
  - a third path, the **CLI** (command-line) script sync:campd, skips the approval step
- Both paths validate every row first.
  - API rows → Zod · files → the Python parser
  - both drop repeated facility-unit-years (**dedupe**)
- Each incoming record is then compared with what the database already holds.
  - result: new · changed · unchanged counts
  - this is the DB-vs-API preview in demo step 3
- Nothing is written until the user approves.
- On approval, one shared write path saves everything in a single transaction.
  - **upsert** = insert a record, or update it if it already exists
  - computes **heat rate** (fuel energy per MWh generated) and **CO₂ intensity** (lb of CO₂ per MWh)
  - runs the sanity audits and records a **dataset** row (one per retrieval or upload)
  - **transaction** = all writes succeed together or none do
- Rejected and duplicate rows go to import_issues, so nothing is dropped silently.
- Everything you browse reads only the local database.
  - only Retrieve and the granular time series call the API live
  - point at the two source badges at the bottom

### 5. Six tables follow the shape of the data — Raaj (0:40)

- The schema follows the real hierarchy of the data.
  - facility → units → one annual record per unit per year
  - facilities.id is the EPA **ORISPL** code: the EPA's permanent plant ID, also used in URLs
- Two tables record provenance.
  - **provenance** = where each record came from
  - datasets: one row per retrieval or upload
  - import_issues: every rejected or duplicate source row, kept verbatim
  - the sixth table, data_audit_logs, holds the sanity flags
- An annual record is unique per unit and year.
  - its id is built from that pair, so re-importing a year updates the row instead of duplicating it
  - UNIQUE(unit_internal_id, year) is also the upsert target
- Metric columns may be NULL on purpose.
  - **NULL** = no value: the source did not report one, which differs from a measured zero
- Controls and program codes are stored per year, as the spec asks.
- Indexes match the real query shapes.
  - **index** = a sorted lookup structure that lets the database skip scanning whole tables
  - adding (facility_id, year) took the per-state ranking from 9.5 s to 22 ms

### 6. Implementation choices and why — Raaj (0:40)

- The course suggests Flask; we used Next.js with tRPC and Drizzle.
  - **Flask** = a Python web framework, usually paired with Jinja templates and the SQLAlchemy ORM
  - ours covers the same objectives (routes, templates, forms, ORM) in one typed codebase
- SQLite in one file means the database ships with the submission.
  - it also supports the window functions we use for ranking (slide 14)
- File parsing runs in Python.
  - its csv and **openpyxl** (Excel reader) libraries treat CSV and Excel the same way
  - returns a full validation report as JSON · Arnav's import feature
- Description search is rule-based first.
  - works offline, gives the same answer every time, covered by unit tests
  - a language model is only an optional fallback
- Retrieval previews before it saves.
  - the user sees the differences first
  - a failed fetch never leaves half a dataset behind

## Live demo

### 7. Ten steps, one story — Arnav (0:15)

- The demo has ten steps, each mapped to a rubric row.
  - we alternate presenters by who built that part
  - switch to the browser after this slide
- The steps tell one story.
  - step 2's sample upload deliberately edits one Trimble County CO₂ value
  - step 3's Retrieve catches that difference against the EPA API and restores EPA's number
  - shows both data paths and the DB-vs-API comparison together
- Steps 4 and 9 can be cut if we run long.
  - network down? see “If something goes wrong” at the end of this outline

### 8. Home page: what it is and where data comes from — Arnav (0:40)

- The intro paragraph says what epaData does and where its data comes from.
  - sources: the EPA CAMPD API and CSV or Excel uploads
  - **TRACI** = the EPA's method for turning emissions into environmental-impact scores; that is Phase 2
- The coverage chart shows unit-years per reporting year, 2015–2026.
  - hover a column for its count
  - data sources: “EPA CAMPD API: 12 active datasets and 18 superseded”
  - **superseded** = an earlier retrieval whose records a re-sync replaced; kept as history
- The figures show 1,619 facilities, 5,204 units, 50,947 unit-years, and 6,909 data-quality flags.
- Everything you browse reads the local database; only Retrieve and the granular time series call the API live.
  - say this verbatim: it is the rubric's “data source explanation”
  - each panel is labelled with its source
- The navigation bar follows the workflow: look at the data (Explore, Map), then move it in and out
  (Retrieve, Upload, Download).
  - “What you can do” lists the same functions · then click Upload in the navigation bar → step 2

### 9. Upload: validate first, then import — Arnav (1:30)

- Upload accepts CSV and Excel files up to 100 MB.
  - click Upload in the navigation bar
  - drag in samples/annual-emissions-sample.csv (already open in Finder)
- The Python parser maps CAMPD column headers to database columns.
  - 5 columns stay unmapped: stack IDs, the operating-time count, and 3 rates epaData recomputes
  - Columns tab, if anyone asks
- Summary: 25 rows, 21 valid, 3 rejected, 1 duplicate, 1 audit flag.
- Compared with the database: 19 new, 1 changed, 1 unchanged.
  - Already in database (2): the two Trimble County 2023 rows; one “Will update co2MassTons”
- Each rejected row keeps its reason.
  - row 12: no unit ID · row 18: state “KZ” · row 19: negative CO₂
  - Duplicates in file (1): row 25 repeats row 4 (Ghent unit 1, 2014)
- Row 16 reported heat input but no CO₂, and that is real EPA data.
  - Robert Reid unit RT: 38,801.9 **MMBtu** (million British thermal units of fuel energy)
  - stored as “not reported” (NULL), not zero
  - flagged CO2_NOT_REPORTED, severity WARN
- Approve and import the 21 records.
  - click Approve and import 21 records
  - “Import complete” shows the dataset and the archived file under uploads/
- Download the rejected rows: nothing is dropped silently.
  - click Download rejected rows (4)
  - 3 rejected + 1 duplicate + the flagged record, each with its original columns

### 10. Retrieve: compare with the EPA API before saving — Raaj (1:15)

- Retrieve names its method: the EPA CAM API's apportioned annual emissions.
  - **apportioned** = the EPA splits a shared stack's emissions across the units behind it
  - the API key stays on the server
- Enter the parameters.
  - State = KY · Facility IDs = 6071 (Trimble County) · From year = 2023 · To year = 2023
- “Already in the local database” fills in on its own: 8 unit-years for 2023.
  - 2 written by the upload we just did · 6 by the EPA API
- Preview fetches from the API without writing anything.
  - click Preview year from the EPA
  - received 8 · new 0 · changed 1 · unchanged 7 · dropped 0
- The Changed tab shows the value our upload edited.
  - Trimble County unit 2 CO₂: 4,098,943.863 → 4,099,943.863
  - the API still has EPA's number: the punchline of the demo story
- Approve and save; the history gains a row.
  - click Approve and save year (1 new or changed)
  - status tiles: 0 new · 1 changed · 7 unchanged · 0 dropped
  - Past retrievals gains the row, with the exact query parameters

### 11. Basic search: name, filters, sort, page — Arnav (0:30)

- Searching by name finds plants, operators, and counties.
  - Explore · Facilities tab · type Ghent → Search → 1 facility
  - the box takes names too: text with no filter words becomes a name search
- Dropdowns filter the list.
  - clear the search (✕) · State = KY → 28 facilities
- Headers sort, and the footer pages through results.
  - page size + go-to-page control
  - optional step: cut if running long
- The server pages the results itself.
  - one ranked **subquery** (a query nested inside another) gives both the page of rows and the total count, so they always agree

### 12. Multi-constraint search across three tables — Raaj (0:40)

- Set four filters on the Unit-years tab.
  - Clear filters · Unit-years tab
  - State = KY · Fuel = Coal · Year = 2025
  - Advanced → CO₂ min = 500000 · click ≥ beside it to make it strict (>), as in “greater than”
- Result: 25 unit-years.
  - switch to Facilities: the same filters give 8 facilities
- The conditions sit on three tables, combined with AND.
  - state → facility · fuel → unit · year and CO₂ → annual record
- The whole search lives in the URL.
  - point at the address bar: /explore?tab=units&stateCode=KY&primaryFuel=Coal&year=2025&co2MassTonsMin=500000&co2MassTonsMinStrict=1
  - bookmark or share it; the CSV export parses the same URL
- Fuel and control filters match by substring.
  - CAMPD stores combined values like “Coal, Pipeline Natural Gas”
  - if asked

### 13. Description search: a sentence becomes filters — Raaj (0:40)

- The same search box turns a sentence into filters.
  - Clear filters · under the box, click Try “coal units in Kentucky with high CO2” → Search
- The sentence becomes “Interpreted as” chips: KY, Coal, and CO₂ ≥ 2,780,000.
  - sorted by CO₂ · 99 unit-years
  - “(parser; …)”: no language model was needed
  - without the upload: 2,720,000 and 97
- “High” has no fixed number, so we use a percentile.
  - **75th percentile (P75)** = the value 75% of the matching unit-years fall below
  - computed over the other filters only, here Kentucky coal
  - the note under the chips states the rule
- The parser matches the longest known phrase at each position.
  - **parser** = code that reads the sentence and maps words to filter values
  - “natural gas” beats “gas” · word order doesn't matter
  - tolerates one-letter typos (“Kentuky”) · reports what it didn't understand
- Every chip is an ordinary filter.
  - click ✕ on Coal, then set Fuel back to Coal
  - first row: Paradise unit 3 in 2014, from our upload

### 14. Ranking with one window function — Raaj (0:30)

- Ranking also works from a sentence.
  - Clear filters · Facilities tab
  - type: top CO2-emitting facility in each state in 2024 → Search
- Result: 51 facilities, one per state, sorted by CO₂.
  - chips show what was set: Year 2024 · First 1 per state (Advanced has the same controls)
  - Kentucky's row is Ghent (page 2 at 10 per page)
- In SQL this is one window function.
  - **window function** = a calculation over a group of rows that keeps every row, unlike GROUP BY
  - ROW_NUMBER() numbers the rows · PARTITION BY state restarts the numbering for each state
  - keep rank 1 · point at PARTITION BY on the slide
- The page, count, and CSV export all come from this one subquery.
  - missing values sort last

### 15. Unit detail: thirteen years of history — Arnav (0:30)

- Open a unit to see its full history.
  - Clear filters · Unit-years tab · type Ghent → Search · click a Ghent Unit 1 row
- The details dialog shows identification, fuel, and each year's controls and programs.
  - its URL (?unit=…) reopens it on reload
  - **controls** = pollution equipment, e.g. a scrubber for SO₂
- It lists 13 reporting years, 2014–2026.
  - 2014 came from our upload · the rest from CAMPD API datasets
  - covers the spec's “same unit, 2015–2025” history search
- Audit flags for the unit, if any, are listed at the bottom.

### 16. Compare plants side by side — Arnav (0:30)

- Pick plants to compare.
  - Facilities · search Ghent → tick it · search Paradise → tick it
  - click Compare in the dock
- Capacity, generation, CO₂, carbon intensity, and controls appear side by side.
- Paradise comes out cleanest.
  - 861 vs 1,929 lb/MWh (pounds of CO₂ per megawatt-hour generated)
  - its current units burn gas
- The limit is four plants.
  - optional: tick 3 more → the dock says “Up to 4; remove one first”
  - optional step: cut if running long

### 17. Download: every record traces to its source — Raaj (0:45)

- Any result can be downloaded as CSV.
  - e.g. rerun step 5's search → click Download CSV next to the result count
  - every matching row, across all pages
- The Download page offers six types, in three numbered steps.
  - More options next to Download CSV opens it with the current search
  - complete dataset · valid records · invalid records · search results · selection · provenance
- Invalid records for the upload reproduce step 2's report.
  - pick Invalid records · select the upload dataset (“… CSV upload …”; the latest dataset is now step 3's retrieval) · Download CSV
  - rejected rows + the duplicate + the flagged record
- Provenance lists every dataset.
  - Try “provenance of every dataset” · Download CSV
  - source · date · query parameters · new / updated / unchanged / dropped counts
- Close with: every record traces to the retrieval or file that wrote it.
  - stay on: Raaj presents the challenges next

## Wrap-up

### 18. Technical challenges — Raaj (0:50)

- Combined values broke our filters.
  - CAMPD lists “Coal”, but units hold “Coal, Pipeline Natural Gas”
  - fix: split the options, match by substring
- Missing is not zero.
  - the first schema stored blanks as 0 → 6,105 false errors
  - fix: nullable metrics + a separate “not reported” warning
  - lesson: model absence explicitly
- Re-syncs left old datasets owning nothing.
  - deleting them would erase history
  - fix: keep them, labelled superseded
- The ORM generated wrong SQL.
  - an unqualified id bound to the wrong table
  - fix: qualify it · lesson: read the SQL an ORM writes
- “IN” and “OR” are both state codes and English words.
  - fix: two-letter codes count only in capitals
- One query shape was slow.
  - year-filtered rankings took up to 10 s
  - fix: an index on (facility_id, year) → 22 ms

### 19. Who built what — Arnav (0:30)

- Raaj led the backend.
  - schema, migrations, indexes
  - CAMPD client with preview and diff
  - shared write path, audits, provenance
  - search backend incl. description search · CSV export
  - also most of the Explore page, map, detail dialog, pages, tests, README, report
- Arnav led the frontend and built the CSV and Excel import.
  - Python parser and validation
  - data-quality report
  - upload endpoint and page with preview and approval
- We shared the API contracts, integration testing, sample data, and documentation.
  - each of us presented the parts we built

### 20. Questions? — Raaj + Arnav (0:10)

- Phase 2 builds on this foundation.
  - TRACI factors · environmental indicators from the stored records · a weighted scoring model
  - the same ranked queries and CSV path will serve the indicators
- Everything is reproducible from the README.
  - install, migrate, run · committed database and sample files included
- Thank you; we are happy to take questions.
  - likely: why Next.js not Flask (slide 6) · LLM safety (slide 13) · missing vs zero (slide 18)

## If something goes wrong

- **No network:** everything except Retrieve, the granular time series, and the 2D map tiles works offline.
  - skip slide 10's live preview: open Retrieve only to show the past-retrievals table
  - narrate the preview from the slide; the upload in slide 9 still shows “1 changed”
- **Retrieve preview fails** (EPA API down or rate-limited): same as above.
  - the preview writes nothing, so the database is unaffected
- **Counts differ from these notes:** a rehearsal changed the database.
  - stop the server, `git restore db.sqlite`, start again
- **A page is slow on first open:** you are running `npm run dev`; use `npm run build && npm start`.

## After the demo

- `git restore db.sqlite` returns to the committed data.
- Uploaded files are archived in `uploads/`, which is not committed; delete them if you like.
