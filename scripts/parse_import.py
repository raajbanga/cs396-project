#!/usr/bin/env python3
"""Read a CSV/Excel upload, compare its columns to the project schema, and validate every row.

Usage: python3 scripts/parse_import.py FILE

Prints one JSON object: schema match, data-quality report (rejected rows, duplicate
facility-unit-year records, missing-value counts), a row preview, and the normalized
records to store. Physical-sanity audits and database writes happen in TypeScript
(src/server/data-import.ts) so they share code with the CAMPD sync.
"""

import csv
import json
import math
import os
import re
import sys
from collections import Counter

PREVIEW_ROWS = 50
MAX_LISTED = 500  # cap on listed errors/duplicates; counts in `summary` and `rejectedRows` stay exact

# Database column -> accepted headers, compared with case and punctuation stripped,
# so "Facility ID", "facility_id", and "facilityId" all match "facilityid".
SCHEMA = {
    "facilities": {
        "id": ["facilityid", "facilityidorispl", "orispl", "plantid"],
        "name": ["facilityname", "plantname"],
        "stateCode": ["state", "statecode"],
        "county": ["county"],
        "latitude": ["latitude", "lat"],
        "longitude": ["longitude", "lon", "long"],
        "epaRegion": ["eparegion"],
        "nercRegion": ["nercregion"],
        "sourceCategory": ["sourcecategory"],
        "ownerOperator": ["owneroperator", "owner"],
    },
    "units": {
        "unitId": ["unitid"],
        "unitType": ["unittype"],
        "primaryFuel": ["primaryfueltype", "primaryfuel", "primaryfuelinfo"],
        "secondaryFuel": ["secondaryfueltype", "secondaryfuel", "secondaryfuelinfo"],
        "operatingStatus": ["operatingstatus"],
        "commercialOpDate": ["commercialoperationdate", "commercialopdate"],
        "retirementDate": ["retirementdate", "retiredate"],
        "maxHourlyHIRate": ["maxhourlyhiratemmbtuhr", "maxhourlyhirate"],
        "nameplateCapacityMW": ["associatedgeneratorsnameplatecapacitymwe", "nameplatecapacitymw"],
        "so2Controls": ["so2controls", "so2controlinfo"],
        "noxControls": ["noxcontrols", "noxcontrolinfo"],
        "pmControls": ["pmcontrols", "pmcontrolinfo"],
        "hgControls": ["hgcontrols", "hgcontrolinfo"],
        "programCode": ["programcode", "programcodeinfo"],
    },
    "annual_records": {
        "year": ["year", "reportingyear", "opyear", "calendaryear"],
        "operatingHours": ["sumoftheoperatingtime", "operatingtime", "operatinghours", "sumoptime", "optime"],
        "grossGenerationMWh": ["grossloadmwh", "grossgenerationmwh", "grossload"],
        "heatInputMMBtu": ["heatinputmmbtu", "heatinput"],
        "steamLoadKlb": ["steamload1000lb", "steamloadklb", "steamload"],
        "co2MassTons": ["co2massshorttons", "co2shorttons", "co2masstons", "co2mass"],
        "so2MassTons": ["so2massshorttons", "so2shorttons", "so2masstons", "so2mass"],
        "noxMassTons": ["noxmassshorttons", "noxshorttons", "noxmasstons", "noxmass"],
    },
}
METRICS = [c for c in SCHEMA["annual_records"] if c != "year"]
# §7 per-year control and program information: read from the unit columns, stored on each annual record.
RECORD_ATTRIBUTES = ["so2Controls", "noxControls", "pmControls", "hgControls", "programCode"]
# Period columns of sub-annual (daily/hourly) CAMPD files. They aren't stored, but a row's identity
# includes them: a daily file has one row per unit per day, which isn't a duplicate.
PERIOD_ALIASES = {"date": ["date", "opdate", "operatingdate"], "hour": ["hour", "ophour"]}

# Numeric columns: (min, max or None, whole number?)
BOUNDS = {
    "id": (1, None, True),
    "year": (1980, 2100, True),
    "epaRegion": (1, 10, True),
    "latitude": (-90, 90, False),
    "longitude": (-180, 180, False),
    "maxHourlyHIRate": (0, None, False),
    "nameplateCapacityMW": (0, None, False),
    **{m: (0, None, False) for m in METRICS},
}

US_STATES = set(
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ "
    "NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR VI GU AS MP".split()
)


def read_rows(path):
    """Yield the header list, then one {header: text} dict per non-blank data row."""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".csv", ".tsv"):
        with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
            yield from _rows_to_dicts(csv.reader(f, delimiter="\t" if ext == ".tsv" else ","))
    elif ext in (".xlsx", ".xlsm"):
        try:
            import openpyxl
        except ImportError:
            raise ValueError("Excel support needs openpyxl: pip install -r requirements.txt")
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        yield from _rows_to_dicts([_cell_text(v) for v in row] for row in wb.active.iter_rows(values_only=True))
        wb.close()
    else:
        raise ValueError(f"Unsupported file type '{ext}'. Upload a CSV or Excel (.xlsx) file.")


def _cell_text(value):
    if value is None:
        return ""
    if hasattr(value, "isoformat"):  # Excel dates
        return value.isoformat().removesuffix("T00:00:00")
    return str(value)


def _rows_to_dicts(rows):
    cols = [(i, h.strip()) for i, h in enumerate(next(rows, [])) if h.strip()]
    yield [h for _, h in cols]
    for row in rows:
        if any(v.strip() for v in row):
            yield {h: row[i].strip() if i < len(row) else "" for i, h in cols}


def _match(headers, aliases_by_col):
    """{column: first header whose case/punctuation-stripped form is one of the column's aliases}."""
    by_key = {}
    for h in headers:
        by_key.setdefault(re.sub(r"[^a-z0-9]", "", h.lower()), h)
    return {col: h for col, aliases in aliases_by_col.items() if (h := next((by_key[a] for a in aliases if a in by_key), None))}


def map_columns(headers):
    """Match file headers to schema columns: {table: {column: header}}."""
    return {table: _match(headers, cols) for table, cols in SCHEMA.items()}


def parse_value(col, raw):
    """Convert a non-empty cell to its database value, or raise ValueError with the reason."""
    if col == "stateCode":
        if raw.upper() not in US_STATES:
            raise ValueError(f"Unrecognized US state or territory '{raw}'")
        return raw.upper()
    if col == "nameplateCapacityMW":  # EPA lists generators as "1 (153.1), 2 (153.1)"
        parts = re.findall(r"\((\d+(?:\.\d+)?)\)", raw)
        if parts:
            return round(sum(map(float, parts)), 2)
    if col not in BOUNDS:
        return raw
    lo, hi, whole = BOUNDS[col]
    try:
        n = float(raw.replace(",", ""))
    except ValueError:
        n = math.nan
    if not math.isfinite(n):
        raise ValueError(f"Expected a number, got '{raw}'")
    if whole and not n.is_integer():
        raise ValueError(f"Expected a whole number, got '{raw}'")
    if n < lo or (hi is not None and n > hi):
        raise ValueError(f"Out of range ({lo} to {hi})" if hi is not None else f"Must be at least {lo}")
    return int(n) if whole else n


def parse(path):
    rows = read_rows(path)
    headers = next(rows)
    cols = map_columns(headers)
    year_header = cols["annual_records"].get("year")
    is_annual = year_header is not None and any(m in cols["annual_records"] for m in METRICS)
    period_headers = [] if is_annual else list(_match(headers, PERIOD_ALIASES).values())
    if not is_annual:
        cols["annual_records"] = {}  # metrics without a year (daily/hourly files) aren't annual records

    if "id" not in cols["facilities"] or "unitId" not in cols["units"]:
        schema = "UNRECOGNIZED"
    else:
        schema = "ANNUAL_EMISSIONS" if is_annual else "FACILITIES_AND_UNITS"
    required = {("facilities", "id"), ("units", "unitId")}
    required |= {("annual_records", "year")} if is_annual else {("facilities", "name"), ("facilities", "stateCode")}

    mappings = [
        {"fileColumn": h, "targetTable": t, "targetColumn": c, "required": (t, c) in required}
        for t, mapping in cols.items()
        for c, h in mapping.items()
    ]
    mapped_headers = {m["fileColumn"] for m in mappings}

    missing = Counter()
    status_counts = Counter()
    years = Counter()
    errors, duplicates, preview, rejected = [], [], [], []
    first_seen, facilities, units, annual = {}, {}, {}, []
    total = 0

    for total, row in enumerate(rows, 1):
        missing.update(h for h, v in row.items() if not v)
        values, issues = {}, []
        for table, mapping in cols.items():
            values[table] = {}
            for col, header in mapping.items():
                raw = row[header]
                if not raw:
                    values[table][col] = None
                    if (table, col) in required:
                        issues.append({"field": header, "value": "", "reason": "Missing required value"})
                    continue
                try:
                    values[table][col] = parse_value(col, raw)
                except ValueError as e:
                    issues.append({"field": header, "value": raw, "reason": str(e)})

        fid, uid = values["facilities"].get("id"), values["units"].get("unitId")
        if is_annual:
            year = values["annual_records"].get("year")
        else:  # a facility file's year, or the year of a daily/hourly row's date
            year = row.get(year_header, "") or next((row[h][:4] for h in period_headers if row[h][:4].isdigit()), "")
        key = (fid, uid, year, *(row[h] for h in period_headers))
        if schema == "UNRECOGNIZED" or issues:
            status = "invalid"
            ids = {"facilityId": row.get(cols["facilities"].get("id"), ""), "unitId": row.get(cols["units"].get("unitId"), "")}
            errors.extend({"rowNumber": total, **ids, **issue} for issue in issues[: MAX_LISTED - len(errors)])
            reason = "; ".join(f"{i['field']}: {i['reason']}" for i in issues) or "Columns don't match the project schema"
            rejected.append({"rowNumber": total, "kind": "REJECTED", "reason": reason, "data": row})
        elif key in first_seen:
            status = "duplicate"
            what = "facility-unit-period" if period_headers else "facility-unit-year"
            reason = f"Same {what} as row {first_seen[key]}; skipped"
            if len(duplicates) < MAX_LISTED:
                duplicates.append({
                    "rowNumber": total, "firstSeenRow": first_seen[key], "facilityId": fid, "unitId": uid,
                    "year": year or None, "reason": reason,
                })
            rejected.append({"rowNumber": total, "kind": "DUPLICATE", "reason": reason, "data": row})
        else:
            status = "valid"
            first_seen[key] = total
            years[str(year)] += 1
            facilities.setdefault(fid, values["facilities"])
            units.setdefault((fid, uid), {**values["units"], "facilityId": fid})
            if is_annual:
                # Blank metrics stay None (not reported), distinct from a reported 0. Attribute keys are
                # included only when the file has the column, so records without them inherit the unit's.
                metrics = {m: values["annual_records"].get(m) for m in METRICS}
                attributes = {a: values["units"][a] for a in RECORD_ATTRIBUTES if a in cols["units"]}
                annual.append({**metrics, **attributes, "rowNumber": total, "facilityId": fid, "unitId": uid, "year": year})
        status_counts[status] += 1
        if total <= PREVIEW_ROWS:
            preview.append({"rowNumber": total, "status": status, "data": row})

    top_year = years.most_common(1)
    return {
        "targetSchema": schema,
        "destinationTables": [] if schema == "UNRECOGNIZED"
        else ["datasets", "facilities", "units"] + (["annual_records", "data_audit_logs"] if is_annual else []),
        "availableColumns": headers,
        "tableMappings": mappings,
        "periodColumns": period_headers,  # Date/Hour of a daily or hourly file; empty otherwise
        "missingRequired": [{"table": t, "column": c} for t, c in sorted(required) if c not in cols[t]],
        "unmappedColumns": [h for h in headers if h not in mapped_headers],
        "missingValueCounts": {h: missing[h] for h in headers},
        "reportingYear": int(top_year[0][0]) if top_year and top_year[0][0].isdigit() else None,
        "summary": {
            "totalRows": total,
            "validCount": status_counts["valid"],
            "invalidCount": status_counts["invalid"],
            "duplicateCount": status_counts["duplicate"],
        },
        "validationErrors": errors,
        "duplicates": duplicates,
        "previewRows": preview,
        "rejectedRows": rejected,
        "records": {"facilities": list(facilities.values()), "units": list(units.values()), "annual": annual},
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    try:
        json.dump(parse(sys.argv[1]), sys.stdout)
    except (OSError, ValueError, csv.Error) as e:
        sys.exit(str(e))
