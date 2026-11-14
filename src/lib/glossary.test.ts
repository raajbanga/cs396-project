import assert from "node:assert/strict";
import test from "node:test";
import { define, glossSegments } from "./glossary";

void test("table headers find their definition", () => {
  assert.match(define("Test MAE (t)")!, /Mean absolute error/);
  assert.match(define("MAPE")!, /percentage/);
  assert.equal(define("Facility"), undefined);
});

void test("terms in running text are marked once, in order", () => {
  const parts = glossSegments(
    "A strong link (r = 0.72) on log scales; the median and the median again.",
  );
  const marked = parts.filter((p) => p.definition).map((p) => p.text);
  assert.deepEqual(marked, ["r = 0.72", "log scales", "median"]);
  assert.equal(
    parts.map((p) => p.text).join(""),
    "A strong link (r = 0.72) on log scales; the median and the median again.",
  );
  assert.deepEqual(glossSegments("Nothing to define."), [
    { text: "Nothing to define." },
  ]);
});

void test("a shared seen set marks each term once across sentences", () => {
  const seen = new Set<string>();
  const marked = (t: string) =>
    glossSegments(t, seen)
      .filter((p) => p.definition)
      .map((p) => p.text);
  assert.deepEqual(marked("The median is 5."), ["median"]);
  assert.deepEqual(marked("The median of the rest is 3."), []);
});
