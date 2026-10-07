import assert from "node:assert/strict";
import test from "node:test";
import { csvField, exportUrl, toCsv } from "./csv";

void test("csvField quotes commas, quotes, and line breaks", () => {
  assert.equal(csvField("Coal"), "Coal");
  assert.equal(csvField("Coal, Natural Gas"), '"Coal, Natural Gas"');
  assert.equal(csvField('Unit "A"'), '"Unit ""A"""');
  assert.equal(csvField("line 1\nline 2"), '"line 1\nline 2"');
  assert.equal(csvField("cr\rlf"), '"cr\rlf"');
  assert.equal(csvField(null), "");
  assert.equal(csvField(undefined), "");
  assert.equal(csvField(0), "0");
  assert.equal(csvField(12.5), "12.5");
  assert.equal(csvField(false), "false");
  assert.equal(
    csvField(new Date("2026-10-06T12:00:00Z")),
    "2026-10-06T12:00:00.000Z",
  );
  assert.equal(
    csvField({ year: 2024, stateCode: "KY" }),
    '"{""year"":2024,""stateCode"":""KY""}"',
  );
});

void test("toCsv writes a header and one CRLF line per row", () => {
  const rows = [
    { id: 3, name: "Barry", fuel: "Coal, Natural Gas" },
    { id: 7, name: 'The "Big" One', fuel: null },
  ];
  const csv = toCsv(rows, [
    ["facility_id", (r) => r.id],
    ["facility_name", (r) => r.name],
    ["primary_fuel", (r) => r.fuel],
  ]);
  assert.equal(
    csv,
    'facility_id,facility_name,primary_fuel\r\n3,Barry,"Coal, Natural Gas"\r\n7,"The ""Big"" One",\r\n',
  );
  assert.equal(toCsv([], [["a", () => 1]]), "a\r\n");
});

void test("exportUrl drops empty params and appends an explorer query", () => {
  assert.equal(exportUrl("provenance"), "/api/export?type=provenance");
  assert.equal(
    exportUrl("dataset", { id: "abc", ids: "" }),
    "/api/export?type=dataset&id=abc",
  );
  assert.equal(
    exportUrl("search", {}, "tab=units&stateCode=KY"),
    "/api/export?type=search&tab=units&stateCode=KY",
  );
});
