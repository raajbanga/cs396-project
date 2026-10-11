# epaData presentation script

Script for [`epaData-slides.pptx`](epaData-slides.pptx). Slides 8–17 are the live demo.

- **How to read it:** every bullet is a sentence to say out loud, broken into short pieces. Lines in
  _italics_ are actions (clicks, typing, pointing), not lines to say.
- **Timing:** about 5:30 of slides and 7:30 of demo, 13:00 in total. Steps 4 and 9 can be skipped.
- **Numbers** assume a fresh `db.sqlite` and the demo steps run in order.

## Before the demo (not timed)

1. Run `git restore db.sqlite` to undo any changes from rehearsals.
2. Check that `.env` contains `CAMPD_API`.
3. Start the production server, which has no loading delays: `npm run build && npm start`.
4. Open <http://localhost:3000> and visit every page once (Explore and its three tabs, Map, Retrieve,
   Upload, Download), so the first live click is quick.
5. Test the EPA connection: on Retrieve, enter State KY, Facility IDs `6071`, 2023 to 2023, and click
   **Preview year from the EPA**. It should show 8 Unchanged. Then click **Cancel**.
6. Have `samples/annual-emissions-sample.csv` open in Finder, ready to drag.
7. Zoom the browser to about 110 % so the back of the room can read the tables.

## Introduction

### 1. Title — Raaj + Arnav (0:15)

_Both stand; Raaj speaks._

- Hi everyone, we're Raaj Banga and Arnav Bawankule, and our project is called epaData.
- epaData collects emissions data about U.S. power plants from the EPA.
  - It checks that data for errors and stores it in a database.
  - The database is SQLite, which keeps everything in a single file.
- Once the data is stored, you can search it, compare plants, and download the results.
- We'll spend about five minutes on how it's designed and seven minutes on a live demo.
  - After that, we'll cover the challenges we hit and who built what.

### 2. EPA emissions data is authoritative but hard to use — Arnav (0:40)

- Every large power plant in the U.S. reports to the EPA how much fuel it burns, how much electricity
  it makes, and how much it emits.
  - The emissions we track are carbon dioxide (CO₂), sulfur dioxide (SO₂), and nitrogen oxides (NOₓ).
- The EPA publishes all of this in a database called CAMPD, the Clean Air Markets Program Data.
  - Programs can download it through the EPA's web service, the CAM API.
- The data is reliable, but answering even a simple question with it takes real work.
  - For example: which Kentucky coal units emitted more than 500,000 tons of CO₂ in 2025?
  - The API only hands back raw yearly records, so you still have to filter them by fuel and compare
    each one against 500,000 yourself.
  - And if you want several years, you have to make a separate API call for each year.
- People also share this data as spreadsheets, and there's no easy way to check those for mistakes.
  - Typical problems are missing values, negative numbers, and the same record appearing twice.
- Once data from different sources gets mixed together, nobody can tell where a number came from.
- Before we go on, two terms we'll use a lot.
  - A facility is a power plant, and a unit is one boiler or turbine inside that plant.
  - A unit-year is one unit's totals for one year, and it's the main record in our database.
- Right now, epaData holds 1,619 facilities, 5,204 units, and 50,947 unit-years, from 2015 to 2026.
  - _Point at the figures under the home page title._
  - It also has 6,909 audit flags, which are records our quality checks marked as suspicious.

## System design

### 3. One Next.js app, one SQLite file — Raaj (0:50)

- epaData is built as a single Next.js application.
  - Next.js is a web framework where the web pages and the server code live in the same project.
  - The pages themselves are built with React, a library for building user interfaces.
- When you open a page, the server sends it already filled in with data.
- After that, every search calls a function on the server through a tool called tRPC.
  - tRPC lets the browser call server functions directly, and it checks that both sides agree on the
    data types.
  - There are 17 of these server functions in total.
- Before any input reaches the database, it's checked with a library called Zod.
  - Zod rejects anything that doesn't match the shape we declared, such as a year that isn't a
    number.
- File uploads and CSV downloads go through two ordinary web routes instead.
- All database access goes through Drizzle, which talks to our one SQLite file.
  - Drizzle is an ORM: we write our queries in TypeScript, and it generates the SQL for us.
- Only two kinds of requests ever leave our server.
  - Uploaded files are handed to a Python program that parses them.
  - Retrievals go out to the EPA's API.
  - There's also an optional third one, OpenRouter, a service for calling AI language models, which
    is why it's drawn with a dashed line.
- All API keys stay on the server, so the browser never talks to the EPA or OpenRouter directly.

### 4. Two ways in, one write path, approval first — Raaj (0:40)

- There are two ways to get data into epaData.
  - You can retrieve it from the EPA's API, or you can upload a CSV or Excel file.
  - There's also a command-line script for loading data in bulk, and that one skips the approval
    step.
- Both ways check every single row before anything else happens.
  - API rows are checked with Zod, and uploaded files are checked by the Python parser.
  - Both also remove repeated rows for the same unit and year.
- Next, each incoming record is compared with what's already in the database.
  - The result tells you how many records are new, how many changed, and how many are unchanged.
  - You'll see this comparison in step 3 of the demo.
- Nothing is saved until the user looks at that comparison and approves it.
- Once approved, one shared piece of code saves everything.
  - It adds new records and updates existing ones, which is called an upsert.
  - It calculates the heat rate, meaning how much fuel was burned per megawatt-hour, and the CO₂
    intensity, meaning how many pounds of CO₂ were emitted per megawatt-hour.
  - It runs our quality checks and records which import the data came from, which we call a
    dataset.
  - And it does all of this in one transaction, so either every write succeeds or none of them do.
- Rows that were rejected or duplicated are kept in their own table, so nothing disappears silently.
- When you browse the site, you're only reading our own database.
  - The only features that call the EPA live are Retrieve and the detailed time series.
  - _Point at the two source labels at the bottom of the slide._

### 5. Six tables follow the shape of the data — Raaj (0:40)

- Our tables mirror how the data is actually organized.
  - A facility has several units, and each unit has one record per year.
  - Each facility is identified by the EPA's own plant number, called the ORISPL code, and that same
    number appears in our URLs.
- Two of the tables track where the data came from.
  - The datasets table has one row for every retrieval or upload.
  - The import_issues table keeps every rejected or duplicate row exactly as it arrived.
  - The sixth table, data_audit_logs, holds the quality flags.
- Each unit can only have one record per year.
  - So if you import the same year again, the existing record is updated instead of copied.
- When a value is missing, we store it as empty, not as zero.
  - That's because "not reported" and "measured zero" mean very different things.
- Pollution controls and program memberships are stored separately for each year, as the
  specification asks.
- We also added indexes for the searches people actually run.
  - An index is a lookup structure that saves the database from scanning every row.
  - One index alone brought the per-state ranking down from 9.5 seconds to 22 milliseconds.

### 6. Implementation choices and why — Raaj (0:40)

- The course suggests Flask, but we chose Next.js, tRPC, and Drizzle.
  - Flask is a Python web framework that's usually paired with the SQLAlchemy ORM.
  - Our stack meets the same goals, with routes, pages, forms, and an ORM, and it also checks data
    types from the database all the way to the page.
- We chose SQLite because the whole database is one file that ships with our submission.
  - It also supports the ranking query you'll see on slide 14.
- File parsing is written in Python because Python reads CSV and Excel files the same way.
  - Excel files are read with a library called openpyxl.
  - The parser returns a complete validation report, and this import feature is Arnav's work.
- Our description search relies on rules first, not AI.
  - That means it works offline, gives the same answer every time, and is covered by unit tests.
  - An AI model is only used as an optional backup for words the rules don't understand.
- Retrieval always shows a preview before it saves anything.
  - So you see the differences first, and a failed download never leaves half the data saved.

## Live demo

### 7. Ten steps, one story — Arnav (0:15)

- Our demo has ten steps, and each one matches an item on the rubric.
  - Whoever built a feature will be the one presenting it.
- The steps also tell one connected story.
  - In step 2, we upload a sample file in which we deliberately changed one CO₂ value for Trimble
    County.
  - In step 3, we compare against the EPA's API, which catches that change and restores the EPA's
    original value.
- If we run short on time, we'll skip steps 4 and 9.

_Switch to the browser. If the network is down, see "If something goes wrong" at the end._

### 8. Home page: what it is and where data comes from — Arnav (0:40)

- This is the home page, and the introduction explains what epaData does and where its data comes
  from.
  - The data comes from two places: the EPA's CAMPD API, and CSV or Excel files that users upload.
  - Scoring the environmental impact with the EPA's TRACI method is Phase 2, so it isn't part of
    this project yet.
- This chart shows how many unit-years we have for each year from 2015 to 2026.
  - _Hover over a bar to show its count._
  - Below it, you can see we have 12 active datasets from the EPA API and 18 superseded ones.
  - A superseded dataset is an older retrieval that a newer one replaced, and we keep it as history.
- In total, we hold 1,619 facilities, 5,204 units, 50,947 unit-years, and 6,909 quality flags.
- Everything you browse comes from our local database, and only Retrieve and the time series call the
  EPA live.
  - _Say this clearly: it's the rubric's "data source explanation."_
  - Each panel on the site is labelled with where its data comes from.
- The menu follows the workflow: first you explore the data, then you bring data in or take it out.
  - Explore and Map are for looking at data, and Retrieve, Upload, and Download are for moving it.
  - _Click Upload to start step 2._

### 9. Upload: validate first, then import — Arnav (1:30)

- The Upload page accepts CSV and Excel files up to 100 megabytes.
  - _Drag samples/annual-emissions-sample.csv in from Finder._
- First, the parser matches the column names in the file to the columns in our database.
  - Five columns are ignored: stack IDs, an operating-time count, and three rates that we calculate
    ourselves.
  - _If asked, open the Columns tab._
- The summary shows the file had 25 rows: 21 valid, 3 rejected, 1 duplicate, and 1 flagged.
- Compared with the database, 19 of the records are new, 1 is changed, and 1 is unchanged.
  - The two Trimble County 2023 rows are already in the database, and one of them will update its
    CO₂ value.
- Every rejected row comes with a reason.
  - Row 12 has no unit ID, row 18 has the state "KZ", which doesn't exist, and row 19 has a
    negative CO₂ value.
  - Row 25 is a duplicate of row 4, which is Ghent unit 1 in 2014.
- Row 16 reports fuel burned but no CO₂, and that actually comes from real EPA data.
  - That unit, Robert Reid RT, burned 38,801.9 MMBtu of fuel, which means million British thermal
    units.
  - We store its CO₂ as "not reported", not as zero, and flag it with a warning.
- When we approve, the 21 valid records are imported.
  - _Click "Approve and import 21 records"._
  - The confirmation shows the new dataset and where the original file was saved.
- We can also download the rejected rows, so nothing is ever lost.
  - _Click "Download rejected rows (4)"._
  - That file has the 3 rejected rows, the duplicate, and the flagged record, each with its original
    columns.

### 10. Retrieve: compare with the EPA API before saving — Raaj (1:15)

- The Retrieve page pulls annual emissions straight from the EPA's API.
  - The EPA reports these as apportioned emissions, which means that when several units share one
    smokestack, the EPA splits the emissions between them.
  - The API key stays on our server the whole time.
- Let's ask for Trimble County in 2023.
  - _Enter State KY, Facility IDs 6071, From 2023, To 2023._
- Before fetching anything, the page shows what we already have: 8 unit-years for 2023.
  - Two of those came from the upload we just did, and six came from the EPA API.
- The preview downloads the data from the EPA without saving anything.
  - _Click "Preview year from the EPA"._
  - We received 8 records: none are new, 1 changed, 7 are unchanged, and none were dropped.
- The Changed tab catches exactly the value our upload edited.
  - For Trimble County unit 2, our database now says 4,098,943.863 tons of CO₂, but the EPA says
    4,099,943.863, which is 1,000 tons more.
  - The EPA still has the original number, and that's the point of this whole story.
- When we approve, the EPA's value is saved and the retrieval is logged.
  - _Click "Approve and save year (1 new or changed)"._
  - The result confirms 1 changed and 7 unchanged.
  - And the past-retrievals table now has a new row recording exactly what we searched for.

### 11. Basic search: name, filters, sort, page — Arnav (0:30)

- On the Explore page, you can search by plant name, owner, or county.
  - _Facilities tab: type Ghent and click Search._
  - That finds exactly one facility.
- The dropdowns narrow the list down.
  - _Clear the search with the ✕, then set State to KY._
  - Kentucky has 28 facilities.
- You can click any column header to sort, and use the footer to change pages.
  - _Show the page size and go-to-page controls. Skip this step if running long._
- The paging happens on the server, so the row count and the page you see always agree.

### 12. Multi-constraint search across three tables — Raaj (0:40)

- Now let's answer the question from the beginning: which Kentucky coal units emitted more than
  500,000 tons of CO₂ in 2025?
  - _Click Clear filters and switch to the Unit-years tab._
  - _Set State to KY, Fuel to Coal, and Year to 2025._
  - _Open Advanced, type 500000 as the CO₂ minimum, and click ≥ to switch it to >._
  - We switched it to "greater than" because the question says "more than."
- The answer is 25 unit-years.
  - _Switch to the Facilities tab._
  - With the same filters, that's 8 plants.
- This one search combines conditions from three different tables.
  - The state belongs to the facility, the fuel belongs to the unit, and the year and CO₂ belong to
    the yearly record.
- The whole search is saved in the URL.
  - _Point at the address bar:
    /explore?tab=units&stateCode=KY&primaryFuel=Coal&year=2025&co2MassTonsMin=500000&co2MassTonsMinStrict=1_
  - That means you can bookmark it or share it, and the CSV download reads the same URL.
- If asked: the fuel and control filters match part of the text, because the EPA stores combined
  values like "Coal, Pipeline Natural Gas."

### 13. Description search: a sentence becomes filters — Raaj (0:40)

- The same search box also understands plain English.
  - _Click Clear filters, then under the box click the example "coal units in Kentucky with high
    CO2" and click Search._
- The sentence is turned into filter chips: Kentucky, Coal, and CO₂ of at least 2,780,000 tons.
  - The results are sorted by CO₂, and there are 99 unit-years.
  - The word "parser" next to the chips means our rules understood everything, so no AI was needed.
  - _Without the upload from step 2, it would be 2,720,000 tons and 97 unit-years._
- "High" isn't a fixed number, so we define it as the top quarter.
  - The threshold is the 75th percentile, meaning 75% of the matching records are below it.
  - It's measured only among Kentucky coal units, the other filters in the sentence.
  - The note under the chips explains this rule to the user.
- The parser always looks for the longest phrase it recognizes.
  - So "natural gas" wins over just "gas", and the order of the words doesn't matter.
  - It also forgives small typos like "Kentuky" and lists any words it didn't understand.
- Each chip is a normal filter that you can remove or change.
  - _Click ✕ on Coal, then set Fuel back to Coal._
  - The first row is Paradise unit 3 in 2014, which came from our upload.

### 14. Ranking with one window function — Raaj (0:30)

- You can also ask for rankings in a sentence.
  - _Click Clear filters and switch to the Facilities tab._
  - _Type "top CO2-emitting facility in each state in 2024" and click Search._
- The result is 51 plants: the biggest CO₂ emitter in each state.
  - The chips show Year 2024 and "First 1 per state", and the same controls are under Advanced.
  - Kentucky's top emitter is Ghent, which is on page 2 at 10 rows per page.
- In SQL, this ranking is a single window function.
  - A window function numbers rows within groups, without merging the rows together.
  - ROW_NUMBER counts 1, 2, 3, and PARTITION BY state restarts that count for every state.
  - Then we keep only rank 1.
  - _Point at PARTITION BY on the slide._
- The table, the total count, and the CSV download all come from this same query.
  - Missing values are always sorted last.

### 15. Unit detail: thirteen years of history — Arnav (0:30)

- You can open any unit to see its full history.
  - _Click Clear filters, go to Unit-years, type Ghent, click Search, and click a Ghent Unit 1
    row._
- The details show what the unit is, what fuel it burns, and its pollution controls in each year.
  - A pollution control is equipment like a scrubber, which removes SO₂ from the exhaust.
  - The URL ends with ?unit=…, so the same details reopen after a reload.
- It lists 13 years of records, from 2014 to 2026.
  - The 2014 record came from our upload, and the rest came from the EPA API.
  - This covers the specification's example of looking up the same unit from 2015 to 2025.
- If the unit has any quality flags, they're listed at the bottom.

### 16. Compare plants side by side — Arnav (0:30)

- You can also pick plants and compare them.
  - _On Facilities, search Ghent and tick it, then search Paradise and tick it._
  - _Click Compare in the dock that appears._
- Their capacity, electricity, CO₂, carbon intensity, and pollution controls appear side by side.
- Paradise is much cleaner than Ghent.
  - Paradise emits 861 pounds of CO₂ per megawatt-hour, compared with 1,929 for Ghent.
  - That's because Paradise's current units burn natural gas.
- You can compare up to four plants at a time.
  - _Optional: tick three more, and the dock says "Up to 4; remove one first." Skip if running
    long._

### 17. Download: every record traces to its source — Raaj (0:45)

- Any search result can be downloaded as a CSV file.
  - _For example, rerun step 5's search and click Download CSV next to the result count._
  - The file includes every matching row, not just the page you're looking at.
- The Download page offers six kinds of file.
  - _Click More options next to Download CSV; it opens with the current search._
  - You can download the complete dataset, only the valid records, only the invalid records, search
    results, a selection, or the provenance.
- The invalid-records file reproduces the upload report from step 2.
  - _Pick Invalid records, choose the "… CSV upload …" dataset, and click Download CSV._
  - _Note: the newest dataset is now step 3's retrieval, so pick the upload explicitly._
  - It contains the rejected rows, the duplicate, and the flagged record.
- The provenance file lists every import we've ever done.
  - Provenance means where each record came from.
  - _Click the example "provenance of every dataset" and click Download CSV._
  - For each import, it shows the source, the date, the search used, and how many records were new,
    updated, unchanged, or dropped.
- So every record in epaData can be traced back to the retrieval or file that wrote it.
  - _Stay up front; Raaj presents the challenges next._

## Wrap-up

### 18. Technical challenges — Raaj (0:50)

- Our first challenge was that combined values broke our filters.
  - The EPA's list of fuels says "Coal", but many units store something like "Coal, Pipeline
    Natural Gas."
  - We fixed it by splitting those values into separate options and matching part of the text.
- The second was learning that missing is not the same as zero.
  - At first we saved blank values as 0, and that created 6,105 false errors.
  - Now we store them as "not reported" and give them their own warning.
- The third was that re-downloading data left old datasets with no records.
  - Deleting them would have erased our history, so we keep them and mark them as superseded.
- The fourth was that our database library generated the wrong SQL.
  - A column named "id" matched the wrong table, so we now name the table explicitly.
  - The lesson was to always check the SQL that an ORM writes for you.
- The fifth was that "IN" and "OR" are state codes but also ordinary English words.
  - So two-letter state codes only count when they're typed in capitals.
- And finally, one kind of search was slow.
  - Rankings filtered by year took up to 10 seconds.
  - An index on facility and year brought that down to 22 milliseconds.

### 19. Who built what — Arnav (0:30)

- Raaj led the backend.
  - He designed the database and its indexes.
  - He built the EPA retrieval with its preview and comparison, the shared save path, the quality
    checks, and the source tracking.
  - He also built the search, including description search, and the CSV export.
  - On top of that, he did most of the Explore page, the map, the details dialog, the tests, the
    README, and the report.
- Arnav led the frontend and built the CSV and Excel import.
  - That includes the Python parser and its validation, the data-quality report, and the upload page
    with its preview and approval.
- We shared the integration testing, the sample data, and the documentation.
  - And each of us presented the parts we built.

### 20. Questions? — Raaj + Arnav (0:10)

- Phase 2 will build directly on this work.
  - It adds the EPA's TRACI impact factors, environmental indicators calculated from the stored
    records, and a weighted scoring model.
  - The same searches and CSV downloads will serve those indicators.
- Anyone can set up the project by following our README.
  - You install it, set up the database, and run it, and the database and sample files are included.
- Thank you for listening, and we're happy to take any questions.
  - _Likely questions: why not Flask (slide 6), whether the AI is safe (slide 13), and missing versus
    zero (slide 18)._

## If something goes wrong

- **No network:** everything works except Retrieve, the time series, and the flat map's background
  tiles.
  - On slide 10, open Retrieve only to show the past-retrievals table.
  - Explain the preview using the slide; the upload on slide 9 still shows "1 changed".
- **The Retrieve preview fails** because the EPA API is down or rate-limited: do the same as above.
  - The preview saves nothing, so the database is unaffected.
- **The numbers don't match these notes:** a rehearsal changed the database.
  - Stop the server, run `git restore db.sqlite`, and start it again.
- **A page is slow the first time it opens:** you're running `npm run dev`; use
  `npm run build && npm start` instead.

## After the demo

- Run `git restore db.sqlite` to bring back the committed data.
- Uploaded files are copied into `uploads/`, which isn't committed, so you can delete them.
