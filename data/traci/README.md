# TRACI 2.2 characterization factors (extract)

`traci_2_2_air.csv` holds the only TRACI 2.2 factors epaData uses: emissions to air of the three
pollutants CAMPD reports (CO₂, SO₂, NOₓ). `npm run traci:import` loads it into the
`traci_factors` table.

- **Source:** US EPA, _TRACI 2.2_ workbook `traci_2_2.xlsx` (updated 3/2/2022),
  <https://www.epa.gov/system/files/documents/2024-01/traci_2_2.xlsx>, sheet `Substances`.
  Downloaded 10/30/2026; SHA-256
  `80383dec907d9c5de07aef521c2eda3fd156aaa3223e5f5e55fa0bc0d3725334`.
- **Matching:** by exact TRACI substance name, never by approximate name. CO₂ is
  `CARBON DIOXIDE` (CAS 124-38-9), SO₂ is `SULFUR DIOXIDE` (CAS 7446-09-5), and NOₓ is
  `NITROGEN OXIDES` (TRACI lists no CAS, shown as `x`). TRACI's separate `NITROGEN DIOXIDE` row
  is not used: CAMPD reports NOₓ, not NO₂, and the two rows differ for smog formation
  (24.79 vs 16.85 kg O₃ eq/kg).
- **Categories:** every non-empty air factor for those three substances. CO₂ has only global
  warming; SO₂ has no smog-formation factor; the workbook has no eutrophication column.
- Factors are per kilogram of substance. CAMPD masses are short tons, converted with
  1 short ton = 907.18474 kg before multiplying.

To rebuild the extract, download the workbook and copy the six cells named in the `source`
column; nothing else in this folder depends on the workbook.
