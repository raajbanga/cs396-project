# EPA CAMPD Database Architecture & Data Breakdown

This document provides a plain-language, engineering-level breakdown of how our database is structured, where the data comes from, what each table stores, which columns our application actually uses, and how that information is sliced into separate user views.

---

## 1. What Is This Data? (The Big Picture)

The data in this application comes from the **EPA Clean Air Markets Program Data (CAMPD)** and the federal **Continuous Emission Monitoring Systems (CEMS)**. 

Every commercial power plant in the United States that burns fossil fuel and sells electricity to the grid is required by federal law (under programs like the Acid Rain Program and the Cross-State Air Pollution Rule) to install sensor packages directly inside their exhaust stacks. These sensors measure heat, electricity output, and exhaust gases 24 hours a day, 365 days a year.

To make sense of this data, we organize it into a five-level hierarchy:

```mermaid
flowchart TD
    subgraph Real World Power Grid
        A["Power Plant Campus<br/><i>(e.g., Gibson Generating Station, IN)</i>"]
        B1["Boiler / Turbine Unit 1"]
        B2["Boiler / Turbine Unit 2"]
        B3["Boiler / Turbine Unit 3"]
    end

    subgraph Database Hierarchy
        F["<b>facilities</b> Table<br/>(One row per plant campus)"]
        U1["<b>units</b> Table<br/>(One row per boiler/generator)"]
        U2["<b>units</b> Table"]
        U3["<b>units</b> Table"]
        AR["<b>annual_records</b> Table<br/>(Yearly output, fuel, emissions per unit)"]
        AL["<b>data_audit_logs</b> Table<br/>(Flags for physics/sanity violations)"]
        DS["<b>datasets</b> Table<br/>(Ingestion batch & provenance tracking)"]
    end

    A --> F
    B1 --> U1
    B2 --> U2
    B3 --> U3
    F -->|houses 1 to many| U1
    F -->|houses 1 to many| U2
    F -->|houses 1 to many| U3
    U1 -->|reports per year| AR
    U2 -->|reports per year| AR
    U3 -->|reports per year| AR
    AR -->|triggers on anomaly| AL
    DS -->|tracks source batch| AR

    classDef real fill:#1e293b,stroke:#475569,stroke-width:1px,color:#f8fafc;
    classDef db fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    class A,B1,B2,B3 real;
    class F,U1,U2,U3,AR,AL,DS db;
```

### Key Real-World Concepts in Everyday Language

* **Facility (Power Plant)**: The physical facility or parcel of land (e.g., "Bowen Plant" in Georgia or "Monroe Power Plant" in Michigan). In the database, each facility has an official government ID number called an **ORISPL code** (Office of Regulatory Information Systems Plant code).
* **Generating Unit**: A single physical machine inside the plant that makes electricity or heat. A large coal or gas station typically has multiple units (e.g., "Unit 1", "Unit 2", "Combustion Turbine 1"). A unit has its own burner type, fuel supply, and pollution scrubbers.
* **MWh (Megawatt-hours)**: The amount of electrical energy the unit generated and sent onto the power grid. One MWh is roughly equal to the electricity an average American home consumes in one month.
* **Heat Input (MMBtu)**: The total thermal heat energy contained in the fuel that was burned. One MMBtu is 1,000,000 British Thermal Units. This tells us how much fuel went into the unit.
* **Mass Emissions (Tons of CO₂, SO₂, and NOx)**: The actual weight of pollutants released into the air through the smokestack over a given year:
  * **CO₂ (Carbon Dioxide)**: Primary greenhouse gas driving climate change.
  * **SO₂ (Sulfur Dioxide)**: Acid rain precursor, monitored strictly under the Clean Air Act.
  * **NOx (Nitrogen Oxides)**: Smog and ozone precursors that cause respiratory illness.
* **Heat Rate (MMBtu / MWh)**: Thermal efficiency. It measures: *"How much raw fuel energy did this unit have to burn to produce 1 MWh of electricity?"*
  * **Lower is better**: Modern combined-cycle gas plants run around 6.5 to 7.5 MMBtu/MWh. Old, inefficient peaking boilers run at 12.0 to 18.0+ MMBtu/MWh.
* **Carbon Intensity (lbs CO₂ / MWh)**: Emissions cleanliness. It measures: *"How many pounds of CO₂ entered the atmosphere for every single MWh of electricity generated?"*
  * **Lower is cleaner**: Clean natural gas typically runs between 700 and 1,000 lbs/MWh. Unabated coal plants run between 1,900 and 2,400+ lbs/MWh.

---

## 2. Relational Database Schema

Our relational database is stored in SQLite (via LibSQL / Turso) and managed with Drizzle ORM. It consists of 5 normalized tables:

```mermaid
erDiagram
    FACILITIES ||--o{ UNITS : "houses"
    FACILITIES ||--o{ ANNUAL_RECORDS : "tracks"
    UNITS ||--o{ ANNUAL_RECORDS : "reports"
    DATASETS ||--o{ ANNUAL_RECORDS : "originates"
    ANNUAL_RECORDS ||--o{ DATA_AUDIT_LOGS : "flags"

    FACILITIES {
        integer id PK "ORISPL Plant ID (e.g. 3, 56, 1378)"
        text name "Facility Name"
        text state_code "2-letter US State (e.g. TX, OH, PA)"
        text county "County location"
        real latitude "GPS Latitude coordinate"
        real longitude "GPS Longitude coordinate"
        integer epa_region "EPA Administrative Region (1-10)"
        text nerc_region "Regional Reliability Grid (ERCOT, PJM/RFC, WECC, etc.)"
        text source_category "Industrial sector (Electric Utility, Cogen, Small Power)"
        text owner_operator "Operating utility or holding entity"
    }

    UNITS {
        text id PK "UUID internal key"
        text unit_id "Generator Unit ID (e.g. '1', '2', 'CT1')"
        integer facility_id FK "References facilities.id"
        text unit_type "Boiler / Turbine / Combustion Engine type"
        text primary_fuel "Primary fuel (Coal, Natural Gas, Oil, etc.)"
        text secondary_fuel "Backup fuel"
        text operating_status "Operating, Retired, etc."
        text commercial_op_date "Original commissioning date"
        real max_hourly_hi_rate "Max heat input rating (MMBtu/hr)"
        real nameplate_capacity_mw "Electric generator size in Megawatts"
        text so2_controls "Flue gas desulfurization / scrubbers"
        text nox_controls "Selective catalytic reduction / low-NOx burners"
        text pm_controls "Electrostatic precipitators / fabric filters"
        text hg_controls "Activated carbon injection"
        text program_code "Federal regulatory programs (ARP, CSNOX, MATS)"
    }

    DATASETS {
        text id PK "UUID batch identifier"
        text name "Human label (e.g. 'CAMPD API 2022 [TX]')"
        text source "API or BULK_CSV"
        integer reporting_year "Calendar reporting year"
        integer imported_at "Unix epoch timestamp"
        integer raw_record_count "Total records received from EPA"
        integer valid_records "Successfully saved records"
        integer flagged_records "Records with sanity anomalies"
    }

    ANNUAL_RECORDS {
        text id PK "Composite ID: unitInternalId_year"
        text dataset_id FK "References datasets.id"
        integer facility_id FK "References facilities.id"
        text unit_internal_id FK "References units.id"
        integer year "Reporting Year (e.g. 2022)"
        real operating_hours "Hours the unit ran during the year"
        real gross_generation_mwh "Total electrical generation"
        real heat_input_mmbtu "Total thermal fuel consumed"
        real co2_mass_tons "Mass of CO2 emitted"
        real so2_mass_tons "Mass of SO2 emitted"
        real nox_mass_tons "Mass of NOx emitted"
        real co2_intensity_lbs_mwh "Stored derived intensity"
        real heat_rate_mmbtu_mwh "Stored derived heat rate"
    }

    DATA_AUDIT_LOGS {
        text id PK "UUID flag ID"
        text annual_record_id FK "References annual_records.id"
        text flag_type "ZERO_EMISSIONS_HIGH_HEAT | PHANTOM_GENERATION | EXTREME_HEAT_RATE"
        text severity "WARN | ERROR"
        text details "Plain-English diagnostic description"
        integer created_at "Unix epoch timestamp"
    }
```

---

## 3. Column Reference

Drizzle property names below; SQLite column names are snake_case equivalents. Section 6 has a quick UI coverage matrix.

### Table 1: `facilities`
Represents the physical power plant installation.

| Column | Type | What It Means | Where and How It Is Used |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | EPA ORISPL Plant code. | **Core ID**: Table searches (exact numeric lookup), URL routes, inspect modals, benchmark comparison selections, foreign key joins. |
| `name` | `TEXT` | Legal plant name (e.g. "Cumberland", "W.A. Parish"). | **Display & Search**: Table title, fuzzy text search, map marker tooltips, head-to-head comparison cards. |
| `stateCode` | `TEXT(2)` | Two-letter state postal abbreviation. | **Filtering & Grouping**: State filter dropdown, table badges, map coloring, and regional queries. |
| `county` | `TEXT` | County where the plant is located. | **Context & Search**: Fuzzy search matches counties; displayed in facility inspector modal and comparison sheets. |
| `latitude` | `REAL` | GPS North coordinate. | **Mapping**: Used by Leaflet 2D maps and D3 3D orthographic globe to pin plant coordinates. |
| `longitude` | `REAL` | GPS West coordinate. | **Mapping**: Used by Leaflet 2D maps and D3 3D orthographic globe to pin plant coordinates. |
| `epaRegion` | `INTEGER` | Federal EPA administrative zone (1 through 10). | **Inspection**: Displayed in the plant detail dialog for regulatory context. |
| `nercRegion` | `TEXT` | Electric reliability grid council (ERCOT, PJM/RFC, WECC, SERC, MRO, SPP, etc.). | **Grid Analysis & Filtering**: NERC dropdown filter, KPI regional breakdown chart, comparison dialog grid specs. |
| `sourceCategory` | `TEXT` | Classification (Electric Utility, Cogeneration, Small Power Producer, etc.). | **Display & Classification**: Table tags and facility detail inspector (not a filter dropdown). |
| `ownerOperator` | `TEXT` | Parent utility or corporate owner (e.g. Duke Energy, Southern Company). | **Search & Accountability**: Included in full-text search matching and displayed on plant cards. |

### Table 2: `units`
Represents individual generating machines (boilers, combustion turbines, generators) inside a facility.

| Column | Type | What It Means | Where and How It Is Used |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | UUID internal primary key. | **Foreign Key Anchor**: Links units to their yearly annual emissions records and audit logs. |
| `unitId` | `TEXT` | Human generator identifier (e.g. "1", "2", "CT1", "U1"). | **Unit Inspector**: Listed in the facility detail modal to identify specific smokestacks/generators. |
| `facilityId` | `INTEGER` | Foreign key referencing `facilities.id`. | **Relational Joins**: Allows grouping and rolling up units to their parent power plant. |
| `unitType` | `TEXT` | Burner configuration (Tangentially-fired boiler, Combined cycle, etc.). | **Unit Inspector**: Shown in the unit breakdown table inside the facility modal. |
| `primaryFuel` | `TEXT` | Main fuel burned (Coal, Natural Gas, Diesel Oil, Wood, etc.). | **Filtering & Visuals**: Primary fuel filter dropdown, table badges, map marker color coding, and fleet fuel breakdown. |
| `secondaryFuel` | `TEXT` | Backup or startup fuel. | **Comparison**: Displayed in the comparison dialog to show multi-fuel flexibility. |
| `operatingStatus` | `TEXT` | Status (Operating, Retired, Cold Standby). | **Fleet Health**: Displayed in the unit breakdown table; used in comparison to count active vs retired units. |
| `commercialOpDate` | `TEXT` | Year/date the unit entered commercial service. | **Age Analysis**: Displayed in the unit table to indicate equipment age and generation era. |
| `maxHourlyHIRate` | `REAL` | Maximum design heat input rate (MMBtu/hour). | **Stored only**: Populated from CSV seed data; not shown in the UI today. |
| `nameplateCapacityMW` | `REAL` | Electrical generator nameplate capacity in Megawatts (MW). | **Capacity Aggregations**: Summed at the plant level for table sorting, map pin scaling, and KPI cards (`totalCapacityMW`). |
| `so2Controls` | `TEXT` | Sulfur scrubbers (e.g., Wet Limestone Scrubber). | **Environmental Abatement**: Checked to compute "controlled units count" badge in table; detailed in comparison modal. |
| `noxControls` | `TEXT` | Nitrogen reduction tech (e.g., Low NOx Burner, SCR). | **Environmental Abatement**: Displayed in unit inspector and used in emission controls tally. |
| `pmControls` | `TEXT` | Particulate matter filters (e.g., Fabric Filter baghouses). | **Counting only**: Included in `controlledUnitsCount` / comparison tallies; not listed individually in the unit inspector. |
| `hgControls` | `TEXT` | Mercury sorbent systems (e.g., Activated Carbon). | **Counting only**: Same as `pmControls`. |
| `programCode` | `TEXT` | Applicable Clean Air Act regulatory programs (ARP, CSNOX, MATS). | **Stored only**: Ingested from CAMPD; not displayed in the UI today. |

### Table 3: `annual_records`
Stores the annual operational metrics and pollution mass for one unit for one calendar year.

| Column | Type | What It Means | Where and How It Is Used |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Set at ingestion to `${unitInternalId}_${year}` (schema default is UUID, but sync always supplies the composite). | **Unique Ledger ID**: Upsert target is `(unitInternalId, year)` so re-syncing the same year updates rather than duplicates. |
| `datasetId` | `TEXT` | Foreign key referencing `datasets.id`. | **Provenance**: Links each row to the ingestion batch that last wrote it. |
| `facilityId` | `INTEGER` | Foreign key referencing `facilities.id`. | **Plant Rollups**: Fast indexing for plant-level SQL aggregations without multi-hop unit joins. |
| `unitInternalId` | `TEXT` | Foreign key referencing `units.id`. | **Unit Ledger**: Links this yearly row to the specific physical turbine/boiler. |
| `year` | `INTEGER` | Calendar reporting year (e.g. 2022). | **Time Slicing**: Filtering records by reporting year; displayed in timeline cards. |
| `operatingHours` | `REAL` | Number of hours the machine ran during the year. | **Utilization & Sanity**: Aggregated to total plant run time; audited against generation (`PHANTOM_GENERATION` check). |
| `grossGenerationMWh` | `REAL` | Total electricity produced (Megawatt-hours). | **Productivity & Intensity**: Summed for total generation KPI; serves as the denominator for carbon intensity and heat rate. |
| `heatInputMMBtu` | `REAL` | Total fuel thermal energy consumed. | **Efficiency**: Summed to determine fuel volume; numerator for heat rate calculation. |
| `co2MassTons` | `REAL` | Weight of carbon dioxide released (short tons). | **Emissions Impact**: Summed for plant-level CO₂ rank, map bubble scaling, KPI totals, and carbon intensity numerator. |
| `so2MassTons` | `REAL` | Weight of sulfur dioxide released (short tons). | **Acid Rain Tracking**: Displayed in annual unit history and plant comparison benchmark. |
| `noxMassTons` | `REAL` | Weight of nitrogen oxides released (short tons). | **Smog Tracking**: Displayed in annual unit history and plant comparison benchmark. |
| `co2IntensityLbsMWh` | `REAL` | Stored carbon intensity ($(\text{CO}_2 \times 2000) / \text{Generation}$). | **Precomputed Metric**: Unit-level clean energy scoring. Note: The app also dynamically recomputes this at the facility level via SQL. |
| `heatRateMMBtuMWh` | `REAL` | Stored heat rate ($\text{Heat Input} / \text{Generation}$). | **Thermal Sanity & Efficiency**: Evaluated by anomaly engine (`EXTREME_HEAT_RATE`); displayed in comparison modal. |

### Table 4: `data_audit_logs`
Records anomalies discovered during data ingestion by the automated physical sanity engine.

| Column | Type | What It Means | Where and How It Is Used |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | UUID identifier for the violation. | **Log Key**: Primary key for audit table rendering. |
| `annualRecordId` | `TEXT` | Foreign key referencing `annual_records.id`. | **Relational Join**: Joins audit flags to the offending unit, facility name, and year. |
| `flagType` | `TEXT` | Category of physics violation. | **Categorization**: Grouping into `ZERO_EMISSIONS_HIGH_HEAT`, `PHANTOM_GENERATION`, or `EXTREME_HEAT_RATE`. |
| `severity` | `TEXT` | Level of concern (`ERROR` or `WARN`). | **Visual Alerting**: Determines badge colors (crimson vs amber) in the Audits tab. |
| `details` | `TEXT` | Plain-language diagnostic explanation. | **Audit Log Display**: Explains the exact numbers that triggered the flag so researchers understand why it failed. |
| `createdAt` | `INTEGER` | Unix timestamp of when the violation was flagged. | **Audit Trail**: Sorting logs chronologically to see the newest ingestion flags first. |

### Table 5: `datasets`
Tracks batch ingestion history from the EPA REST API or bulk CSV files.

| Column | Type | What It Means | Where and How It Is Used |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | UUID batch ID. | **Batch FK**: Referenced by `annual_records.datasetId`. |
| `name` | `TEXT` | Label (e.g. "CAMPD API 2022 [TX]"). | **Provenance**: Identifies which import run last touched linked `annual_records`. |
| `source` | `TEXT` | `"API"` today; schema also allows `"BULK_CSV"` but no script writes that yet. | **Data Lineage**: Distinguishes ingestion channels. |
| `reportingYear` | `INTEGER` | The calendar year ingested. | **Lineage**: Calendar year the batch applied to. |
| `importedAt` | `INTEGER` | Unix timestamp when the job ran. | **Audit Trail**: When the sync completed. |
| `rawRecordCount` | `INTEGER` | Total records parsed from EPA. | **Health Check**: Returned by `syncCampdAnnualEmissions()` CLI output. |
| `validRecords` | `INTEGER` | Clean records saved to database. | **Health Check**: Returned by CLI output. |
| `flaggedRecords` | `INTEGER` | Records that raised physics audit flags. | **Health Check**: Returned by CLI output. |

---

## 4. How the Data Is Split Across the Views

Instead of dumping everything into one slow, overwhelming table, we split the data across **6 distinct views and modals**. Each view queries only the specific slice of data it requires:

```mermaid
flowchart LR
    subgraph Database["SQLite / Drizzle Relational Store"]
        direction TB
        F[(facilities)]
        U[(units)]
        AR[(annual_records)]
        AL[(data_audit_logs)]
    end

    subgraph tRPC["tRPC Server Procedures"]
        direction TB
        qStats["facilities.getStats<br/><i>(SQL SUM, COUNT, GROUP BY)</i>"]
        qTable["facilities.getFacilities<br/><i>(Subqueries + LIMIT/OFFSET)</i>"]
        qMap["facilities.getMapFacilities<br/><i>(Lat/Long + Fuel + Tonnage)</i>"]
        qDetail["facilities.getFacility<br/><i>(Deep relational graph)</i>"]
        qCompare["facilities.compareFacilities<br/><i>(Multi-plant side-by-side)</i>"]
        qAudit["facilities.getAuditLogs<br/><i>(4-way table INNER JOIN)</i>"]
    end

    subgraph UIViews["Client UI Views & Modals"]
        direction TB
        vKPI["<b>1. System KPI Cards</b><br/>Total MW, CO2, fuel & grid mix"]
        vTable["<b>2. Facilities Explorer Table</b><br/>Search, state/fuel/NERC filters, sort"]
        vMap["<b>3. Geographic Map & 3D Globe</b><br/>Leaflet 2D pins & D3 orthographic globe"]
        vDetail["<b>4. Facility Detail Inspector</b><br/>Complete boiler/turbine breakdown & history"]
        vCompare["<b>5. Plant Benchmark Comparison</b><br/>Side-by-side comparative analysis"]
        vAudit["<b>6. Sanity Audit Log</b><br/>Flagged anomalies & physics checks"]
    end

    F & U & AR & AL --> qStats --> vKPI
    F & U & AR --> qTable --> vTable
    F & U & AR --> qMap --> vMap
    F & U & AR & AL --> qDetail --> vDetail
    F & U & AR --> qCompare --> vCompare
    AL & AR & F & U --> qAudit --> vAudit

    classDef dbStyle fill:#0f172a,stroke:#3b82f6,stroke-width:1.5px,color:#f8fafc;
    classDef trpcStyle fill:#1e293b,stroke:#10b981,stroke-width:1.5px,color:#f8fafc;
    classDef uiStyle fill:#18181b,stroke:#f59e0b,stroke-width:1.5px,color:#f8fafc;
    class F,U,AR,AL dbStyle;
    class qStats,qTable,qMap,qDetail,qCompare,qAudit trpcStyle;
    class vKPI,vTable,vMap,vDetail,vCompare,vAudit uiStyle;
```

---

### View 1: Top-Level System KPI Cards (`StatMetrics`)
* **Purpose**: Gives an instant 10,000-foot summary of the entire US electrical grid represented in the local database.
* **Query Used**: `api.facilities.getStats`
* **What Part of the Table It Uses**:
  * `facilities`: `COUNT(*)` for total facilities, `COUNT(DISTINCT state_code)` for states covered, `COUNT(DISTINCT nerc_region)` for grid regions, and `GROUP BY nerc_region` to find the largest grid sectors.
  * `units`: `COUNT(*)` for total units, `SUM(nameplate_capacity_mw)` for total grid capacity, and `GROUP BY primary_fuel` to calculate fuel type distribution (e.g. Natural Gas vs Coal vs Oil).
  * `annual_records`: `SUM(co2_mass_tons)` and `SUM(gross_generation_mwh)` — **all years combined**.
  * `data_audit_logs`: `COUNT(*)` for total flagged anomalies.
* **Why It’s Built This Way**: The database computes these totals in a single fast query. The browser receives only a tiny JSON summary (a few hundred bytes), loading instantly without transferring thousands of rows.

---

### View 2: Facilities Explorer Table (`FacilitiesTable` & `FacilityFilters`)
* **Purpose**: The primary interactive workspace for browsing, searching, and filtering all ~1,600 facilities.
* **Query Used**: `api.facilities.getFacilities` (pagination, text search, 3 dropdown filters: state, NERC grid, primary fuel)
* **What Part of the Table It Uses**:
  * **From `facilities`**: `id`, `name`, `stateCode`, `county`, `nercRegion`, `sourceCategory`, `ownerOperator`.
  * **Aggregated from `units`**: unit count, total capacity, fuel badges, controlled-units count.
  * **Aggregated from `annual_records`**: total CO₂, total operating hours, carbon intensity — **summed across all years** in the database (not filtered to a single reporting year).
  * **Carbon intensity badge tiers** (`CarbonIntensityBadge`): clean if `< 950`, intermediate if `950–1600`, high if `> 1600` lbs/MWh.
* **Why It’s Built This Way**: The backend rolls up each facility into one row. Pagination (10/25/50 per page) keeps responses small.

---

### View 3: Geographic Map & 3D Globe (`FacilitiesMap`, `LeafletMap`, `D3Globe`)
* **Purpose**: Visualizing spatial patterns of power generation and carbon emissions across the US.
* **Query Used**: `api.facilities.getMapFacilities`
* **What Part of the Table It Uses**:
  * `facilities`: `id`, `name`, `stateCode`, `county`, `latitude`, `longitude`, `nercRegion`, `sourceCategory`.
  * `units`: first non-empty `primary_fuel` (marker color via `getFuelTheme()`: green for gas, amber for coal, rose for oil, blue/cyan/lime for hydro/nuclear/solar/wind) and `totalCapacityMW`.
  * `annual_records`: `totalCo2Tons` (marker radius when metric mode is CO₂; summed across all years).
* **Why It’s Built This Way**: Heavy fields like individual boiler IDs, scrubber names, and yearly historical ledgers are stripped out. The map gets only coordinates and sizing metrics, allowing smooth 60fps panning, zooming, and 3D globe rotation.

---

### View 4: Facility Deep-Dive Inspector (`FacilityDetailDialog`)
* **Purpose**: Provides a full technical and environmental drill-down on a single selected power plant.
* **Query Used**: `api.facilities.getFacility` (triggered when a user clicks any plant row or map pin)
* **What Part of the Table It Uses**:
  * **Full `facilities` row**: Name, ORISPL ID, county, state, EPA region, NERC reliability zone, owner/operator.
  * **Child `units`**: Unit ID, type, capacity, operating status, commissioning date, secondary fuel; SO₂ and NOx controls shown individually (PM/Hg controls count toward totals but are not listed).
  * **Year-by-year `annual_records`**: Hours, generation, heat input, emissions, heat rate, carbon intensity.
  * **`data_audit_logs`**: Shown on the dedicated Audit tab inside the inspector.
* **Why It’s Built This Way**: This is lazy-loaded on demand. We only query the deep relational tree for one facility when the user explicitly requests it, keeping overall app performance fast.

---

### View 5: Head-to-Head Plant Comparison Modal (`PlantComparisonDialog`)
* **Purpose**: Allows users to select 2 to 4 power plants and compare their performance side-by-side.
* **Query Used**: `api.facilities.compareFacilities` (2–4 facility IDs)
* **What Part of the Table It Uses**: Grid/fleet specs, capacity, fuels, and emissions metrics — **scoped to the latest reporting year** per plant (not lifetime totals).
* **Technology Abatement**: Separate tallies for SO₂-, NOx-, and PM-controlled units.

---

### View 6: Data Quality & Physics Audit Log (`AuditLogsTable`)
* **Purpose**: Dedicated quality-control dashboard displaying data anomalies detected during ingestion.
* **Query Used**: `api.facilities.getAuditLogs`
* **What Part of the Table It Uses**:
  * Joins `data_audit_logs` + `annual_records` + `facilities` + `units`.
  * Extracts the facility name, unit ID, reporting year, violation flag type, severity (`ERROR` / `WARN`), and plain-English diagnostic description.
* **The Physics Rules We Check** (enforced via `AUDIT_THRESHOLDS` in `src/server/campd/client.ts`):
  1. **`ZERO_EMISSIONS_HIGH_HEAT`** (`severity: "ERROR"`): A fossil fuel generator consumed heat energy above the threshold (`heatInputMMBtu > 1,000 MMBtu`), but reported 0.0 tons of CO₂ emissions (`co2MassTons === 0`), which is physically impossible when combusting hydrocarbon fuels.
  2. **`PHANTOM_GENERATION`** (`severity: "ERROR"`): A generator produced electricity (`grossGenerationMWh > 0 MWh`), but recorded 0.0 hours of operating time (`operatingHours === 0`).
  3. **`EXTREME_HEAT_RATE`** (`severity: "WARN"`): The calculated heat rate falls outside standard thermodynamic limits (< 5.0 or > 25.0 MMBtu/MWh: `heatRateMMBtuMWh < 5.0 || heatRateMMBtuMWh > 25.0`), indicating faulty generation or fuel telemetry.
* **Why It’s Built This Way**: Isolates suspicious or corrupt data points into a dedicated review screen with human-friendly descriptions rather than silently corrupting fleet-wide averages.

---

## 5. Ingestion & Sync Workflow

There is **no in-app sync UI** today. Data enters via two CLI scripts:

| Script | What it does |
| :--- | :--- |
| `scripts/seed-facilities-from-csv.ts` | Seeds `facilities` + `units` from local CAMPD CSV exports (metadata only; no `datasets` rows). |
| `scripts/sync_campd.ts` | Calls `syncCampdAnnualEmissions()` — fetches annual emissions from the EPA REST API, runs Zod validation + physics audits, upserts into `annual_records`. |

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / CI
    participant Script as sync_campd.ts
    participant Client as CAMPD Client
    participant EPA as EPA CAMPD REST API
    participant DB as SQLite / LibSQL

    Dev->>Script: Run with year + optional state
    Script->>Client: syncCampdAnnualEmissions()
    Client->>DB: Preload facility/unit maps, create datasets row
    Client->>EPA: GET /emissions-mgmt/emissions/apportioned/annual
    EPA-->>Client: JSON batch of raw records
    loop Each record
        Client->>Client: Zod normalize, dedupe by (facilityId, unitId, year)
        Client->>Client: Physics sanity checks → audit log entries
    end
    Client->>DB: Upsert facilities, units, annual_records (50-row chunks)
    Client->>DB: Replace audit logs for touched records
    Client->>DB: Update datasets counts
    Script-->>Dev: Print raw/valid/flagged summary
```

---

## 6. Summary Matrix: Where Each Column Lives in the UI

| Database Table | Column Name | System KPIs | Explorer Table | Geographic Map | Plant Inspector | Compare Modal | Audits Tab |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`facilities`** | `id` (ORISPL) | | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| | `name` | | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| | `stateCode` | **Yes** (Count) | **Yes** | **Yes** | **Yes** | **Yes** | |
| | `county` | | **Yes** | **Yes** | **Yes** | **Yes** | |
| | `latitude` / `longitude` | | | **Yes** | | | |
| | `nercRegion` | **Yes** (Mix) | **Yes** | **Yes** | **Yes** | **Yes** | |
| | `sourceCategory` | | **Yes** | **Yes** | **Yes** | **Yes** | |
| | `ownerOperator` | | **Yes** | **Yes** | **Yes** | **Yes** | |
| **`units`** | `unitId` | | | | **Yes** | | **Yes** |
| | `primaryFuel` | **Yes** (Mix) | **Yes** | **Yes** | **Yes** | **Yes** | |
| | `unitType` | | | | **Yes** | | |
| | `operatingStatus` | | | | **Yes** | **Yes** | |
| | `nameplateCapacityMW` | **Yes** (Total) | **Yes** (Total) | **Yes** (Scale) | **Yes** | **Yes** | |
| | Environmental Controls (`so2`, `nox`, `pm`, `hg`) | | **Yes** (Count) | | **Yes** (SO₂/NOx only) | **Yes** (Tally) | |
| **`annual_records`** | `grossGenerationMWh` | **Yes** (Total) | | | **Yes** | **Yes** | |
| | `operatingHours` | | **Yes** (Total) | | **Yes** | **Yes** | |
| | `heatInputMMBtu` | | | | **Yes** | **Yes** | |
| | `co2MassTons` | **Yes** (Total) | **Yes** (Total) | **Yes** (Scale) | **Yes** | **Yes** | |
| | `so2MassTons` / `noxMassTons` | | | | **Yes** | **Yes** | |
| | `co2IntensityLbsMWh` | | **Yes** (Badge) | | **Yes** | **Yes** | |
| | `heatRateMMBtuMWh` | | | | **Yes** | **Yes** | |
| **`data_audit_logs`**| `flagType` / `severity` / `details` | **Yes** (Count) | | | **Yes** | | **Yes** |
| **`datasets`** | `name` / `importedAt` / counts | | | | | | **CLI sync output only** |

---

## 7. Important Caveats

1. **Multi-year aggregation**: KPI cards, the explorer table, and the map sum `annual_records` across every year loaded — only the comparison modal scopes to the latest year per plant.
2. **Column naming**: Drizzle uses camelCase (`stateCode`); SQLite stores snake_case (`state_code`). This doc uses Drizzle names in tables and SQL column names in query descriptions.
3. **Seed vs sync**: CSV seeding populates plant/unit metadata; API sync populates emissions. Both are required for a fully enriched database.

---

## 8. Conclusion

Five normalized tables, ingestion-time physics audits, and per-view server aggregations keep the UI fast on a lightweight SQLite/LibSQL database — even with ~1,600 facilities and ~5,000 units.