# Sample upload files

`annual-emissions-sample.csv` and `annual-emissions-sample.xlsx` hold the same 25 rows, in
the column layout of a CAMPD Custom Data Download annual-emissions file. Use either one with
**Upload** to see every step of the validation report: new, changed, and unchanged records,
rejected rows, an in-file duplicate, and a physical-sanity flag.

## Where the rows come from

- **Metrics** (operating time, gross load, heat input, SO₂/CO₂/NOₓ mass and rates) are real
  values from the EPA CAM API (`/emissions-mgmt/emissions/apportioned/annual`, Kentucky),
  retrieved on 2026-10-09: reporting year 2014 for the new rows and 2023 for the two rows
  that already exist in `db.sqlite`.
- **Unit attribute columns** (fuel, unit type, controls, program code) are copied from the
  units already stored in `db.sqlite`. Units keep one set of attributes, so an import of
  2014 attributes would overwrite today's values. Copying them means the import changes no
  unit columns. Units whose fuel changed since 2014 (for example Big Sandy BSU1, converted
  from coal to gas) were left out for the same reason.
- **Defects** were added on purpose to rows 12, 18, 19, 23, and 25 (see below). Row 16 is
  unmodified EPA data that trips a sanity rule by itself.

## Row by row

Row numbers count data rows (the header is row 0), as in the upload report. In a
spreadsheet, add 1.

|   Row | Facility (ID) · unit · year         | Expected result   | Why                                                                       |
| ----: | :---------------------------------- | :---------------- | :------------------------------------------------------------------------ |
|   1–3 | E W Brown (1355) · 1, 2, 3 · 2014   | New               | 2014 is not in the database (it covers 2015–2026)                         |
|   4–7 | Ghent (1356) · 1–4 · 2014           | New               |                                                                           |
|  8–11 | Mill Creek (1364) · 1–4 · 2014      | New               |                                                                           |
|    12 | Elmer Smith (1374) · _blank_ · 2014 | **Rejected**      | `Unit ID: Missing required value`                                         |
| 13–15 | Paradise (1378) · 1, 2, 3 · 2014    | New               |                                                                           |
|    16 | Robert Reid (1383) · RT · 2014      | New + **flagged** | 38,801.9 MMBtu heat input but no CO₂ reported → `CO2_NOT_REPORTED` (WARN) |
|    17 | East Bend (6018) · 2 · 2014         | New               |                                                                           |
|    18 | H L Spurlock (6041) · 1 · 2014      | **Rejected**      | State `KZ` → `Unrecognized US state or territory 'KZ'`                    |
|    19 | H L Spurlock (6041) · 2 · 2014      | **Rejected**      | CO₂ = −3,603,705.49 → `Must be at least 0`                                |
| 20–21 | Trimble County (6071) · 1, 2 · 2014 | New               |                                                                           |
|    22 | Trimble County (6071) · 1 · 2023    | **Unchanged**     | Identical to the stored 2023 record                                       |
|    23 | Trimble County (6071) · 2 · 2023    | **Changed**       | CO₂ 4,098,943.863 in the file vs 4,099,943.863 stored (1,000 t lower)     |
|    24 | D B Wilson (6823) · W1 · 2014       | New               |                                                                           |
|    25 | Ghent (1356) · 1 · 2014             | **Duplicate**     | Same facility-unit-year as row 4; skipped                                 |

## Expected report

Uploading either file into the committed `db.sqlite` should show:

| Rows | Valid | Rejected | Duplicates | New | Changed | Unchanged | Audit flags |
| ---: | ----: | -------: | ---------: | --: | ------: | --------: | ----------: |
|   25 |    21 |        3 |          1 |  19 |       1 |         1 |           1 |

Five columns are reported as unmapped (`Associated Stacks`, `Operating Time Count`, and the
three emission rates); epaData recomputes rates from the stored masses.

After **Approve & Import**:

- The **Units** tab with **More filters → Origin: File upload** lists 21 unit-years.
- **Download → Invalid records** for the upload dataset holds the 3 rejected rows, the
  duplicate, and the flagged row, each with its original columns.
- Uploading the other file (CSV after Excel, or the reverse) shows 21 Unchanged and no New.
- **Retrieve** with State = KY, Facility IDs = 6071, years 2023–2023 previews 1 Changed record
  (Trimble County 2: database 4,098,943.863 → API 4,099,943.863). Approving it restores the
  EPA value.

To undo a test import, restore the committed database: `git restore db.sqlite`.
