"""Phase 2 prediction module: annual NOx mass (short tons) per unit-year.

Trains a baseline and two models on a chronological split of db.sqlite, prints and saves their
metrics (with bootstrap confidence intervals on the test years) next to a persistence reference
("same NOx rate as last year", reported but not registered), and registers the models in the
`models` table with everything the web app needs to predict without Python (preprocessing,
coefficients or tree arrays, training ranges).

    epaDataVENV/bin/python ml/train.py          # or: npm run ml:train

Outputs: ml/models/<id>.json and .joblib, ml/models/metrics.json, ml/fixtures/parity.json (a
sample the TypeScript test replays to check the app predicts exactly what scikit-learn does).
"""

from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.tree import DecisionTreeRegressor

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "db.sqlite"
MODELS = ROOT / "ml" / "models"
FIXTURES = ROOT / "ml" / "fixtures"

TARGET = "nox_mass_tons"
TRAIN = (2016, 2021)
VALIDATION = (2022, 2023)
TEST = (2024, 2025)

# Same-year activity: what a unit burned and generated. Kept (scenarios change them) but the
# ablation shows how much of the score they carry.
ACTIVITY = ["heat_input_mmbtu", "gross_load_mwh", "operating_hours"]
NUMERIC = [
    *ACTIVITY,
    "nameplate_mw",
    "unit_age",
    "prior_nox_rate",
    "prior_operating_hours",
]
LOGGED = {"heat_input_mmbtu", "gross_load_mwh", "nameplate_mw"}
CATEGORICAL = ["primary_fuel", "unit_type"]
CONTROLS = {
    "scr": r"selective catalytic",
    "sncr": r"non-catalytic",
    "low_nox_burner": r"low nox",
    "injection": r"water injection|steam injection|ammonia injection",
    "overfire_air": r"overfire|ofa",
}
MIN_CATEGORY_ROWS = 30
RIDGE_ALPHAS = [0.01, 0.1, 1, 10, 100]
TREE_DEPTHS = [4, 6, 8, 10, 12, 16, 20, 24, None]  # None: grow until the leaf-size limit
TREE_LEAVES = [5, 20, 50]
BOOTSTRAP_SAMPLES = 1000

QUERY = """
SELECT a.unit_internal_id, a.year, a.facility_id, f.name AS facility_name, u.unit_id,
       u.primary_fuel, u.unit_type, u.nameplate_capacity_mw, u.commercial_op_date,
       a.operating_hours, a.gross_generation_mwh, a.heat_input_mmbtu, a.nox_controls,
       a.nox_mass_tons, p.nox_mass_tons AS prev_nox_mass_tons,
       p.heat_input_mmbtu AS prev_heat_input_mmbtu, p.operating_hours AS prev_operating_hours
FROM annual_records a
JOIN units u ON u.id = a.unit_internal_id
JOIN facilities f ON f.id = a.facility_id
LEFT JOIN annual_records p ON p.unit_internal_id = a.unit_internal_id AND p.year = a.year - 1
WHERE a.year BETWEEN ? AND ? AND a.nox_mass_tons IS NOT NULL
"""


def model_inputs(raw: pd.DataFrame) -> pd.DataFrame:
    """Raw unit-year columns -> model inputs. Mirrors `modelInputs` in src/lib/model.ts."""
    out = pd.DataFrame(index=raw.index)
    out["heat_input_mmbtu"] = raw["heat_input_mmbtu"]
    out["gross_load_mwh"] = raw["gross_generation_mwh"]
    out["operating_hours"] = raw["operating_hours"]
    out["nameplate_mw"] = raw["nameplate_capacity_mw"]
    cod_year = pd.to_numeric(raw["commercial_op_date"].str[:4], errors="coerce")
    out["unit_age"] = (raw["year"] - cod_year).clip(lower=0)
    prev_heat = raw["prev_heat_input_mmbtu"]
    out["prior_nox_rate"] = np.where(
        prev_heat > 0, raw["prev_nox_mass_tons"] * 2000 / prev_heat, np.nan
    )
    out["prior_operating_hours"] = raw["prev_operating_hours"]
    out["primary_fuel"] = raw["primary_fuel"].fillna("Not reported")
    out["unit_type"] = raw["unit_type"].fillna("Not reported")
    controls = raw["nox_controls"].fillna("").str.lower()
    for name, pattern in CONTROLS.items():
        out[name] = controls.str.contains(pattern, regex=True).astype(float)
    return out


def fit_spec(inputs: pd.DataFrame, numeric: list[str]) -> dict:
    """Preprocessing learned on training rows: medians, log flags, scaling, categories."""
    spec = {"numeric": [], "categorical": [], "binary": list(CONTROLS)}
    for name in numeric:
        col = inputs[name].astype(float)
        median = float(col.median())
        values = transform_numeric(col.fillna(median), name in LOGGED)
        spec["numeric"].append(
            {
                "name": name,
                "log": name in LOGGED,
                "median": median,
                "mean": float(values.mean()),
                "scale": float(values.std(ddof=0)) or 1.0,
                "min": float(col.min()),
                "max": float(col.max()),
            }
        )
    for name in CATEGORICAL:
        counts = inputs[name].value_counts()
        spec["categorical"].append(
            {"name": name, "categories": sorted(counts[counts >= MIN_CATEGORY_ROWS].index)}
        )
    return spec


def transform_numeric(col: pd.Series, log: bool) -> pd.Series:
    return np.log1p(col.clip(lower=0)) if log else col


def design_matrix(inputs: pd.DataFrame, spec: dict) -> np.ndarray:
    """Mirrors `designRow` in src/lib/model.ts: impute, log, standardize, one-hot, controls."""
    columns = []
    for f in spec["numeric"]:
        col = transform_numeric(inputs[f["name"]].astype(float).fillna(f["median"]), f["log"])
        columns.append((col - f["mean"]) / f["scale"])
    for f in spec["categorical"]:
        for category in f["categories"]:
            columns.append((inputs[f["name"]] == category).astype(float))
    for name in spec["binary"]:
        columns.append(inputs[name].astype(float))
    return np.column_stack(columns)


def feature_names(spec: dict) -> list[str]:
    return (
        [f["name"] for f in spec["numeric"]]
        + [f"{f['name']}={c}" for f in spec["categorical"] for c in f["categories"]]
        + spec["binary"]
    )


def metrics(y: np.ndarray, pred: np.ndarray) -> dict:
    big = y >= 1  # MAPE only where the target is at least 1 ton: near-zero tons explode it
    return {
        "mae": float(mean_absolute_error(y, pred)),
        "rmse": float(np.sqrt(mean_squared_error(y, pred))),
        "r2": float(r2_score(y, pred)),
        "mape": float(np.mean(np.abs((y[big] - pred[big]) / y[big])) * 100),
        "n": int(len(y)),
    }


class Baseline:
    """Median NOx of the training rows with the same primary fuel and unit type."""

    def fit(self, inputs: pd.DataFrame, y: np.ndarray):
        frame = inputs[CATEGORICAL].assign(y=y)
        self.overall = float(np.median(y))
        self.table = {
            f"{fuel}|{kind}": float(v)
            for (fuel, kind), v in frame.groupby(CATEGORICAL)["y"].median().items()
        }
        return self

    def predict(self, inputs: pd.DataFrame) -> np.ndarray:
        keys = inputs["primary_fuel"] + "|" + inputs["unit_type"]
        return keys.map(self.table).fillna(self.overall).to_numpy()


class Persistence:
    """"Same as last year": the previous year's NOx rate (lb/MMBtu) times this year's heat input.

    Where either is missing (a unit's first year, or no heat input the year before), it falls back
    to the median baseline. Without same-year activity (the ablation), it predicts last year's
    tons instead, since this year's heat input is then unknown.
    """

    def fit(self, inputs: pd.DataFrame, y: np.ndarray):
        self.fallback = Baseline().fit(inputs, y)
        return self

    def predict(self, inputs: pd.DataFrame, last_year_tons: np.ndarray | None = None) -> np.ndarray:
        if last_year_tons is None:
            estimate = inputs["prior_nox_rate"] * inputs["heat_input_mmbtu"] / 2000
        else:
            estimate = pd.Series(last_year_tons, index=inputs.index)
        return np.where(estimate.notna(), estimate, self.fallback.predict(inputs))


def fit_ridge(X, y, alpha):
    return Ridge(alpha=alpha).fit(X, np.log1p(y))


def predict_ridge(model, X):
    return np.clip(np.expm1(model.predict(X)), 0, None)


def fit_tree(X, y, max_depth, min_samples_leaf):
    return DecisionTreeRegressor(
        max_depth=max_depth, min_samples_leaf=min_samples_leaf, random_state=0
    ).fit(X, y)


def years(frame, span):
    return frame["year"].between(*span)


def train_and_score(inputs, y, mask_fit, mask_eval, numeric, last_year_tons):
    """Tunes Ridge alpha and tree size on `mask_eval`, returning validation metrics and choices.

    Without same-year activity in `numeric` (the ablation), persistence predicts `last_year_tons`.
    """
    spec = fit_spec(inputs[mask_fit], numeric)
    X = design_matrix(inputs, spec)
    best = {}
    for alpha in RIDGE_ALPHAS:
        m = fit_ridge(X[mask_fit], y[mask_fit], alpha)
        score = metrics(y[mask_eval], predict_ridge(m, X[mask_eval]))
        if "ridge" not in best or score["mae"] < best["ridge"][1]["mae"]:
            best["ridge"] = ({"alpha": alpha}, score)
    for depth in TREE_DEPTHS:
        for leaf in TREE_LEAVES:
            m = fit_tree(X[mask_fit], y[mask_fit], depth, leaf)
            score = metrics(y[mask_eval], m.predict(X[mask_eval]))
            if "tree" not in best or score["mae"] < best["tree"][1]["mae"]:
                best["tree"] = ({"max_depth": depth, "min_samples_leaf": leaf}, score)
    base = Baseline().fit(inputs[mask_fit], y[mask_fit])
    best["baseline"] = ({}, metrics(y[mask_eval], base.predict(inputs[mask_eval])))
    persist = Persistence().fit(inputs[mask_fit], y[mask_fit])
    without_activity = "heat_input_mmbtu" not in numeric
    persisted = persist.predict(
        inputs[mask_eval], last_year_tons[mask_eval] if without_activity else None
    )
    best["persistence"] = ({}, metrics(y[mask_eval], persisted))
    return best


def bootstrap(y, preds, clusters, reference, samples=BOOTSTRAP_SAMPLES, seed=0):
    """95 % percentile intervals for test MAE, RMSE, and R², resampling units rather than rows.

    The test years hold up to two unit-years per unit, which are not independent, so each
    replicate draws units with replacement and keeps all of a drawn unit's years (a cluster
    bootstrap). Also gives each model's MAE minus the `reference` model's MAE on the same
    replicates, so the comparison carries its own interval.
    """
    rng = np.random.default_rng(seed)
    _, unit = np.unique(clusters, return_inverse=True)
    n_units = unit.max() + 1
    # Weight of each row in each replicate: how many times its unit was drawn.
    draws = rng.integers(0, n_units, size=(samples, n_units))
    weights = np.zeros((samples, n_units))
    np.add.at(weights, (np.repeat(np.arange(samples), n_units), draws.ravel()), 1)
    w = weights[:, unit]
    total = w.sum(axis=1)
    y_mean = (w @ y) / total
    ss_tot = (w * (y[None, :] - y_mean[:, None]) ** 2).sum(axis=1)

    def replicate_mae(pred):
        return (w @ np.abs(y - pred)) / total

    def interval(values):
        lo, hi = np.percentile(values, [2.5, 97.5])
        return float(lo), float(hi)

    ref_mae = replicate_mae(preds[reference])
    out = {}
    for kind, pred in preds.items():
        mae = replicate_mae(pred)
        sse = w @ (y - pred) ** 2
        low, high, diff = {}, {}, {}
        for name, values in {
            "mae": mae,
            "rmse": np.sqrt(sse / total),
            "r2": 1 - sse / ss_tot,
        }.items():
            low[name], high[name] = interval(values)
        diff["mae_diff"] = float(np.mean(np.abs(y - pred)) - np.mean(np.abs(y - preds[reference])))
        diff["mae_diff_low"], diff["mae_diff_high"] = interval(mae - ref_mae)
        out[kind] = {"test_ci_low": low, "test_ci_high": high, f"test_vs_{reference}": diff}
    return out


def tree_json(tree: DecisionTreeRegressor) -> dict:
    t = tree.tree_
    return {
        "left": t.children_left.tolist(),
        "right": t.children_right.tolist(),
        "feature": t.feature.tolist(),
        "threshold": t.threshold.tolist(),
        "value": t.value[:, 0, 0].tolist(),
    }


def pipeline_version() -> str:
    """The commit the training code comes from, marked when ml/train.py differs from it."""
    try:
        git = lambda *args: subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()
        sha = git("rev-parse", "--short", "HEAD")
        if git("status", "--porcelain", "--", "ml/train.py"):
            sha += " + uncommitted ml/train.py"
    except Exception:
        sha = "unknown"
    return f"git {sha}; Python {sys.version.split()[0]}; scikit-learn {sklearn.__version__}; numpy {np.__version__}; pandas {pd.__version__}"


def span(s):
    return f"{s[0]}-{s[1]}"


def main():
    with sqlite3.connect(DB) as conn:
        raw = pd.read_sql_query(QUERY, conn, params=(TRAIN[0], TEST[1]))
    inputs = model_inputs(raw)
    y = raw[TARGET].to_numpy(dtype=float)
    last_year_tons = raw["prev_nox_mass_tons"].to_numpy(dtype=float)
    train, val, test = (years(raw, s).to_numpy() for s in (TRAIN, VALIDATION, TEST))
    fit_rows = train | val
    print(f"rows: train {train.sum()}, validation {val.sum()}, test {test.sum()}")

    # 1. Tune on train -> validation (all features, then without same-year activity).
    tuned = train_and_score(inputs, y, train, val, NUMERIC, last_year_tons)
    ablation = train_and_score(
        inputs, y, train, val, [n for n in NUMERIC if n not in ACTIVITY], last_year_tons
    )

    # 2. Refit the chosen settings on train + validation; score once on the test years.
    spec = fit_spec(inputs[fit_rows], NUMERIC)
    X = design_matrix(inputs, spec)
    names = feature_names(spec)
    ridge = fit_ridge(X[fit_rows], y[fit_rows], tuned["ridge"][0]["alpha"])
    tree = fit_tree(X[fit_rows], y[fit_rows], **tuned["tree"][0])
    base = Baseline().fit(inputs[fit_rows], y[fit_rows])
    persist = Persistence().fit(inputs[fit_rows], y[fit_rows])
    preds = {
        "baseline": base.predict(inputs),
        "persistence": persist.predict(inputs),
        "ridge": predict_ridge(ridge, X),
        "tree": tree.predict(X),
    }

    ranges = {
        "numeric": {f["name"]: [f["min"], f["max"]] for f in spec["numeric"]},
        "categorical": {
            name: sorted(inputs.loc[fit_rows, name].unique().tolist()) for name in CATEGORICAL
        },
    }
    common = {
        "target": "NOₓ mass (short tons per unit-year)",
        "features": [*NUMERIC, *CATEGORICAL, *CONTROLS],
        "train_years": span(TRAIN),
        "validation_years": span(VALIDATION),
        "test_years": span(TEST),
        "pipeline_version": pipeline_version(),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    definitions = {
        "baseline": ("Baseline: median by fuel and unit type", base, {"table": base.table, "overall": base.overall}),
        "ridge": (
            "Ridge regression (log target)",
            ridge,
            {"coef": ridge.coef_.tolist(), "intercept": float(ridge.intercept_), "logTarget": True},
        ),
        "tree": ("Decision tree", tree, {"tree": tree_json(tree)}),
    }

    MODELS.mkdir(parents=True, exist_ok=True)
    FIXTURES.mkdir(parents=True, exist_ok=True)
    report = {
        "tuned_on_validation": tuned,
        "ablation_without_activity": ablation,
        "search": {"ridge_alpha": RIDGE_ALPHAS, "tree_max_depth": TREE_DEPTHS, "tree_min_samples_leaf": TREE_LEAVES},
        "bootstrap": f"{BOOTSTRAP_SAMPLES} replicates resampling units of the test years, 95 % percentile intervals",
        "models": {},
    }
    # Persistence is a reference, not a registered model: the app neither shows nor replays it.
    intervals = bootstrap(
        y[test], {k: p[test] for k, p in preds.items()}, raw["unit_internal_id"].to_numpy()[test], "persistence"
    )
    rows = []
    for kind, (name, model, params) in definitions.items():
        model_metrics = {
            "validation": tuned[kind][1],
            "test": metrics(y[test], preds[kind][test]),
            "train": metrics(y[fit_rows], preds[kind][fit_rows]),
            "validation_without_activity": ablation[kind][1],
            "test_ci_low": intervals[kind]["test_ci_low"],
            "test_ci_high": intervals[kind]["test_ci_high"],
        }
        artifact = {"kind": kind, "spec": spec, "featureNames": names, "ranges": ranges, **params}
        model_id = f"nox-{kind}"
        importance = (
            dict(zip(names, tree.feature_importances_.tolist())) if kind == "tree" else
            dict(zip(names, ridge.coef_.tolist())) if kind == "ridge" else {}
        )
        artifact["importance"] = importance
        (MODELS / f"{model_id}.json").write_text(json.dumps(artifact))
        joblib.dump({"model": model, "spec": spec}, MODELS / f"{model_id}.joblib")
        report["models"][model_id] = {
            "settings": tuned[kind][0],
            **model_metrics,
            "test_vs_persistence": intervals[kind]["test_vs_persistence"],
        }
        rows.append(
            (
                model_id, name, kind, common["target"], json.dumps(common["features"]),
                json.dumps(tuned[kind][0]), common["train_years"], common["validation_years"],
                common["test_years"],
                # The persistence reference rides along so the app can state it beside each model.
                json.dumps({
                    **model_metrics,
                    "persistence_test": metrics(y[test], preds["persistence"][test]),
                    "test_vs_persistence": intervals[kind]["test_vs_persistence"],
                }),
                json.dumps(artifact),
                f"ml/models/{model_id}.joblib", common["pipeline_version"],
                int(datetime.now(timezone.utc).timestamp()),
            )
        )
    report["reference_persistence"] = {
        "description": (
            "Last year's NOx rate (lb/MMBtu) x this year's heat input / 2000; the median baseline"
            " where either is missing. Without same-year activity: last year's tons."
        ),
        "validation": tuned["persistence"][1],
        "test": metrics(y[test], preds["persistence"][test]),
        "train": metrics(y[fit_rows], preds["persistence"][fit_rows]),
        "validation_without_activity": ablation["persistence"][1],
        "test_ci_low": intervals["persistence"]["test_ci_low"],
        "test_ci_high": intervals["persistence"]["test_ci_high"],
    }
    report.update(common)
    (MODELS / "metrics.json").write_text(json.dumps(report, indent=2))

    # Parity fixture: raw rows and every model's prediction, replayed by src/lib/model.test.ts.
    sample = np.flatnonzero(test)[:: max(1, test.sum() // 200)][:200]
    raw_cols = [
        "year", "primary_fuel", "unit_type", "nameplate_capacity_mw", "commercial_op_date",
        "operating_hours", "gross_generation_mwh", "heat_input_mmbtu", "nox_controls",
        "prev_nox_mass_tons", "prev_heat_input_mmbtu", "prev_operating_hours",
    ]
    fixture = [
        {
            "raw": {k: (None if pd.isna(raw.iloc[i][k]) else raw.iloc[i][k]) for k in raw_cols},
            "predictions": {k: float(preds[k][i]) for k in definitions},
        }
        for i in sample
    ]
    (FIXTURES / "parity.json").write_text(json.dumps(fixture, default=lambda o: o.item()))

    with sqlite3.connect(DB) as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO models (id, name, kind, target, features, params, train_years,"
            " validation_years, test_years, metrics, artifact, artifact_path, pipeline_version, trained_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )

    for model_id, r in [*report["models"].items(), ("persistence (ref)", report["reference_persistence"])]:
        v, t, lo, hi = r["validation"], r["test"], r["test_ci_low"], r["test_ci_high"]
        d = r.get("test_vs_persistence", {"mae_diff": 0, "mae_diff_low": 0, "mae_diff_high": 0})
        print(
            f"{model_id:18} {json.dumps(r.get('settings', {})):42} val MAE {v['mae']:8.1f} R2 {v['r2']:.3f}"
            f" | test MAE {t['mae']:7.1f} [{lo['mae']:.1f}, {hi['mae']:.1f}] RMSE {t['rmse']:7.1f}"
            f" R2 {t['r2']:.3f} [{lo['r2']:.3f}, {hi['r2']:.3f}] MAPE {t['mape']:.1f}%"
            f" | MAE - persistence {d['mae_diff']:+.1f} [{d['mae_diff_low']:+.1f}, {d['mae_diff_high']:+.1f}]"
        )
    for kind, (_, s) in ablation.items():
        print(f"ablation {kind:9} val MAE {s['mae']:8.1f} R2 {s['r2']:.3f}")


if __name__ == "__main__":
    sys.exit(main())
