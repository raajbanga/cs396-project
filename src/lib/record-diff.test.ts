import assert from "node:assert/strict";
import test from "node:test";

import { emptyTotals } from "./emissions-metrics";
import {
  countDiff,
  diffRecord,
  emptyDiffCounts,
  recordKey,
} from "./record-diff";

const stored = {
  ...emptyTotals(),
  co2MassTons: 80614.43,
  operatingHours: 5000,
};

void test("diffRecord: nothing stored is new", () => {
  assert.deepEqual(diffRecord(stored), { status: "new", changes: [] });
});

void test("diffRecord: identical values (and float noise) are unchanged", () => {
  assert.equal(diffRecord({ ...stored }, stored).status, "unchanged");
  assert.equal(
    diffRecord({ ...stored, co2MassTons: 80614.43 + 1e-9 }, stored).status,
    "unchanged",
  );
});

void test("diffRecord: lists every changed metric with both values", () => {
  const { status, changes } = diffRecord(
    { ...stored, co2MassTons: 79614.43, operatingHours: 5001 },
    stored,
  );
  assert.equal(status, "changed");
  assert.deepEqual(changes, [
    { field: "operatingHours", database: 5000, incoming: 5001 },
    { field: "co2MassTons", database: 80614.43, incoming: 79614.43 },
  ]);
});

void test("countDiff tallies statuses; recordKey is the natural key", () => {
  const counts = (["new", "changed", "unchanged", "new"] as const).reduce(
    countDiff,
    emptyDiffCounts(),
  );
  assert.deepEqual(counts, { inserted: 2, updated: 1, unchanged: 1 });
  assert.equal(recordKey(3, "1", 2025), "3:1:2025");
});
