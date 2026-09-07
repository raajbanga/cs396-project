# Product Requirements Document (PRD)

**Project:** epaData Management System (Phase 1 — Ingestion, Normalization & Core Engine)  
**Authors / Leads:** Raaj Banga (Backend & Data Pipelines), Arnav Bawankule (Frontend & Interface)  
**Target Stack:** Next.js (App Router, TypeScript), Prisma ORM, SQLite  

---

## 1. Executive Summary & Scoping

The goal of Phase 1 is to establish an end-to-end data ingestion, validation, relational persistence, search, and export platform using power-sector emissions data from the EPA Clean Air Markets Program Data (CAMPD). 

To ensure high reliability and deep feature polish within a two-person team, secondary exploratory elements from the generic course specifications have been cut, while key high-leverage data-engineering capabilities have been introduced.

### 1.1 Out of Scope (Pruned from Course Spec)
* **TRACI Environmental Impact Characterization:** Excluded from Phase 1. All conversion factors, impact indicators, dynamic multi-indicator scoring models, and weight scenario tables (`traci_factors`, `weight_scenarios`, `score_results`) are deferred to Phase 2.
* **Decoupled Flask/Jinja Architecture:** Replaced with an integrated Next.js TypeScript stack to eliminate microservice friction, separate backend boilerplate, and redundant data transfer layers.
* **Secondary Pollutant Estimations:** Excluded tertiary datasets (e.g., eGRID capacity factor formulas, NEI particulate matter models, AP-42 emission factors). Phase 1 strictly targets core CAMPD emissions and operating metrics.

### 1.2 Value-Add Capabilities ("Beyond a Toy")
* **Derived Efficiency Metrics:** Automated on-ingestion calculation of carbon intensity (lbs CO2 / MWh) and heat rate efficiency (MMBtu / MWh).
* **Automated Data Quality & Anomaly Engine:** Ingestion checks identifying physical inconsistencies (e.g., heat input with zero reported emissions, phantom generation, extreme heat rates).
* **Head-to-Head Plant Benchmarking:** Checkbox-driven comparative module allowing side-by-side metric comparison for 2–4 power plants.
* **Interactive D3 Orthographic Wireframe Map:** Rotatable 2D vector globe projecting plant coordinates with back-face culling and instant stat popovers.

---

## 2. Ingestion Pipeline: API & Bulk Files

The application supports dual ingestion pathways feeding into a single normalization and persistence worker.

```
[CAMPD REST API] ──┐
                   ├─► [Raw Stream / Buffer] ─► [Zod Normalizer] ─► [Deduplication & Anomaly Engine] ─► [SQLite / Prisma]
[Bulk CSV Files] ──┘
```

### 2.1 Pathway A: CAMPD REST API Integration
* **Endpoints:** 
  * Facilities: `/facilities-mgmt/facilities`
  * Apportioned Annual Emissions: `/emissions-mgmt/apportioned/annual`
* **Authentication:** EPA `x-api-key` header injected exclusively on the server via `CAMPD_API_KEY` environment variable. Never exposed to client bundles.
* **Query Parameters:** Supports parameterized retrieval by reporting year, state, fuel category, and page limits.

### 2.2 Pathway B: Bulk CSV File Upload
* **Target Format:** Custom Data Download (CDD) CSVs from EPA CAMPD and instructor-provided flat files.
* **Processing:** Streaming parser (`fast-csv` / `PapaParse`) executed in Node.js server route handlers to process files >50 MB without memory overflow.
* **Upload Workflow:** Drag-and-drop file upload on `/upload` with client-side dry-run preview before committing transactions to the database.

---

## 3. Data Normalization, Alignment & Deduplication

CAMPD API JSON payloads use camelCase formatting, whereas bulk CSV exports use verbose column headers. The ingestion pipeline normalizes both formats into a unified internal model.

### 3.1 Field Normalization Mapping

| Target Database Field | CAMPD Bulk CSV Header | CAMPD API JSON Key | Type / Transformation Rule |
| :--- | :--- | :--- | :--- |
| `facilityId` | `Facility ID (ORISPL)` | `facilityId` | `Integer` (trim whitespace) |
| `facilityName` | `Facility Name` | `facilityName` | `String` (trimmed, title casing) |
| `stateCode` | `State` | `stateCode` | `String(2)` (uppercased) |
| `unitId` | `Unit ID` | `unitId` | `String` (trimmed) |
| `year` | `Year` | `year` | `Integer` |
| `operatingHours` | `Operating Time` | `operatingTime` | `Float` (default `0.0` if null) |
| `grossGenerationMWh` | `Gross Load (MW-h)` | `grossLoad` | `Float` (default `0.0` if null) |
| `heatInputMMBtu` | `Heat Input (MMBtu)` | `heatInput` | `Float` (default `0.0` if null) |
| `co2MassTons` | `CO2 (short tons)` | `co2Mass` | `Float` (default `0.0` if null) |
| `so2MassTons` | `SO2 (short tons)` | `so2Mass` | `Float` (default `0.0` if null) |
| `noxMassTons` | `NOx (short tons)` | `noxMass` | `Float` (default `0.0` if null) |

### 3.2 Deduplication Strategy
* **Natural Unique Composite Key:** Records are uniquely identified by the tuple `(facilityId, unitId, year)`.
* **Conflict Resolution Policy:**
  1. If `(facilityId, unitId, year)` does not exist: insert record.
  2. If the record exists: bulk CSV imports overwrite older API sync records; otherwise, existing records are retained and an update metric is logged. No records are dropped silently.
* **Facility Entity Deduplication:** Facilities are normalized into parent entities. Multiple unit records referencing the same `facilityId` update facility-level metadata (coordinates, county) without creating redundant facility rows.

### 3.3 Data Quality Audit & Anomaly Rules
Validated records are evaluated against physical sanity checks before commitment:
* **`ZERO_EMISSIONS_HIGH_HEAT`:** `heatInputMMBtu > 1000` AND `co2MassTons == 0`
* **`PHANTOM_GENERATION`:** `grossGenerationMWh > 0` AND `operatingHours == 0`
* **`EXTREME_HEAT_RATE`:** Heat rate `(heatInputMMBtu / grossGenerationMWh) > 25.0` or `< 5.0 MMBtu/MWh` (for thermal units)

Flagged records are saved with a linked entry in `DataAuditLog`, detailing the anomaly type and severity without aborting the batch insertion.

---

## 4. Prisma Database Schema (`schema.prisma`)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Dataset {
  id             String         @id @default(cuid())
  name           String
  source         String         // "API" | "BULK_CSV"
  reportingYear  Int
  importedAt     DateTime       @default(now())
  rawRecordCount Int
  validRecords   Int
  flaggedRecords Int
  annualRecords  AnnualRecord[]
}

model Facility {
  id             Int            @id // EPA ORISPL / Facility ID
  name           String
  stateCode      String         // 2-letter state abbreviation
  county         String?
  latitude       Float?
  longitude      Float?
  units          Unit[]
}

model Unit {
  id             String         @id @default(cuid()) // Internal unique key
  unitId         String         // EPA Unit ID
  facilityId     Int
  facility       Facility       @relation(fields: [facilityId], references: [id], onDelete: Cascade)
  unitType       String?
  primaryFuel    String?
  annualRecords  AnnualRecord[]

  @@unique([facilityId, unitId])
}

model AnnualRecord {
  id                  String          @id @default(cuid())
  datasetId           String
  dataset             Dataset         @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  unitInternalId      String
  unit                Unit            @relation(fields: [unitInternalId], references: [id], onDelete: Cascade)
  
  year                Int
  operatingHours      Float           @default(0.0)
  grossGenerationMWh  Float           @default(0.0)
  heatInputMMBtu      Float           @default(0.0)
  co2MassTons         Float           @default(0.0)
  so2MassTons         Float           @default(0.0)
  noxMassTons         Float           @default(0.0)

  // Derived Metrics
  co2IntensityLbsMWh  Float?          // (co2MassTons * 2000) / grossGenerationMWh
  heatRateMMBtuMWh    Float?          // heatInputMMBtu / grossGenerationMWh

  auditLogs           DataAuditLog[]

  @@unique([unitInternalId, year])
  @@index([year, co2MassTons])
}

model DataAuditLog {
  id              String       @id @default(cuid())
  annualRecordId  String
  annualRecord    AnnualRecord @relation(fields: [annualRecordId], references: [id], onDelete: Cascade)
  flagType        String       // "ZERO_EMISSIONS_HIGH_HEAT" | "PHANTOM_GENERATION" | "EXTREME_HEAT_RATE"
  severity        String       // "WARN" | "ERROR"
  details         String
  createdAt       DateTime     @default(now())
}
```

---

## 5. Technical Implementation Roadmap

* **Phase 1.1: Foundations & Schema Setup**
  * Initialize Next.js project with Tailwind CSS and Prisma.
  * Run initial Prisma migration creating SQLite schema.
  * Implement base environment variables and CAMPD API client.
* **Phase 1.2: Normalization & Ingestion Engine**
  * Write Zod schemas for CSV rows and CAMPD API JSON bodies.
  * Implement streaming file ingestion handler with `fast-csv`.
  * Build anomaly evaluation module and derived metric calculations.
* **Phase 1.3: Deduplication & Ingestion Endpoints**
  * Create `POST /api/ingest/api` and `POST /api/ingest/csv`.
  * Wrap insertions in Prisma batch transactions (`prisma.$transaction`).
* **Phase 1.4: Search, Visualization & Verification**
  * Build Data Explorer table with multi-criteria filters and server pagination.
  * Implement D3 Orthographic rotatable wireframe map.
  * Add CSV export pipeline and data quality audit inspection tab.
