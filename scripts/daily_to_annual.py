"""Rolls a CAMPD daily emissions CSV up to annual unit-year totals, written to stdout in the
annual-emissions column layout that parse_import.py reads.

Masses, heat input, load and operating time are summed over the year; a metric blank on every
day stays blank (not reported). Rates are left out: the importer derives them from the totals.
Unit attributes (fuels, unit type, controls, programs) take the last non-blank value of the year.

Usage: python3 scripts/daily_to_annual.py emissions-daily-1997-al.csv > annual.csv
"""

import csv
import sys

KEY = ["State", "Facility Name", "Facility ID", "Unit ID", "Associated Stacks"]
SUMMED = [
    "Operating Time Count",
    "Sum of the Operating Time",
    "Gross Load (MWh)",
    "Steam Load (1000 lb)",
    "SO2 Mass (short tons)",
    "CO2 Mass (short tons)",
    "NOx Mass (short tons)",
    "Heat Input (mmBtu)",
]
ATTRIBUTES = [
    "Primary Fuel Type",
    "Secondary Fuel Type",
    "Unit Type",
    "SO2 Controls",
    "NOx Controls",
    "PM Controls",
    "Hg Controls",
    "Program Code",
]


def main(path: str) -> None:
    units: dict[tuple[str, str, str], dict] = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            year = row["Date"][:4]
            key = (row["Facility ID"], row["Unit ID"], year)
            unit = units.setdefault(
                key, {**{k: row[k] for k in KEY}, "Year": year, **{m: None for m in SUMMED}}
            )
            for m in SUMMED:
                if row.get(m, "").strip():
                    unit[m] = (unit[m] or 0.0) + float(row[m])
            for a in ATTRIBUTES:
                if row.get(a, "").strip():
                    unit[a] = row[a]
            if row["Associated Stacks"].strip():
                unit["Associated Stacks"] = row["Associated Stacks"]

    out = csv.DictWriter(
        sys.stdout, fieldnames=KEY + ["Year"] + SUMMED + ATTRIBUTES, quoting=csv.QUOTE_NONNUMERIC
    )
    out.writeheader()
    for unit in units.values():
        out.writerow({k: ("" if v is None else round(v, 3) if isinstance(v, float) else v) for k, v in unit.items()})


if __name__ == "__main__":
    main(sys.argv[1])
