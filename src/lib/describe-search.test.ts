import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAmount,
  parseDescription,
  type ParsedDescription,
  type SearchVocab,
} from "./describe-search";

/** The database's filter vocabulary (getFilterOptions, 2026-10-09). */
const vocab: SearchVocab = {
  states:
    "AK AL AR AZ CA CO CT DC DE FL GA HI IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY OH OK OR PA PR RI SC SD TN TX UT VA VT WA WI WV WY".split(
      " ",
    ),
  fuels: [
    "Coal",
    "Coal Refuse",
    "Diesel Oil",
    "Natural Gas",
    "Other Gas",
    "Other Oil",
    "Other Solid Fuel",
    "Petroleum Coke",
    "Pipeline Natural Gas",
    "Process Gas",
    "Residual Oil",
    "Tire Derived Fuel",
    "Wood",
  ],
  secondaryFuels: ["Diesel Oil", "Natural Gas", "Pipeline Natural Gas"],
  unitTypes: [
    "Bubbling fluidized bed boiler",
    "Cement Kiln",
    "Combined cycle",
    "Combustion turbine",
    "Cyclone boiler",
    "Dry bottom wall-fired boiler",
    "Stoker",
    "Tangentially-fired",
  ],
  so2Controls: ["Dry Lime FGD", "Wet Lime FGD", "Wet Limestone", "Other"],
  noxControls: [
    "Low NOx Burner Technology",
    "Selective Catalytic Reduction",
    "Selective Non-catalytic Reduction",
    "Overfire Air",
    "Other",
  ],
  pmControls: ["Baghouse", "Cyclone", "Electrostatic Precipitator", "Other"],
  operatingStatuses: [
    "Future",
    "Long-term Cold Storage",
    "Operating",
    "Retired",
  ],
  counties: [
    { county: "Jefferson County", stateCode: "KY" },
    { county: "Washington County", stateCode: "PA" },
    { county: "St. Clair County", stateCode: "MI" },
  ],
};

const parse = (text: string) => parseDescription(text, vocab);

/** Asserts the parsed filters contain `filters` (and optionally the tab/sort/qualitative/unrecognized). */
function expect(
  text: string,
  filters: ParsedDescription["filters"],
  extra: Partial<Omit<ParsedDescription, "filters">> = {},
) {
  const got = parse(text);
  assert.deepEqual(got.filters, filters, `filters for "${text}"`);
  for (const [key, value] of Object.entries(extra)) {
    assert.deepEqual(
      got[key as keyof ParsedDescription],
      value,
      `${key} for "${text}"`,
    );
  }
  return got;
}

const KY_COAL_2025_CO2 = {
  stateCode: "KY",
  primaryFuel: "Coal",
  year: "2025",
  co2MassTonsMin: "500000",
  co2MassTonsMinStrict: "1",
};

void test("rubric example: coal units in Kentucky with high CO2", () => {
  expect(
    "Find coal units in Kentucky with high CO2 emissions.",
    { stateCode: "KY", primaryFuel: "Coal" },
    {
      tab: "units",
      qualitative: [{ metric: "co2MassTons", level: "high" }],
      unrecognized: [],
    },
  );
});

void test("spec example and word-order permutations give the same filters", () => {
  for (const text of [
    "Find coal-fired units in Kentucky in 2025 with annual CO2 emissions greater than 500,000 short tons",
    "KY + Coal + 2025 + CO2 > 500,000",
    "2025 kentucky coal units co2 over 500k",
    "units burning coal in KY, more than 500k tons of CO₂, 2025",
  ]) {
    expect(text, KY_COAL_2025_CO2, { unrecognized: [] });
  }
  expect(
    "co2 >= 5e5 tons for Kentucky coal units in 2025",
    {
      stateCode: "KY",
      primaryFuel: "Coal",
      year: "2025",
      co2MassTonsMin: "500000",
    },
    { unrecognized: [] },
  );
});

void test("ranges: less-than, between, units of measure pick the metric", () => {
  expect("units with SO2 < 500 tons", {
    so2MassTonsMax: "500",
    so2MassTonsMaxStrict: "1",
  });
  expect("gross load between 100,000 and 1,000,000 MWh", {
    grossGenerationMWhMin: "100000",
    grossGenerationMWhMax: "1000000",
  });
  const over = (key: string, value: string) => ({
    [key]: value,
    [`${key}Strict`]: "1",
  });
  expect("heat input > 5,000,000 MMBtu", over("heatInputMMBtuMin", "5000000"));
  expect("operating time over 5000 hours", over("operatingHoursMin", "5000"));
  expect(
    "units that ran more than 5,000 hrs",
    over("operatingHoursMin", "5000"),
  );
  expect(
    "plants generating over 1.2M MWh",
    over("grossGenerationMWhMin", "1200000"),
  );
  expect("more than 500,000 tons", over("co2MassTonsMin", "500000"));
  expect("CO2 above 1 million and NOx under 200", {
    ...over("co2MassTonsMin", "1000000"),
    ...over("noxMassTonsMax", "200"),
  });
});

void test("rubric §5 operators: at least / at most stay inclusive, strict years shift by one", () => {
  expect("CO2 at least 1 million tons", { co2MassTonsMin: "1000000" });
  expect("NOx ≤ 200 tons", { noxMassTonsMax: "200" });
  expect("no more than 50 tons SO2", { so2MassTonsMax: "50" });
  expect("years greater than 2020", { yearMin: "2021" });
  expect("years at least 2020", { yearMin: "2020" });
  expect("years less than 2018", { yearMax: "2017" });
});

void test("ranking: top-N, bottom-N, per state, singular = 1", () => {
  expect(
    "Top 10 facilities by CO2 emissions",
    { topN: "10" },
    { tab: "explorer", sort: { by: "co2MassTons", dir: "desc" } },
  );
  expect(
    "top 20 units by gross generation",
    { topN: "20" },
    { tab: "units", sort: { by: "grossGenerationMWh", dir: "desc" } },
  );
  expect(
    "Units with the lowest SO2 emissions",
    { topN: "10" },
    { sort: { by: "so2MassTons", dir: "asc" } },
  );
  expect(
    "Top CO2-emitting facility in each state",
    { topN: "1", rankGroup: "state" },
    { tab: "explorer", sort: { by: "co2MassTons", dir: "desc" } },
  );
  expect(
    "Top 10 coal units in Kentucky",
    { topN: "10", primaryFuel: "Coal", stateCode: "KY" },
    { tab: "units" },
  );
  expect(
    "Highest-generation natural-gas units",
    { topN: "10", primaryFuel: "Natural Gas" },
    { sort: { by: "grossGenerationMWh", dir: "desc" } },
  );
  expect("the 5 largest plants", { topN: "5" });
});

void test("facilities view switches to units when sorting by a non-CO2 metric", () => {
  expect(
    "plants with the highest NOx",
    { topN: "10" },
    { tab: "units", sort: { by: "noxMassTons", dir: "desc" } },
  );
});

void test("years: single, ranges, since/before", () => {
  expect("unit 1 at facility 3 from 2015 to 2025", {
    unitId: "1",
    facilityId: "3",
    yearMin: "2015",
    yearMax: "2025",
  });
  expect("plant #1378 2015-2025", {
    facilityId: "1378",
    yearMin: "2015",
    yearMax: "2025",
  });
  expect("coal units since 2020", { primaryFuel: "Coal", yearMin: "2020" });
  expect("gas units before 2018", {
    primaryFuel: "Natural Gas",
    yearMax: "2017",
  });
  expect("between 2016 and 2019", { yearMin: "2016", yearMax: "2019" });
});

void test("synonyms, controls, unit types, status, secondary fuel", () => {
  expect("gas peakers in Texas", {
    primaryFuel: "Natural Gas",
    unitType: "Combustion turbine",
    stateCode: "TX",
  });
  expect("combined cycle units with SCR", {
    unitType: "Combined cycle",
    noxControl: "Selective Catalytic Reduction",
  });
  expect("coal boilers with scrubbers and a baghouse", {
    primaryFuel: "Coal",
    unitType: "boiler",
    so2Control: "FGD",
    pmControl: "Baghouse",
  });
  expect("tangentially-fired units with low NOx burners", {
    unitType: "Tangentially-fired",
    noxControl: "Low NOx Burner",
  });
  expect("retired coal units", {
    operatingStatus: "Retired",
    primaryFuel: "Coal",
  });
  expect("units with natural gas as secondary fuel", {
    secondaryFuel: "Natural Gas",
  });
  expect("pipeline natural gas units", { primaryFuel: "Pipeline Natural Gas" });
});

void test("states: names, multi-word names, codes, ambiguous lowercase codes", () => {
  expect("coal plants in West Virginia", {
    primaryFuel: "Coal",
    stateCode: "WV",
  });
  expect("units in new york", { stateCode: "NY" });
  expect("tx gas units", { stateCode: "TX", primaryFuel: "Natural Gas" });
  expect("coal units IN 2024", {
    stateCode: "IN",
    primaryFuel: "Coal",
    year: "2024",
  });
  expect("coal units in 2024", { primaryFuel: "Coal", year: "2024" });
  expect("plants in Washington County", { county: "Washington County" });
  expect("plants in St. Clair County", { county: "St. Clair County" });
  expect("units in Washington", { stateCode: "WA" });
});

void test("owner and plant names go to the text search", () => {
  expect("coal units owned by Duke Energy in Ohio", {
    primaryFuel: "Coal",
    search: "Duke Energy",
    stateCode: "OH",
  });
  expect("plants operated by Tennessee Valley Authority", {
    search: "Tennessee Valley Authority",
  });
  expect("the plant named Gavin, 2024", { search: "Gavin", year: "2024" });
});

void test("typos are tolerated for filter values", () => {
  expect("coal units in Kentuky", { primaryFuel: "Coal", stateCode: "KY" });
  expect("units in Pensylvania", { stateCode: "PA" });
});

void test("unknown words and negation are reported, not guessed", () => {
  expect(
    "coal units with odd ratios",
    { primaryFuel: "Coal" },
    { unrecognized: ["odd", "ratios"] },
  );
  expect("units not burning coal", {}, { unrecognized: ["not coal"] });
  expect(
    "Compare units from different facilities",
    {},
    { unrecognized: ["Compare", "different"] },
  );
});

void test("parseAmount handles separators, suffixes, and exponents", () => {
  assert.equal(parseAmount("500,000"), 500000);
  assert.equal(parseAmount("500k"), 500000);
  assert.equal(parseAmount("1.2M"), 1200000);
  assert.equal(parseAmount("1.2 million"), 1200000);
  assert.equal(parseAmount("5e5"), 500000);
  assert.equal(parseAmount("coal"), undefined);
});
