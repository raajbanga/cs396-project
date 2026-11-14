import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";

import { buildVariables, variableInfo } from "./analysis";
import {
  analyzeMetadata,
  datasetMetadata,
  downloadMetadata,
  missingMetadata,
  modelMetadata,
  predictMetadata,
  zipBundle,
  type ExportMetadata,
  type ModelRecord,
  type Provenance,
} from "./export-bundle";
import type { TraciFactor } from "./traci";

/** Phase 2 §7: what each export's metadata.json must contain to be reproducible. */

const source: Provenance = {
  software: { name: "epaData", version: "0.1.0", commit: "abc1234" },
  database: {
    unitYears: 57_414,
    datasets: 153,
    lastImport: new Date("2026-10-30T12:00:00Z"),
  },
};

/** The committed TRACI extract, as the import script reads it. */
const [header, ...lines] = readFileSync("data/traci/traci_2_2_air.csv", "utf8")
  .trim()
  .split(/\r?\n/)
  .map((l) => l.split(","));
const factors: TraciFactor[] = lines.map((cells) => {
  const r = Object.fromEntries(header!.map((h, i) => [h, cells[i]!]));
  return {
    traciVersion: r.traci_version!,
    pollutant: r.pollutant!,
    substance: r.substance!,
    cas: r.cas!,
    impactCategory: r.impact_category!,
    factor: Number(r.factor),
    factorUnit: r.factor_unit!,
  };
});
const variables = buildVariables(factors).map(variableInfo);

/** The registered models as the `models` table holds them, from the committed metrics.json. */
const report = JSON.parse(readFileSync("ml/models/metrics.json", "utf8")) as {
  models: Record<string, { settings: Record<string, unknown> }>;
  features: string[];
  target: string;
  train_years: string;
  validation_years: string;
  test_years: string;
  pipeline_version: string;
  trained_at: string;
};
const models: ModelRecord[] = Object.entries(report.models).map(([id, m]) => ({
  id,
  name: id,
  target: report.target,
  features: report.features,
  params: m.settings,
  trainYears: report.train_years,
  validationYears: report.validation_years,
  testYears: report.test_years,
  metrics: {},
  artifactPath: `ml/models/${id}.joblib`,
  pipelineVersion: report.pipeline_version,
  trainedAt: report.trained_at,
}));

/** A browser download: the page's context, the chart's own fields, then the download's. */
const download = (page: ExportMetadata, meta: ExportMetadata) =>
  downloadMetadata(
    "chart",
    { title: "A chart", ...page, ...meta },
    "http://localhost:3000/x",
    true,
  );

void test("zipBundle: CSV, metadata.json, and the PNG, readable back", () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  const files = unzipSync(
    zipBundle(
      "trend",
      { head: ["year", "co2 (t)"], rows: [[2024, 1.5]] },
      { title: "Trend", filters: { state: "KY" } },
      png,
    ),
  );
  assert.deepEqual(Object.keys(files).sort(), [
    "metadata.json",
    "trend.csv",
    "trend.png",
  ]);
  assert.match(strFromU8(files["trend.csv"]!), /^year,co2 \(t\)\r?\n2024,1\.5/);
  assert.deepEqual(JSON.parse(strFromU8(files["metadata.json"]!)), {
    title: "Trend",
    filters: { state: "KY" },
  });
  assert.deepEqual(files["trend.png"], png);
});

void test("downloadMetadata: date, page URL, and the files in the ZIP", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  const meta = downloadMetadata(
    "x",
    { title: "X" },
    "http://h/p?a=1",
    false,
    now,
  );
  assert.equal(meta.exportedAt, "2026-11-12T10:00:00.000Z");
  assert.equal(meta.url, "http://h/p?a=1");
  assert.deepEqual(meta.files, ["x.csv"]);
  assert.deepEqual(downloadMetadata("x", {}, "", true, now).files, [
    "x.csv",
    "x.png",
  ]);
});

void test("Analyze chart exports carry every §7 field", () => {
  const page = analyzeMetadata(
    source,
    { yearMin: "2015", state: "KY" },
    {
      tab: "overview",
    },
  );
  const noxRate = variables.find((v) => v.key === "noxRate")!;
  const impacts = variables.filter((v) => v.group === "TRACI impact");
  for (const meta of [
    { variables: [noxRate] },
    { variables: impacts, traciFactors: factors },
  ]) {
    assert.deepEqual(missingMetadata(download(page, meta)), []);
  }
  // Default filters are an empty object, which still records the selection.
  assert.deepEqual(
    missingMetadata(
      download(analyzeMetadata(source, {}, {}), { variables: [noxRate] }),
    ),
    [],
  );
});

void test("the analytical dataset export carries every §7 field", () => {
  const meta = datasetMetadata({
    source,
    filters: { yearMin: "2015", yearMax: "2025" },
    unitYears: 46_988,
    variables,
    factors,
  });
  assert.deepEqual(missingMetadata(meta), []);
  assert.equal((meta.variables as unknown[]).length, variables.length);
  assert.ok(
    (meta.variables as { definition: string }[]).every((v) => v.definition),
  );
});

void test("Predict exports carry every §7 field for each model", () => {
  const page = predictMetadata(source, { tab: "whatif" }, models);
  assert.deepEqual(missingMetadata(download(page, {})), []);
  // The Models tab's own download lists every model the same way.
  assert.deepEqual(
    missingMetadata(download(page, { models: models.map(modelMetadata) })),
    [],
  );
  const m = modelMetadata(models[0]!);
  assert.equal(m.fitYears, "2016-2023");
  assert.equal(m.testYears, "2024-2025");
  assert.match(m.pipeline, /^git [0-9a-f]{7}; Python /);
});

void test("missingMetadata names each §7 item that is left out", () => {
  const page = predictMetadata(source, {}, models);
  const full = download(page, {});
  const without = (patch: ExportMetadata) =>
    missingMetadata({ ...full, ...patch });
  assert.deepEqual(without({ exportedAt: undefined }), ["Analysis date"]);
  assert.deepEqual(without({ database: undefined }), ["Dataset identifier"]);
  assert.deepEqual(without({ software: "0.1.0" }), [
    "Software or pipeline version",
  ]);
  assert.deepEqual(without({ models: [] }), [
    "Model name, features, and parameters",
  ]);
  const [first] = page.models as ReturnType<typeof modelMetadata>[];
  assert.deepEqual(without({ models: [{ ...first, testYears: "" }] }), [
    "Training and testing periods",
  ]);
  assert.deepEqual(without({ models: [{ ...first, pipeline: undefined }] }), [
    "Software or pipeline version",
  ]);

  const analysis = download(analyzeMetadata(source, {}, {}), {
    variables: [variables[0]],
  });
  assert.deepEqual(missingMetadata({ ...analysis, filters: undefined }), [
    "Selected filters and variables",
  ]);
  assert.deepEqual(
    missingMetadata({
      ...analysis,
      variables: [{ ...variables[0], definition: "" }],
    }),
    ["Definitions of derived indicators"],
  );
});
