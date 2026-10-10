# epaData live demo script

About 7 minutes of demo inside a 10–15 minute presentation (≈ 7 min slides, ≈ 7 min demo,
1 min buffer). Steps 4 and 9 can be cut to get under 6 minutes. Each step names the rubric
row it covers, the exact input, and what should appear on screen.

The order is deliberate: the sample upload (step 2) contains one edited Trimble County
record, and the retrieval in step 3 catches that difference against the EPA API and restores
the original value. That shows both data paths and the DB-vs-API comparison in one story.

Expected numbers below assume the demo starts from the committed `db.sqlite` and the steps
run in order. They were checked by replaying the steps on a copy of the database.

## Before the demo (not timed)

1. `git restore db.sqlite` so the database matches the committed copy (rehearsals change it).
2. Check `.env` has `CAMPD_API`. Optional: `npm run sync:campd -- --year 2026` to pick up a
   newly published EPA quarter, then re-check the numbers in steps 1 and 3.
3. Run a production server, which has no first-visit compile delays:
   `npm run build && npm start`.
4. Open <http://localhost:3000>, then open each tab once (Facilities, Units, Map, Audits) and
   each header dialog once, so the first live click is fast.
5. Rehearsal check: open **Retrieve**, set State KY, Facility IDs `6071`, 2023 to 2023, click
   **Preview year**. It should list 8 Unchanged. This confirms the API key and network work.
   Click **Cancel**.
6. Have `samples/annual-emissions-sample.csv` visible in Finder for drag-and-drop.
7. Zoom the browser to about 110 % so the tables are readable from the back of the room.

## Steps

|   # | Time     | Rubric                                      | Suggested presenter |
| --: | :------- | :------------------------------------------ | :------------------ |
|   1 | 0:40     | 1 Web interface · 2 Data source explanation | Arnav               |
|   2 | 1:30     | 3 Upload & import                           | Arnav               |
|   3 | 1:15     | 2 EPA data retrieval                        | Raaj                |
|   4 | 0:30     | 4 Basic search                              | Arnav               |
|   5 | 0:40     | 5 Multi-constraint search                   | Raaj                |
|   6 | 0:40     | 6 Description search                        | Raaj                |
|   7 | 0:30     | 7 Sorting / ranking (§8.3)                  | Raaj                |
|   8 | 0:30     | 7 Detail page, historical search            | Arnav               |
|   9 | 0:30     | 1 Usability (compare)                       | Arnav               |
|  10 | 0:45     | 7 Download                                  | Raaj                |
|     | **7:20** |                                             |                     |

The presenter column follows the proposal roles (Arnav: frontend and upload, Raaj: backend,
retrieval, search). Confirm it with both team members.

### 1. Home page (0:40)

- Point at the introduction: what epaData does, the two data sources (EPA CAMPD API, CSV/Excel
  uploads), and that TRACI scoring is Phase 2.
- Point at the coverage strip: records per reporting year (2015–2026) and the datasets line,
  "CAMPD API · 12 active (+18 superseded)". Superseded = earlier retrievals replaced by a
  re-sync and kept as history.
- Point at the tiles: 1,619 facilities, 5,204 units, 6,909 audit flags.
- Say: "Everything you browse reads the local SQLite database. Only Retrieve and the
  granular time series call the EPA API live. Each panel is labeled with its source."
- Point at the numbered links: Retrieve → Upload → Search → Download.

### 2. Upload a file (1:30)

1. Click **Upload** in the header. Point out the supported formats (CSV, Excel, ≤ 100 MB).
2. Drag `samples/annual-emissions-sample.csv` onto the drop zone.
3. The report appears. Walk through it top to bottom:
   - **Schema mapping**: CAMPD headers mapped to database columns; 5 columns unmapped (stack
     IDs, operating-time count, three rates that epaData recomputes).
   - Tiles: **25** rows, **21** valid, **3** rejected, **1** duplicate, **1** audit flag.
   - Comparison with the database: **19 new, 1 changed, 1 unchanged**.
   - Rejected rows with reasons: missing Unit ID (row 12), state `KZ` (row 18), negative CO₂
     (row 19).
   - Duplicate: row 25 repeats row 4 (Ghent unit 1, 2014), listed under **Duplicates in
     file (1)**. **Already in database (2)** shows the two 2023 Trimble County rows: one
     unchanged, one "Will update co2MassTons".
   - Sanity flag: row 16, Robert Reid RT, 38,801.9 MMBtu of heat input but no CO₂ value
     (`CO2_NOT_REPORTED`, WARN). Say: "This is real EPA data, not something we planted. A
     blank is stored as 'not reported', not as zero, and the import keeps and flags it."
4. Click **Approve & Import 21 Records**. "Import complete" shows the dataset and the file
   archived under `uploads/`.
5. Click **Download rejected rows (4)**. The CSV opens with the 3 rejected rows, the
   duplicate, and the flagged record, each with the original columns. Say: "Nothing is
   dropped silently."

### 3. Retrieve from the EPA API (1:15)

1. Click **Retrieve**. Point at the method line: EPA CAM API, apportioned annual emissions.
   The key stays on the server.
2. Set **State** = KY, **Facility IDs** = `6071` (Trimble County), **From year** = 2023,
   **To year** = 2023.
3. "Already in the database" fills in: 8 unit-years stored for 2023, split by who wrote them:
   2 by the CSV upload you just did, 6 by the EPA CAMPD API.
4. Click **Preview year**. KPIs: Received **8**, New **0**, Changed **1**, Unchanged **7**,
   Dropped **0**.
5. On the **Changed** tab: Trimble County unit 2, CO₂ **4,098,943.863 → 4,099,943.863**. Say:
   "That is the value our upload changed two minutes ago. The API still has EPA's number."
6. Click **Approve & save year (1 new or changed)**. The history gains a row: New 0, Updated 1,
   Unchanged 7, Dropped 0, with its query parameters.

### 4. Basic search (0:30)

1. Close the dialog. On the **Facilities** tab, type `Ghent` in the search box → 1 facility.
2. Clear the search, set **State** = KY → the count updates. Point at the sortable headers
   and the pagination.

### 5. Multi-constraint search (0:40)

1. Click **Reset**, switch to the **Units** tab.
2. Set **State** = KY, **Fuel** = Coal, **Year** = 2025. Open **More filters**, type `500000`
   in **CO₂ min**.
3. Result: **25** unit-years. Point at the browser URL: the whole search is in it
   (`?tab=units&stateCode=KY&primaryFuel=Coal&year=2025&co2MassTonsMin=500000`), so it can be
   bookmarked or shared.
4. Switch to **Facilities**: the same filters give **8** facilities.

### 6. Description search (0:40)

1. Back on **Units**, click **Reset**, switch the search box from **Name** to **Describe**.
2. Type `Find coal units in Kentucky with high CO2 emissions.` and press Enter.
3. Chips appear: **KY · Coal · CO₂ ≥ 2,780,000**, sorted by CO₂, with the note “"high" = top
   25% of unit-years matching the other filters.” **99** unit-years. "via parser": no language
   model was needed.
4. The first row is Paradise unit 3 in 2014, one of the rows uploaded in step 2.
5. Click ✕ on the Coal chip to show that every part of the interpretation is an ordinary,
   editable filter. Put it back with Fuel = Coal.

(Without the upload, the threshold is 2,720,000 and the count is 97. The percentile moves
because the new 2014 rows are part of the data; unit-years with no CO₂ reported are left out.)

### 7. Ranking (0:30)

1. Click **Reset**, switch to **Facilities**, **Describe**:
   `top CO2-emitting facility in each state in 2024`.
2. Result: **51** facilities, one per state, sorted by CO₂. Open **More filters** to show what
   was set: **Ranking** = First 1, **Group** = Per state, **Year** = 2024. Kentucky's row is
   Ghent.
3. Say: "This is `ROW_NUMBER() OVER (PARTITION BY state ORDER BY co2 DESC)` in SQL."

### 8. Unit detail and history (0:30)

1. Click **Reset**, **Units** tab, **Name** mode, type `Ghent`.
2. Click a **Ghent unit 1** row. The unit dialog shows identification, fuel and controls, and
   **13** reporting years (2014–2026). The 2014 row's source is the upload; the others are
   CAMPD API datasets. Audit flags, if any, are listed at the bottom.

### 9. Compare (0:30)

1. **Facilities** tab, search `Ghent`, tick its checkbox; search `Paradise`, tick it.
2. Click **Compare** in the dock: capacity, fuels, CO₂, intensity, controls side by side.
3. Optional: tick 3 more to show the "Max 4: remove one first" message.

### 10. Download (0:45)

1. Run any search (for example step 5's) and click **CSV** next to the result count: every
   matching row, all pages.
2. Click **Download** in the header and show the types: complete dataset, valid records,
   invalid records, search results, selection, provenance.
3. Pick **Invalid records** and select the upload dataset → download. Same report as step 2.
4. Pick **Provenance** → download. One row per dataset with source, date, parameters, and the
   New/Updated/Unchanged/Dropped counts. Close with: "Every record in the database can be
   traced to the retrieval or file that wrote it."

## If something goes wrong

**No network.** Everything except Retrieve, the granular time series, and the 2D map tiles
works offline (the 3D globe's shapes are bundled). Skip step 3: open **Retrieve** only to
show the past-retrievals table, and describe the preview using the numbers above. The upload
in step 2 still shows "1 changed".

**Retrieve preview fails** (EPA API down or rate-limited). Same as above. The preview writes
nothing, so the database is unaffected.

**Counts differ from this script.** The database was changed by a rehearsal. Stop the
server, run `git restore db.sqlite`, and start again.

**A dialog is slow on first open.** You are running `npm run dev`; use
`npm run build && npm start`.

## After the demo

`git restore db.sqlite` to return to the committed data. Uploaded files are archived in
`uploads/`, which is not committed; delete them if you like.
