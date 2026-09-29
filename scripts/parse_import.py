#!/usr/bin/env python3
"""
GridPulse Data Import & Validation Engine
Reads CSV and Excel files, identifies columns, validates against project schema,
detects missing/invalid values and duplicate facility-unit-year records,
and outputs a comprehensive JSON validation report.
"""

import sys
import os
import csv
import json
import argparse
import re
import sqlite3
from typing import Dict, List, Any, Optional, Set, Tuple

# Project Schemas Definition
FACILITY_COLUMNS = {
    "id": ["facility id", "facility_id", "facility id (orispl)", "orispl", "plant id"],
    "name": ["facility name", "facility_name", "plant name", "name"],
    "stateCode": ["state", "state code", "state_code", "statecode"],
    "county": ["county", "county name"],
    "latitude": ["latitude", "lat"],
    "longitude": ["longitude", "long", "lon"],
    "epaRegion": ["epa region", "epa_region", "eparegion"],
    "nercRegion": ["nerc region", "nerc_region", "nercregion"],
    "sourceCategory": ["source category", "source_category", "sourcecategory"],
    "ownerOperator": ["owner/operator", "owner operator", "owner_operator", "owner", "operator"]
}

UNIT_COLUMNS = {
    "unitId": ["unit id", "unit_id", "unitid", "generator id", "unit"],
    "unitType": ["unit type", "unit_type", "unittype"],
    "primaryFuel": ["primary fuel type", "primary fuel", "primary_fuel", "primaryfuel", "primaryfuelinfo"],
    "secondaryFuel": ["secondary fuel type", "secondary fuel", "secondary_fuel", "secondaryfuel", "secondaryfuelinfo"],
    "operatingStatus": ["operating status", "operating_status", "operatingstatus", "status"],
    "commercialOpDate": ["commercial operation date", "commercial op date", "commercial_op_date", "commercialopdate"],
    "maxHourlyHIRate": ["max hourly hi rate (mmbtu/hr)", "max hourly hi rate", "max_hourly_hi_rate"],
    "nameplateCapacityMW": ["associated generators & nameplate capacity (mwe)", "nameplate capacity (mw)", "nameplate capacity", "nameplate_capacity_mw", "capacity_mw", "nameplatecapacitymw"],
    "so2Controls": ["so2 controls", "so2_controls", "so2controls", "so2controlinfo"],
    "noxControls": ["nox controls", "nox_controls", "noxcontrols", "noxcontrolinfo"],
    "pmControls": ["pm controls", "pm_controls", "pmcontrols", "pmcontrolinfo"],
    "hgControls": ["hg controls", "hg_controls", "hgcontrols", "hgcontrolinfo"],
    "programCode": ["program code", "program_code", "programcode", "programcodeinfo"]
}

ANNUAL_COLUMNS = {
    "operatingHours": ["optime", "sumoptime", "operating time", "operating time count", "sum of the operating time", "operating hours", "operating_hours", "countoptime"],
    "grossGenerationMWh": ["gross load (mwh)", "gross load (mw-h)", "grossload", "gross generation (mwh)", "gross_generation_mwh", "gross generation"],
    "heatInputMMBtu": ["heat input (mmbtu)", "heatinput", "heat_input_mmbtu", "heat input"],
    "co2MassTons": ["co2 mass (short tons)", "co2 mass", "co2 (short tons)", "co2mass", "co2_mass_tons"],
    "so2MassTons": ["so2 mass (short tons)", "so2 mass", "so2 (short tons)", "so2mass", "so2_mass_tons"],
    "noxMassTons": ["nox mass (short tons)", "nox mass", "nox (short tons)", "noxmass", "nox_mass_tons"],
    "year": ["year", "reporting year", "reporting_year", "op_year", "calendaryear", "date"]
}

US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "PR", "VI", "GU", "AS", "MP"
}

def normalize_col(c: str) -> str:
    """Normalize column header for robust matching."""
    return re.sub(r'[\s_\-]+', ' ', str(c).strip().lower())

def clean_val(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s != "" else None

def parse_num(val: Any) -> Optional[float]:
    s = clean_val(val)
    if s is None:
        return None
    s = s.replace(',', '')
    try:
        return float(s)
    except ValueError:
        return None

def parse_nameplate_mw(val: Any) -> Optional[float]:
    s = clean_val(val)
    if s is None:
        return None
    matches = re.findall(r'\(([\d.]+)\)', s)
    if matches:
        try:
            return round(sum(float(m) for m in matches), 2)
        except ValueError:
            pass
    return parse_num(s)

def match_columns_to_schema(headers: List[str]):
    norm_headers = {normalize_col(h): h for h in headers}
    
    # Check Facilities & Units matches
    fac_matched = {}
    for db_col, aliases in FACILITY_COLUMNS.items():
        for alias in aliases:
            if alias in norm_headers:
                fac_matched[db_col] = norm_headers[alias]
                break

    unit_matched = {}
    for db_col, aliases in UNIT_COLUMNS.items():
        for alias in aliases:
            if alias in norm_headers:
                unit_matched[db_col] = norm_headers[alias]
                break

    annual_matched = {}
    for db_col, aliases in ANNUAL_COLUMNS.items():
        for alias in aliases:
            if alias in norm_headers:
                annual_matched[db_col] = norm_headers[alias]
                break

    # Determine primary schema target
    is_fac_units = ("id" in fac_matched and "unitId" in unit_matched)
    is_annual = ("id" in fac_matched and "unitId" in unit_matched and "year" in annual_matched and ("co2MassTons" in annual_matched or "grossGenerationMWh" in annual_matched or "heatInputMMBtu" in annual_matched))
    
    if is_annual and not ("primaryFuel" in unit_matched or "unitType" in unit_matched):
        target_schema = "ANNUAL_EMISSIONS"
        destination_tables = ["annual_records", "datasets", "data_audit_logs"]
    elif is_fac_units:
        target_schema = "FACILITIES_AND_UNITS"
        destination_tables = ["facilities", "units", "datasets"]
        if "year" in annual_matched and ("co2MassTons" in annual_matched or "grossGenerationMWh" in annual_matched):
            destination_tables.append("annual_records")
    else:
        target_schema = "GENERIC_CAMPD_DATASET"
        destination_tables = ["datasets"]

    # Table mappings
    table_mappings = []
    mapped_file_cols = set()

    for db_col, file_col in fac_matched.items():
        table_mappings.append({
            "fileColumn": file_col,
            "targetTable": "facilities",
            "targetColumn": db_col,
            "required": db_col in ["id", "name", "stateCode"]
        })
        mapped_file_cols.add(file_col)

    for db_col, file_col in unit_matched.items():
        table_mappings.append({
            "fileColumn": file_col,
            "targetTable": "units",
            "targetColumn": db_col,
            "required": db_col in ["unitId"]
        })
        mapped_file_cols.add(file_col)

    for db_col, file_col in annual_matched.items():
        table_mappings.append({
            "fileColumn": file_col,
            "targetTable": "annual_records",
            "targetColumn": db_col,
            "required": db_col in ["year"]
        })
        mapped_file_cols.add(file_col)

    # Required check
    missing_required = []
    if target_schema in ("FACILITIES_AND_UNITS", "ANNUAL_EMISSIONS"):
        if "id" not in fac_matched:
            missing_required.append({"table": "facilities", "column": "id", "description": "Facility ID (ORISPL)"})
        if "unitId" not in unit_matched:
            missing_required.append({"table": "units", "column": "unitId", "description": "Unit ID"})
        if target_schema == "FACILITIES_AND_UNITS":
            if "name" not in fac_matched:
                missing_required.append({"table": "facilities", "column": "name", "description": "Facility Name"})
            if "stateCode" not in fac_matched:
                missing_required.append({"table": "facilities", "column": "stateCode", "description": "State"})
        if target_schema == "ANNUAL_EMISSIONS":
            if "year" not in annual_matched:
                missing_required.append({"table": "annual_records", "column": "year", "description": "Reporting Year"})

    unmapped_columns = [h for h in headers if h not in mapped_file_cols]

    return {
        "targetSchema": target_schema,
        "destinationTables": destination_tables,
        "tableMappings": table_mappings,
        "facMatched": fac_matched,
        "unitMatched": unit_matched,
        "annualMatched": annual_matched,
        "missingRequired": missing_required,
        "unmappedColumns": unmapped_columns,
        "matchedCount": len(mapped_file_cols),
        "totalColumns": len(headers)
    }

def read_file_rows(file_path: str, max_rows: Optional[int] = None) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Read CSV or Excel file and return headers and rows as list of dicts."""
    ext = os.path.splitext(file_path)[1].lower()
    headers = []
    rows = []

    if ext in ('.csv', '.tsv', '.txt'):
        # Try UTF-8 with BOM, then standard UTF-8, then Latin-1
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1']:
            try:
                with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                    # Sniff delimiter (comma or tab)
                    sample = f.read(8192)
                    f.seek(0)
                    delimiter = '\t' if ext == '.tsv' or ('\t' in sample and ',' not in sample) else ','
                    reader = csv.reader(f, delimiter=delimiter)
                    try:
                        raw_headers = next(reader)
                    except StopIteration:
                        return [], []
                    
                    headers = [str(h).strip().strip('"').strip("'") for h in raw_headers if str(h).strip() != ""]
                    
                    for r_idx, raw_row in enumerate(reader):
                        if max_rows and len(rows) >= max_rows:
                            break
                        row_dict = {}
                        for i, h in enumerate(headers):
                            row_dict[h] = raw_row[i] if i < len(raw_row) else ""
                        rows.append(row_dict)
                break
            except Exception as e:
                if encoding == 'latin-1':
                    raise e
                continue

    elif ext in ('.xlsx', '.xlsm'):
        import openpyxl
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        sheet = wb.active
        iter_rows = sheet.iter_rows(values_only=True)
        
        try:
            raw_headers = next(iter_rows)
        except StopIteration:
            return [], []
        
        headers = [str(h).strip() for h in raw_headers if h is not None and str(h).strip() != ""]
        header_len = len(headers)
        
        for raw_row in iter_rows:
            if max_rows and len(rows) >= max_rows:
                break
            if not any(raw_row):
                continue
            row_dict = {}
            for i, h in enumerate(headers):
                val = raw_row[i] if i < len(raw_row) else ""
                row_dict[h] = "" if val is None else str(val)
            rows.append(row_dict)
        wb.close()

    else:
        raise ValueError(f"Unsupported file format: {ext}. Only .csv and .xlsx are supported.")

    return headers, rows

def check_db_existing_records(db_path: Optional[str]) -> Tuple[Set[int], Set[str], Set[str]]:
    """Check existing facilities, units, and annual records from SQLite database."""
    fac_ids = set()
    unit_keys = set()
    annual_keys = set()
    
    if not db_path or not os.path.exists(db_path):
        return fac_ids, unit_keys, annual_keys
    
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        cur.execute("SELECT id FROM facilities;")
        fac_ids = {r[0] for r in cur.fetchall()}
        
        cur.execute("SELECT facility_id, unit_id FROM units;")
        unit_keys = {f"{r[0]}:{r[1]}" for r in cur.fetchall()}
        
        cur.execute("""
            SELECT ar.facility_id, u.unit_id, ar.year 
            FROM annual_records ar 
            JOIN units u ON ar.unit_internal_id = u.id;
        """)
        annual_keys = {f"{r[0]}:{r[1]}:{r[2]}" for r in cur.fetchall()}
        
        conn.close()
    except Exception as e:
        sys.stderr.write(f"Warning checking db: {e}\n")
    
    return fac_ids, unit_keys, annual_keys

def validate_and_report(file_path: str, db_path: Optional[str] = None, preview_limit: int = 50) -> Dict[str, Any]:
    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    headers, rows = read_file_rows(file_path)
    schema_info = match_columns_to_schema(headers)

    db_fac_ids, db_unit_keys, db_annual_keys = check_db_existing_records(db_path)

    fac_matched = schema_info["facMatched"]
    unit_matched = schema_info["unitMatched"]
    annual_matched = schema_info["annualMatched"]

    col_facility_id = fac_matched.get("id")
    col_facility_name = fac_matched.get("name")
    col_state = fac_matched.get("stateCode")
    col_lat = fac_matched.get("latitude")
    col_lon = fac_matched.get("longitude")
    col_unit_id = unit_matched.get("unitId")
    col_year = annual_matched.get("year")
    col_hi = annual_matched.get("heatInputMMBtu")
    col_co2 = annual_matched.get("co2MassTons")
    col_mwh = annual_matched.get("grossGenerationMWh")
    col_hours = annual_matched.get("operatingHours")

    seen_file_triples: Dict[str, int] = {}
    validation_errors = []
    anomalies = []
    duplicates = []
    
    valid_count = 0
    invalid_count = 0
    duplicate_count = 0
    flagged_count = 0

    preview_rows = []

    # Missing value counters per column
    missing_by_col = {h: 0 for h in headers}

    for idx, row in enumerate(rows):
        row_num = idx + 1
        row_issues = []
        is_row_valid = True
        is_row_dup = False

        # Tally missing values
        for h in headers:
            if clean_val(row.get(h)) is None:
                missing_by_col[h] += 1

        # Extract Core Keys
        raw_fac_id = clean_val(row.get(col_facility_id)) if col_facility_id else None
        raw_unit_id = clean_val(row.get(col_unit_id)) if col_unit_id else None
        
        # Determine year
        raw_year = None
        if col_year and clean_val(row.get(col_year)):
            y_str = clean_val(row.get(col_year))
            if y_str and len(y_str) >= 4 and y_str[:4].isdigit():
                raw_year = y_str[:4]
            else:
                raw_year = y_str
        elif "Year" in row and clean_val(row.get("Year")):
            raw_year = clean_val(row.get("Year"))

        # 1. Validate Facility ID
        parsed_fac_id = None
        if not raw_fac_id:
            if col_facility_id:
                row_issues.append({
                    "field": col_facility_id,
                    "issue": "Missing mandatory Facility ID",
                    "severity": "ERROR"
                })
                is_row_valid = False
        else:
            try:
                parsed_fac_id = int(float(raw_fac_id.replace(',', '')))
                if parsed_fac_id <= 0:
                    row_issues.append({
                        "field": col_facility_id,
                        "value": raw_fac_id,
                        "issue": f"Invalid Facility ID ({raw_fac_id}): must be positive",
                        "severity": "ERROR"
                    })
                    is_row_valid = False
            except ValueError:
                row_issues.append({
                    "field": col_facility_id,
                    "value": raw_fac_id,
                    "issue": f"Invalid Facility ID format: expected integer, received '{raw_fac_id}'",
                    "severity": "ERROR"
                })
                is_row_valid = False

        # 2. Validate Unit ID
        if col_unit_id and not raw_unit_id:
            row_issues.append({
                "field": col_unit_id,
                "issue": "Missing mandatory Unit ID",
                "severity": "ERROR"
            })
            is_row_valid = False

        # 3. Validate State
        if col_state:
            val_state = clean_val(row.get(col_state))
            if val_state:
                norm_st = val_state.upper()[:2]
                if norm_st not in US_STATES:
                    row_issues.append({
                        "field": col_state,
                        "value": val_state,
                        "issue": f"Unrecognized US State or Territory: '{val_state}'",
                        "severity": "WARN"
                    })
            elif schema_info["targetSchema"] == "FACILITIES_AND_UNITS":
                row_issues.append({
                    "field": col_state,
                    "issue": "Missing State code for facility",
                    "severity": "WARN"
                })

        # 4. Validate Coordinates
        if col_lat:
            lat_val = parse_num(row.get(col_lat))
            if lat_val is not None and not (-90.0 <= lat_val <= 90.0):
                row_issues.append({
                    "field": col_lat,
                    "value": str(lat_val),
                    "issue": f"Latitude out of bounds [-90, 90]: {lat_val}",
                    "severity": "ERROR"
                })
                is_row_valid = False

        if col_lon:
            lon_val = parse_num(row.get(col_lon))
            if lon_val is not None and not (-180.0 <= lon_val <= 180.0):
                row_issues.append({
                    "field": col_lon,
                    "value": str(lon_val),
                    "issue": f"Longitude out of bounds [-180, 180]: {lon_val}",
                    "severity": "ERROR"
                })
                is_row_valid = False

        # 5. Check Duplicate facility-unit-year records (Step 7 requirement)
        triple_key = None
        if parsed_fac_id and raw_unit_id:
            yr_str = str(raw_year) if raw_year else "ALL"
            triple_key = f"{parsed_fac_id}:{raw_unit_id}:{yr_str}"
            
            if triple_key in seen_file_triples:
                first_seen = seen_file_triples[triple_key]
                dup_info = {
                    "rowNumber": row_num,
                    "firstSeenRow": first_seen,
                    "facilityId": parsed_fac_id,
                    "unitId": raw_unit_id,
                    "year": yr_str,
                    "duplicateType": "FILE_DUPLICATE",
                    "reason": f"Duplicate facility-unit-year record: already appeared on row {first_seen}"
                }
                duplicates.append(dup_info)
                row_issues.append({
                    "field": "Record Key",
                    "value": f"Plant {parsed_fac_id}, Unit {raw_unit_id}, Year {yr_str}",
                    "issue": f"Duplicate facility-unit-year record (previously seen on row {first_seen})",
                    "severity": "WARN"
                })
                is_row_dup = True
                duplicate_count += 1
            else:
                seen_file_triples[triple_key] = row_num
                if raw_year and f"{parsed_fac_id}:{raw_unit_id}:{raw_year}" in db_annual_keys:
                    duplicates.append({
                        "rowNumber": row_num,
                        "facilityId": parsed_fac_id,
                        "unitId": raw_unit_id,
                        "year": str(raw_year),
                        "duplicateType": "DB_EXISTING",
                        "reason": f"Facility-unit-year already exists in database (will be updated on import)"
                    })

        # 6. Physical Sanity Thermodynamic Rules (PRD 3.3)
        hi_val = parse_num(row.get(col_hi)) if col_hi else None
        co2_val = parse_num(row.get(col_co2)) if col_co2 else None
        mwh_val = parse_num(row.get(col_mwh)) if col_mwh else None
        hrs_val = parse_num(row.get(col_hours)) if col_hours else None

        # Rule A: ZERO_EMISSIONS_HIGH_HEAT
        if hi_val is not None and co2_val is not None:
            if hi_val > 1000 and co2_val == 0:
                anom = {
                    "rowNumber": row_num,
                    "facilityId": parsed_fac_id,
                    "unitId": raw_unit_id,
                    "flagType": "ZERO_EMISSIONS_HIGH_HEAT",
                    "severity": "ERROR",
                    "details": f"Heat input was {hi_val:,.1f} MMBtu, but CO2 reported was 0.0 tons."
                }
                anomalies.append(anom)
                row_issues.append({
                    "field": col_co2 or "CO2 Mass",
                    "value": "0.0 tons",
                    "issue": anom["details"],
                    "severity": "ERROR"
                })
                flagged_count += 1

        # Rule B: PHANTOM_GENERATION
        if mwh_val is not None and hrs_val is not None:
            if mwh_val > 0 and hrs_val == 0:
                anom = {
                    "rowNumber": row_num,
                    "facilityId": parsed_fac_id,
                    "unitId": raw_unit_id,
                    "flagType": "PHANTOM_GENERATION",
                    "severity": "ERROR",
                    "details": f"Gross generation was {mwh_val:,.1f} MWh while operating time was 0 hours."
                }
                anomalies.append(anom)
                row_issues.append({
                    "field": col_hours or "Operating Hours",
                    "value": "0 hrs",
                    "issue": anom["details"],
                    "severity": "ERROR"
                })
                flagged_count += 1

        # Rule C: EXTREME_HEAT_RATE
        if hi_val is not None and mwh_val is not None and mwh_val > 0:
            heat_rate = hi_val / mwh_val
            if heat_rate < 5.0 or heat_rate > 25.0:
                anom = {
                    "rowNumber": row_num,
                    "facilityId": parsed_fac_id,
                    "unitId": raw_unit_id,
                    "flagType": "EXTREME_HEAT_RATE",
                    "severity": "WARN",
                    "details": f"Heat rate of {heat_rate:.2f} MMBtu/MWh is outside normal thermal envelope (5.0 - 25.0)."
                }
                anomalies.append(anom)
                row_issues.append({
                    "field": "Heat Rate",
                    "value": f"{heat_rate:.2f} MMBtu/MWh",
                    "issue": anom["details"],
                    "severity": "WARN"
                })
                flagged_count += 1

        # Accumulate validation errors for rejected records
        if not is_row_valid:
            invalid_count += 1
            for issue in row_issues:
                if issue.get("severity") == "ERROR":
                    validation_errors.append({
                        "rowNumber": row_num,
                        "facilityId": parsed_fac_id or raw_fac_id or "—",
                        "unitId": raw_unit_id or "—",
                        "field": issue.get("field", "Unknown"),
                        "value": str(issue.get("value", "")),
                        "reason": issue.get("issue", "Invalid value"),
                        "severity": "ERROR",
                        "action": "Row will be skipped"
                    })
        else:
            valid_count += 1

        # Build preview row if within limit
        if idx < preview_limit:
            status = "valid"
            if not is_row_valid:
                status = "invalid"
            elif is_row_dup:
                status = "duplicate"
            elif any(iss.get("severity") == "WARN" for iss in row_issues):
                status = "warning"
            
            preview_rows.append({
                "rowNumber": row_num,
                "data": row,
                "status": status,
                "issues": row_issues
            })

    total_rows = len(rows)

    return {
        "fileName": file_name,
        "fileSize": file_size,
        "fileExtension": ext.lstrip('.'),
        "totalRows": total_rows,
        "availableColumns": headers,
        "targetSchema": schema_info["targetSchema"],
        "destinationTables": schema_info["destinationTables"],
        "schemaComparison": {
            "targetSchema": schema_info["targetSchema"],
            "matchedCount": schema_info["matchedCount"],
            "totalColumns": schema_info["totalColumns"],
            "tableMappings": schema_info["tableMappings"],
            "missingRequired": schema_info["missingRequired"],
            "unmappedColumns": schema_info["unmappedColumns"],
            "isSchemaCompatible": len(schema_info["missingRequired"]) == 0
        },
        "summary": {
            "totalRows": total_rows,
            "validCount": valid_count,
            "invalidCount": invalid_count,
            "duplicateCount": duplicate_count,
            "flaggedCount": flagged_count,
            "canImport": valid_count > 0 and len(schema_info["missingRequired"]) == 0
        },
        "validationErrors": validation_errors[:200],  # Return up to 200 validation issues
        "duplicates": duplicates[:100],               # Return up to 100 duplicates
        "anomalies": anomalies[:100],                 # Return up to 100 anomalies
        "missingValueCounts": missing_by_col,
        "previewRows": preview_rows
    }

def commit_import_to_db(file_path: str, db_path: str, dataset_name: Optional[str] = None) -> Dict[str, Any]:
    """Store approved records into SQLite database within a transaction."""
    import uuid
    import time
    from collections import Counter

    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found at {db_path}")

    headers, rows = read_file_rows(file_path)
    schema_info = match_columns_to_schema(headers)

    fac_matched = schema_info["facMatched"]
    unit_matched = schema_info["unitMatched"]
    annual_matched = schema_info["annualMatched"]

    col_facility_id = fac_matched.get("id")
    col_facility_name = fac_matched.get("name")
    col_state = fac_matched.get("stateCode")
    col_county = fac_matched.get("county")
    col_lat = fac_matched.get("latitude")
    col_lon = fac_matched.get("longitude")
    col_epa = fac_matched.get("epaRegion")
    col_nerc = fac_matched.get("nercRegion")
    col_source_cat = fac_matched.get("sourceCategory")
    col_owner = fac_matched.get("ownerOperator")

    col_unit_id = unit_matched.get("unitId")
    col_unit_type = unit_matched.get("unitType")
    col_pri_fuel = unit_matched.get("primaryFuel")
    col_sec_fuel = unit_matched.get("secondaryFuel")
    col_op_status = unit_matched.get("operatingStatus")
    col_comm_date = unit_matched.get("commercialOpDate")
    col_max_hi = unit_matched.get("maxHourlyHIRate")
    col_nameplate = unit_matched.get("nameplateCapacityMW")
    col_so2_ctrl = unit_matched.get("so2Controls")
    col_nox_ctrl = unit_matched.get("noxControls")
    col_pm_ctrl = unit_matched.get("pmControls")
    col_hg_ctrl = unit_matched.get("hgControls")
    col_prog_code = unit_matched.get("programCode")

    col_hours = annual_matched.get("operatingHours")
    col_mwh = annual_matched.get("grossGenerationMWh")
    col_hi = annual_matched.get("heatInputMMBtu")
    col_co2 = annual_matched.get("co2MassTons")
    col_so2 = annual_matched.get("so2MassTons")
    col_nox = annual_matched.get("noxMassTons")
    col_year = annual_matched.get("year")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Preload existing units
    cur.execute("SELECT facility_id, unit_id, id FROM units;")
    existing_unit_map = {f"{r[0]}:{r[1]}": r[2] for r in cur.fetchall()}

    facilities_map: Dict[int, Tuple] = {}
    units_map: Dict[str, Tuple] = {}
    annual_records_map: Dict[str, Tuple] = {}
    audit_logs_list: List[Tuple] = []

    years_seen = []
    valid_rows_count = 0
    flagged_rows_count = 0

    dataset_id = str(uuid.uuid4())
    ext = os.path.splitext(file_path)[1].lower()
    source_type = "BULK_CSV" if ext in ('.csv', '.tsv', '.txt') else "BULK_EXCEL"
    dataset_label = dataset_name or f"Upload: {os.path.basename(file_path)}"

    for idx, row in enumerate(rows):
        row_num = idx + 1
        raw_fac_id = clean_val(row.get(col_facility_id)) if col_facility_id else None
        raw_unit_id = clean_val(row.get(col_unit_id)) if col_unit_id else None
        
        if not raw_fac_id or not raw_unit_id:
            continue
        
        try:
            facility_id = int(float(raw_fac_id.replace(',', '')))
            if facility_id <= 0:
                continue
        except ValueError:
            continue

        valid_rows_count += 1

        # Facility data
        fac_name = clean_val(row.get(col_facility_name)) or f"Facility #{facility_id}"
        state_code = (clean_val(row.get(col_state)) or "US").upper()[:2]
        county = clean_val(row.get(col_county))
        lat = parse_num(row.get(col_lat))
        lon = parse_num(row.get(col_lon))
        epa_reg = int(parse_num(row.get(col_epa)) or 0) if parse_num(row.get(col_epa)) else None
        nerc_reg = clean_val(row.get(col_nerc))
        source_cat = clean_val(row.get(col_source_cat))
        owner_op = clean_val(row.get(col_owner))

        facilities_map[facility_id] = (
            facility_id, fac_name, state_code, county, lat, lon, epa_reg, nerc_reg, source_cat, owner_op
        )

        # Unit data
        unit_key = f"{facility_id}:{raw_unit_id}"
        unit_internal_id = existing_unit_map.get(unit_key) or str(uuid.uuid4())
        existing_unit_map[unit_key] = unit_internal_id

        unit_type = clean_val(row.get(col_unit_type))
        pri_fuel = clean_val(row.get(col_pri_fuel))
        sec_fuel = clean_val(row.get(col_sec_fuel))
        op_status = clean_val(row.get(col_op_status))
        comm_date = clean_val(row.get(col_comm_date))
        max_hi = parse_num(row.get(col_max_hi))
        nameplate_mw = parse_nameplate_mw(row.get(col_nameplate)) if col_nameplate else None
        so2_ctrl = clean_val(row.get(col_so2_ctrl))
        nox_ctrl = clean_val(row.get(col_nox_ctrl))
        pm_ctrl = clean_val(row.get(col_pm_ctrl))
        hg_ctrl = clean_val(row.get(col_hg_ctrl))
        prog_code = clean_val(row.get(col_prog_code))

        units_map[unit_key] = (
            unit_internal_id, raw_unit_id, facility_id, unit_type, pri_fuel, sec_fuel,
            op_status, comm_date, max_hi, nameplate_mw, so2_ctrl, nox_ctrl, pm_ctrl, hg_ctrl, prog_code
        )

        # Year determination
        raw_year = None
        if col_year and clean_val(row.get(col_year)):
            y_str = clean_val(row.get(col_year))
            if y_str and len(y_str) >= 4 and y_str[:4].isdigit():
                raw_year = int(y_str[:4])
        elif "Year" in row and clean_val(row.get("Year")) and clean_val(row.get("Year"))[:4].isdigit():
            raw_year = int(clean_val(row.get("Year"))[:4])

        if raw_year:
            years_seen.append(raw_year)

        # Annual records check
        has_metrics = col_co2 or col_mwh or col_hi or col_hours
        if raw_year and has_metrics:
            hours = parse_num(row.get(col_hours)) or 0.0
            mwh = parse_num(row.get(col_mwh)) or 0.0
            hi = parse_num(row.get(col_hi)) or 0.0
            co2 = parse_num(row.get(col_co2)) or 0.0
            so2 = parse_num(row.get(col_so2)) or 0.0
            nox = parse_num(row.get(col_nox)) or 0.0

            intensity = round((co2 * 2000.0) / mwh, 2) if (mwh > 0 and co2 is not None) else None
            heat_rate = round(hi / mwh, 2) if (mwh > 0 and hi is not None) else None

            annual_rec_id = f"{unit_internal_id}_{raw_year}"
            annual_records_map[annual_rec_id] = (
                annual_rec_id, dataset_id, facility_id, unit_internal_id, raw_year,
                hours, mwh, hi, co2, so2, nox, intensity, heat_rate
            )

            # Check sanity anomalies
            has_anomaly = False
            if hi > 1000 and co2 == 0:
                audit_logs_list.append((
                    str(uuid.uuid4()), annual_rec_id, "ZERO_EMISSIONS_HIGH_HEAT", "ERROR",
                    f"Heat input was {hi:,.1f} MMBtu, but CO2 reported was 0.0 tons.",
                    int(time.time())
                ))
                has_anomaly = True

            if mwh > 0 and hours == 0:
                audit_logs_list.append((
                    str(uuid.uuid4()), annual_rec_id, "PHANTOM_GENERATION", "ERROR",
                    f"Gross generation was {mwh:,.1f} MWh while operating time was 0 hours.",
                    int(time.time())
                ))
                has_anomaly = True

            if heat_rate is not None and (heat_rate < 5.0 or heat_rate > 25.0):
                audit_logs_list.append((
                    str(uuid.uuid4()), annual_rec_id, "EXTREME_HEAT_RATE", "WARN",
                    f"Heat rate of {heat_rate:.2f} MMBtu/MWh is outside normal thermal envelope (5.0 - 25.0).",
                    int(time.time())
                ))
                has_anomaly = True

            if has_anomaly:
                flagged_rows_count += 1

    reporting_year = Counter(years_seen).most_common(1)[0][0] if years_seen else (time.localtime().tm_year - 1)

    try:
        cur.execute("BEGIN TRANSACTION;")

        # 1. Insert Dataset
        cur.execute("""
            INSERT INTO datasets (id, name, source, reporting_year, imported_at, raw_record_count, valid_records, flagged_records)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            dataset_id, dataset_label, source_type, reporting_year,
            int(time.time()), len(rows), valid_rows_count, flagged_rows_count
        ))

        # 2. Upsert Facilities
        cur.executemany("""
            INSERT INTO facilities (id, name, state_code, county, latitude, longitude, epa_region, nerc_region, source_category, owner_operator)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = COALESCE(excluded.name, facilities.name),
                state_code = COALESCE(excluded.state_code, facilities.state_code),
                county = COALESCE(excluded.county, facilities.county),
                latitude = COALESCE(excluded.latitude, facilities.latitude),
                longitude = COALESCE(excluded.longitude, facilities.longitude),
                epa_region = COALESCE(excluded.epa_region, facilities.epa_region),
                nerc_region = COALESCE(excluded.nerc_region, facilities.nerc_region),
                source_category = COALESCE(excluded.source_category, facilities.source_category),
                owner_operator = COALESCE(excluded.owner_operator, facilities.owner_operator);
        """, list(facilities_map.values()))

        # 3. Upsert Units
        cur.executemany("""
            INSERT INTO units (
                id, unit_id, facility_id, unit_type, primary_fuel, secondary_fuel,
                operating_status, commercial_op_date, max_hourly_hi_rate, nameplate_capacity_mw,
                so2_controls, nox_controls, pm_controls, hg_controls, program_code
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(facility_id, unit_id) DO UPDATE SET
                unit_type = COALESCE(excluded.unit_type, units.unit_type),
                primary_fuel = COALESCE(excluded.primary_fuel, units.primary_fuel),
                secondary_fuel = COALESCE(excluded.secondary_fuel, units.secondary_fuel),
                operating_status = COALESCE(excluded.operating_status, units.operating_status),
                commercial_op_date = COALESCE(excluded.commercial_op_date, units.commercial_op_date),
                max_hourly_hi_rate = COALESCE(excluded.max_hourly_hi_rate, units.max_hourly_hi_rate),
                nameplate_capacity_mw = COALESCE(excluded.nameplate_capacity_mw, units.nameplate_capacity_mw),
                so2_controls = COALESCE(excluded.so2_controls, units.so2_controls),
                nox_controls = COALESCE(excluded.nox_controls, units.nox_controls),
                pm_controls = COALESCE(excluded.pm_controls, units.pm_controls),
                hg_controls = COALESCE(excluded.hg_controls, units.hg_controls),
                program_code = COALESCE(excluded.program_code, units.program_code);
        """, list(units_map.values()))

        # 4. Upsert Annual Records
        if annual_records_map:
            cur.executemany("""
                INSERT INTO annual_records (
                    id, dataset_id, facility_id, unit_internal_id, year,
                    operating_hours, gross_generation_mwh, heat_input_mmbtu,
                    co2_mass_tons, so2_mass_tons, nox_mass_tons,
                    co2_intensity_lbs_mwh, heat_rate_mmbtu_mwh
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(unit_internal_id, year) DO UPDATE SET
                    dataset_id = excluded.dataset_id,
                    operating_hours = excluded.operating_hours,
                    gross_generation_mwh = excluded.gross_generation_mwh,
                    heat_input_mmbtu = excluded.heat_input_mmbtu,
                    co2_mass_tons = excluded.co2_mass_tons,
                    so2_mass_tons = excluded.so2_mass_tons,
                    nox_mass_tons = excluded.nox_mass_tons,
                    co2_intensity_lbs_mwh = excluded.co2_intensity_lbs_mwh,
                    heat_rate_mmbtu_mwh = excluded.heat_rate_mmbtu_mwh;
            """, list(annual_records_map.values()))

        # 5. Insert Audit Logs
        if audit_logs_list:
            cur.executemany("""
                INSERT INTO data_audit_logs (id, annual_record_id, flag_type, severity, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?);
            """, audit_logs_list)

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise e

    conn.close()

    return {
        "success": True,
        "datasetId": dataset_id,
        "datasetName": dataset_label,
        "source": source_type,
        "reportingYear": reporting_year,
        "rawRecordCount": len(rows),
        "validRecordsCount": valid_rows_count,
        "facilitiesUpserted": len(facilities_map),
        "unitsUpserted": len(units_map),
        "annualRecordsUpserted": len(annual_records_map),
        "anomaliesLogged": len(audit_logs_list)
    }

def main():
    parser = argparse.ArgumentParser(description="GridPulse Data Import & Schema Validator")
    parser.add_argument("file", help="Path to CSV or Excel file to parse")
    parser.add_argument("--db", help="Path to db.sqlite for existing duplicate checks", default=None)
    parser.add_argument("--commit", action="store_true", help="Store approved records in database")
    parser.add_argument("--dataset-name", help="Custom label for datasets entry", default=None)
    parser.add_argument("--limit", type=int, help="Preview rows limit", default=50)
    parser.add_argument("--output", help="Output JSON path (default stdout)", default=None)
    
    args = parser.parse_args()

    if not os.path.exists(args.file):
        sys.stderr.write(f"File not found: {args.file}\n")
        sys.exit(1)

    try:
        if args.commit:
            if not args.db:
                sys.stderr.write("Error: --db path is required when using --commit\n")
                sys.exit(1)
            result = commit_import_to_db(args.file, db_path=args.db, dataset_name=args.dataset_name)
        else:
            result = validate_and_report(args.file, db_path=args.db, preview_limit=args.limit)

        json_output = json.dumps(result, indent=2)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as out_f:
                out_f.write(json_output)
        else:
            print(json_output)
    except Exception as e:
        error_res = {
            "error": str(e),
            "file": args.file
        }
        print(json.dumps(error_res))
        sys.exit(1)

if __name__ == "__main__":
    main()
