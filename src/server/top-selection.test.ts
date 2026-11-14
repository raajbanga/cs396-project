import assert from "node:assert/strict";
import test from "node:test";

/**
 * A description search gives the same selection on Explore, Map, and Analyze: Top N is part of the
 * filters, so every page keeps the same facilities. Runs against the checked-in db.sqlite.
 */
process.env.DATABASE_URL ??= "file:db.sqlite";
process.env.OPENROUTER_API_KEY = ""; // the parser alone: no network
const { createCaller } = await import("~/server/api/root");
const { createTRPCContext } = await import("~/server/api/trpc");
const { analysisRows } = await import("~/server/analysis");

const api = createCaller(await createTRPCContext({ headers: new Headers() }));

const sorted = (ids: Iterable<number>) =>
  [...new Set(ids)].sort((a, b) => a - b);

/** The facilities each page shows for `text`, and the unit-years behind Explore's Units view and Analyze. */
async function pages(text: string) {
  const { filters } = await api.facilities.describeSearch({ text });
  const explore = await api.facilities.getFacilities({
    ...filters,
    pageSize: 100,
    sortBy: "co2",
    sortDir: "desc",
  });
  const map = await api.facilities.getMapFacilities(filters);
  const units = await api.facilities.getUnitYears({ ...filters, pageSize: 5 });
  const analyze = await analysisRows(filters);
  return {
    explore: sorted(explore.items.map((f) => f.id)),
    map: sorted([...map.facilities, ...map.unlocated].map((f) => f.id)),
    analyze: sorted(analyze.map((r) => r.facilityId)),
    unitYears: units.totalCount,
    analyzeUnitYears: analyze.length,
  };
}

void test("a facility Top N keeps the same facilities on every page", async () => {
  const p = await pages("top 10 facilities by CO2 in 2025");
  assert.equal(p.explore.length, 10);
  assert.deepEqual(p.map, p.explore);
  assert.deepEqual(p.analyze, p.explore);
  assert.equal(p.analyzeUnitYears, p.unitYears);
});

void test("a unit-year Top N keeps the same unit-years on every page", async () => {
  const p = await pages("top 10 units by NOx in 2024");
  assert.equal(p.unitYears, 10);
  assert.equal(p.analyzeUnitYears, 10);
  assert.deepEqual(p.map, p.explore);
  assert.deepEqual(p.analyze, p.explore);
});

void test("a per-state Top N keeps one facility per state", async () => {
  const { filters } = await api.facilities.describeSearch({
    text: "top CO2-emitting facility in each state in 2024",
  });
  const { items } = await api.facilities.getFacilities({
    ...filters,
    pageSize: 100,
    sortBy: "co2",
    sortDir: "desc",
  });
  const states = items.map((f) => f.stateCode);
  assert.equal(new Set(states).size, states.length);
  const map = await api.facilities.getMapFacilities(filters);
  assert.equal(map.facilities.length + map.unlocated.length, items.length);
});

void test("the lowest-first order keeps the smallest emitters", async () => {
  const { filters } = await api.facilities.describeSearch({
    text: "lowest 5 facilities by SO2 in 2024",
  });
  const rows = await analysisRows(filters);
  const perFacility = new Map<number, number>();
  for (const r of rows)
    perFacility.set(
      r.facilityId,
      (perFacility.get(r.facilityId) ?? 0) + (r.so2MassTons ?? 0),
    );
  assert.equal(perFacility.size, 5);
  const all = await analysisRows({ ...filters, topN: "ALL" });
  const totals = new Map<number, number>();
  for (const r of all)
    if (r.so2MassTons !== null)
      totals.set(r.facilityId, (totals.get(r.facilityId) ?? 0) + r.so2MassTons);
  const fifth = [...totals.values()].sort((a, b) => a - b)[4]!;
  for (const v of perFacility.values()) assert.ok(v <= fifth);
});
