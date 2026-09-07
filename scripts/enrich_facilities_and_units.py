import glob
import os
import re
import sqlite3
import uuid

def parse_mw(s):
    if not s:
        return None
    matches = re.findall(r"\(([\d.]+)\)", str(s))
    if matches:
        try:
            return round(sum(float(m) for m in matches), 2)
        except ValueError:
            return None
    return None

def parse_float(s):
    if not s:
        return None
    try:
        return float(str(s).strip())
    except ValueError:
        return None

def parse_int(s):
    if not s:
        return None
    try:
        return int(float(str(s).strip()))
    except ValueError:
        return None

def clean_str(s):
    if not s:
        return None
    cleaned = str(s).strip()
    return cleaned if cleaned else None

def enrich_database():
    csv_dir = "../CAMPD DATA"
    if not os.path.exists(csv_dir):
        csv_dir = "c:/fall26/CS396/CAMPD DATA"
    csv_files = sorted(glob.glob(os.path.join(csv_dir, "facility-*.csv")))
    print(f"Found {len(csv_files)} CSV files in {csv_dir}")

    conn = sqlite3.connect("db.sqlite")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    print("Recreating normalized schema with enriched columns...")
    cur.executescript("""
    DROP TABLE IF EXISTS "data_audit_logs";
    DROP TABLE IF EXISTS "annual_records";
    DROP TABLE IF EXISTS "datasets";
    DROP TABLE IF EXISTS "units";
    DROP TABLE IF EXISTS "facilities";

    CREATE TABLE "facilities" (
      "id" integer PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "state_code" text(2) NOT NULL,
      "county" text,
      "latitude" real,
      "longitude" real,
      "epa_region" integer,
      "nerc_region" text,
      "source_category" text,
      "owner_operator" text
    );
    CREATE INDEX "facility_state_idx" ON "facilities" ("state_code");
    CREATE INDEX "facility_name_idx" ON "facilities" ("name");
    CREATE INDEX "facility_nerc_idx" ON "facilities" ("nerc_region");
    CREATE INDEX "facility_source_cat_idx" ON "facilities" ("source_category");

    CREATE TABLE "units" (
      "id" text PRIMARY KEY NOT NULL,
      "unit_id" text NOT NULL,
      "facility_id" integer NOT NULL REFERENCES "facilities"("id") ON DELETE CASCADE,
      "unit_type" text,
      "primary_fuel" text,
      "secondary_fuel" text,
      "operating_status" text,
      "commercial_op_date" text,
      "max_hourly_hi_rate" real,
      "nameplate_capacity_mw" real,
      "so2_controls" text,
      "nox_controls" text,
      "pm_controls" text,
      "hg_controls" text,
      "program_code" text
    );
    CREATE UNIQUE INDEX "unit_facility_unit_idx" ON "units" ("facility_id", "unit_id");
    CREATE INDEX "unit_facility_id_idx" ON "units" ("facility_id");
    CREATE INDEX "unit_primary_fuel_idx" ON "units" ("primary_fuel");
    CREATE INDEX "unit_operating_status_idx" ON "units" ("operating_status");

    CREATE TABLE "datasets" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "source" text NOT NULL,
      "reporting_year" integer NOT NULL,
      "imported_at" integer DEFAULT (unixepoch()) NOT NULL,
      "raw_record_count" integer DEFAULT 0 NOT NULL,
      "valid_records" integer DEFAULT 0 NOT NULL,
      "flagged_records" integer DEFAULT 0 NOT NULL
    );

    CREATE TABLE "annual_records" (
      "id" text PRIMARY KEY NOT NULL,
      "dataset_id" text REFERENCES "datasets"("id") ON DELETE CASCADE,
      "facility_id" integer NOT NULL REFERENCES "facilities"("id") ON DELETE CASCADE,
      "unit_internal_id" text NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
      "year" integer NOT NULL,
      "operating_hours" real DEFAULT 0.0 NOT NULL,
      "gross_generation_mwh" real DEFAULT 0.0 NOT NULL,
      "heat_input_mmbtu" real DEFAULT 0.0 NOT NULL,
      "co2_mass_tons" real DEFAULT 0.0 NOT NULL,
      "so2_mass_tons" real DEFAULT 0.0 NOT NULL,
      "nox_mass_tons" real DEFAULT 0.0 NOT NULL,
      "co2_intensity_lbs_mwh" real,
      "heat_rate_mmbtu_mwh" real
    );
    CREATE UNIQUE INDEX "annual_record_unit_year_idx" ON "annual_records" ("unit_internal_id", "year");
    CREATE INDEX "annual_record_facility_idx" ON "annual_records" ("facility_id");
    CREATE INDEX "annual_record_year_co2_idx" ON "annual_records" ("year", "co2_mass_tons");

    CREATE TABLE "data_audit_logs" (
      "id" text PRIMARY KEY NOT NULL,
      "annual_record_id" text NOT NULL REFERENCES "annual_records"("id") ON DELETE CASCADE,
      "flag_type" text NOT NULL,
      "severity" text NOT NULL,
      "details" text NOT NULL,
      "created_at" integer DEFAULT (unixepoch()) NOT NULL
    );
    CREATE INDEX "audit_annual_record_idx" ON "data_audit_logs" ("annual_record_id");
    """)

    facilities_dict = {}
    units_dict = {}

    import csv
    for csv_path in csv_files:
        print(f"Processing {os.path.basename(csv_path)}...")
        with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                state_code = clean_str(row.get("State"))
                facility_name = clean_str(row.get("Facility Name"))
                fac_id_raw = clean_str(row.get("Facility ID"))
                unit_id = clean_str(row.get("Unit ID"))

                if not state_code or not fac_id_raw or not unit_id or fac_id_raw == "Facility ID":
                    continue

                try:
                    facility_id = int(fac_id_raw)
                except ValueError:
                    continue

                county = clean_str(row.get("County"))
                lat = parse_float(row.get("Latitude"))
                lon = parse_float(row.get("Longitude"))
                epa_reg = parse_int(row.get("EPA Region"))
                nerc_reg = clean_str(row.get("NERC Region"))
                source_cat = clean_str(row.get("Source Category"))
                owner_op = clean_str(row.get("Owner/Operator"))

                unit_type = clean_str(row.get("Unit Type"))
                primary_fuel = clean_str(row.get("Primary Fuel Type"))
                secondary_fuel = clean_str(row.get("Secondary Fuel Type"))
                op_status = clean_str(row.get("Operating Status"))
                comm_date = clean_str(row.get("Commercial Operation Date"))
                max_hi = parse_float(row.get("Max Hourly HI Rate (mmBtu/hr)"))
                mw_cap = parse_mw(row.get("Associated Generators & Nameplate Capacity (MWe)"))
                so2_ctrl = clean_str(row.get("SO2 Controls"))
                nox_ctrl = clean_str(row.get("NOx Controls"))
                pm_ctrl = clean_str(row.get("PM Controls"))
                hg_ctrl = clean_str(row.get("Hg Controls"))
                prog_code = clean_str(row.get("Program Code"))

                # 1. Update/insert facility
                if facility_id not in facilities_dict:
                    facilities_dict[facility_id] = {
                        "id": facility_id,
                        "name": facility_name or f"Facility #{facility_id}",
                        "state_code": state_code.upper()[:2],
                        "county": county,
                        "latitude": lat,
                        "longitude": lon,
                        "epa_region": epa_reg,
                        "nerc_region": nerc_reg,
                        "source_category": source_cat,
                        "owner_operator": owner_op,
                    }
                else:
                    fac = facilities_dict[facility_id]
                    if not fac["county"] and county:
                        fac["county"] = county
                    if fac["latitude"] is None and lat is not None:
                        fac["latitude"] = lat
                    if fac["longitude"] is None and lon is not None:
                        fac["longitude"] = lon
                    if fac["epa_region"] is None and epa_reg is not None:
                        fac["epa_region"] = epa_reg
                    if not fac["nerc_region"] and nerc_reg:
                        fac["nerc_region"] = nerc_reg
                    if not fac["source_category"] and source_cat:
                        fac["source_category"] = source_cat
                    if not fac["owner_operator"] and owner_op:
                        fac["owner_operator"] = owner_op

                # 2. Update/insert unit
                unit_key = (facility_id, unit_id)
                if unit_key not in units_dict:
                    units_dict[unit_key] = {
                        "id": str(uuid.uuid4()),
                        "unit_id": unit_id,
                        "facility_id": facility_id,
                        "unit_type": unit_type,
                        "primary_fuel": primary_fuel,
                        "secondary_fuel": secondary_fuel,
                        "operating_status": op_status,
                        "commercial_op_date": comm_date,
                        "max_hourly_hi_rate": max_hi,
                        "nameplate_capacity_mw": mw_cap,
                        "so2_controls": so2_ctrl,
                        "nox_controls": nox_ctrl,
                        "pm_controls": pm_ctrl,
                        "hg_controls": hg_ctrl,
                        "program_code": prog_code,
                    }
                else:
                    u = units_dict[unit_key]
                    if not u["unit_type"] and unit_type:
                        u["unit_type"] = unit_type
                    if not u["primary_fuel"] and primary_fuel:
                        u["primary_fuel"] = primary_fuel
                    if not u["secondary_fuel"] and secondary_fuel:
                        u["secondary_fuel"] = secondary_fuel
                    if not u["operating_status"] and op_status:
                        u["operating_status"] = op_status
                    if not u["commercial_op_date"] and comm_date:
                        u["commercial_op_date"] = comm_date
                    if u["max_hourly_hi_rate"] is None and max_hi is not None:
                        u["max_hourly_hi_rate"] = max_hi
                    if u["nameplate_capacity_mw"] is None and mw_cap is not None:
                        u["nameplate_capacity_mw"] = mw_cap
                    if not u["so2_controls"] and so2_ctrl:
                        u["so2_controls"] = so2_ctrl
                    if not u["nox_controls"] and nox_ctrl:
                        u["nox_controls"] = nox_ctrl
                    if not u["pm_controls"] and pm_ctrl:
                        u["pm_controls"] = pm_ctrl
                    if not u["hg_controls"] and hg_ctrl:
                        u["hg_controls"] = hg_ctrl
                    if not u["program_code"] and prog_code:
                        u["program_code"] = prog_code

    print(f"Total unique facilities: {len(facilities_dict)}")
    print(f"Total unique units: {len(units_dict)}")

    # Batch insert facilities
    print("Inserting facilities...")
    cur.executemany(
        """
        INSERT INTO "facilities" (
          "id", "name", "state_code", "county", "latitude", "longitude",
          "epa_region", "nerc_region", "source_category", "owner_operator"
        )
        VALUES (
          :id, :name, :state_code, :county, :latitude, :longitude,
          :epa_region, :nerc_region, :source_category, :owner_operator
        )
        """,
        list(facilities_dict.values())
    )

    # Batch insert units
    print("Inserting units...")
    cur.executemany(
        """
        INSERT INTO "units" (
          "id", "unit_id", "facility_id", "unit_type", "primary_fuel",
          "secondary_fuel", "operating_status", "commercial_op_date",
          "max_hourly_hi_rate", "nameplate_capacity_mw", "so2_controls",
          "nox_controls", "pm_controls", "hg_controls", "program_code"
        )
        VALUES (
          :id, :unit_id, :facility_id, :unit_type, :primary_fuel,
          :secondary_fuel, :operating_status, :commercial_op_date,
          :max_hourly_hi_rate, :nameplate_capacity_mw, :so2_controls,
          :nox_controls, :pm_controls, :hg_controls, :program_code
        )
        """,
        list(units_dict.values())
    )

    cur.execute("PRAGMA foreign_key_check;")
    fk_errors = cur.fetchall()
    if fk_errors:
        raise RuntimeError(f"Foreign key check failed: {fk_errors}")
    print("Foreign key check passed.")

    conn.commit()
    cur.execute("VACUUM;")
    conn.close()
    print("Enrichment completed successfully!")

if __name__ == "__main__":
    enrich_database()

