"""Checks on the training pipeline (run: npm run test:py). Uses a small synthetic frame, not the DB."""

import json

import numpy as np
import pandas as pd
import pytest

import train


def raw_frame(n=60):
    rng = np.random.default_rng(0)
    return pd.DataFrame(
        {
            "year": rng.integers(2016, 2026, n),
            "primary_fuel": rng.choice(["Coal", "Pipeline Natural Gas"], n),
            "unit_type": rng.choice(["Combined cycle", "Tangentially-fired"], n),
            "nameplate_capacity_mw": rng.uniform(50, 800, n),
            "commercial_op_date": ["1975-01-01"] * (n - 1) + [None],
            "operating_hours": rng.uniform(100, 8700, n),
            "gross_generation_mwh": rng.uniform(1e4, 5e6, n),
            "heat_input_mmbtu": rng.uniform(1e5, 5e7, n),
            "nox_controls": rng.choice(["", "Selective Catalytic Reduction|Overfire Air", "Water Injection"], n),
            "prev_nox_mass_tons": rng.uniform(0, 3000, n),
            "prev_heat_input_mmbtu": np.r_[0.0, rng.uniform(1e5, 5e7, n - 1)],
            "prev_operating_hours": rng.uniform(0, 8700, n),
        }
    )


def test_split_years_do_not_overlap():
    spans = [train.TRAIN, train.VALIDATION, train.TEST]
    for (a0, a1), (b0, b1) in zip(spans, spans[1:]):
        assert a1 < b0, "each period must end before the next starts"


def test_no_target_leakage():
    inputs = train.model_inputs(raw_frame())
    assert train.TARGET not in inputs.columns
    assert not [c for c in inputs.columns if c.startswith("nox") or c == "nox_rate"]
    assert set(train.ACTIVITY) <= set(train.NUMERIC)


def test_model_inputs_rules():
    x = train.model_inputs(raw_frame())
    assert np.isnan(x["prior_nox_rate"].iloc[0])  # prior heat input 0: missing, not infinite
    assert np.isnan(x["unit_age"].iloc[-1])  # no commercial operation date
    assert set(x["scr"].unique()) <= {0.0, 1.0}


def test_design_matrix_matches_spec_and_survives_json():
    inputs = train.model_inputs(raw_frame())
    spec = train.fit_spec(inputs, train.NUMERIC)
    X = train.design_matrix(inputs, spec)
    assert X.shape == (len(inputs), len(train.feature_names(spec)))
    assert not np.isnan(X).any()
    again = train.design_matrix(inputs, json.loads(json.dumps(spec)))
    np.testing.assert_allclose(X, again)


def test_baseline_is_group_median():
    inputs = train.model_inputs(raw_frame())
    y = np.arange(len(inputs), dtype=float)
    model = train.Baseline().fit(inputs, y)
    key = inputs["primary_fuel"] + "|" + inputs["unit_type"]
    first = key.iloc[0]
    assert model.predict(inputs.iloc[:1])[0] == pytest.approx(np.median(y[key == first]))


def test_metrics_skip_small_targets_for_mape():
    m = train.metrics(np.array([0.1, 10.0]), np.array([5.0, 11.0]))
    assert m["mape"] == pytest.approx(10.0)
    assert m["n"] == 2


def test_persistence_is_prior_rate_times_heat_input_with_fallback():
    inputs = train.model_inputs(raw_frame())
    y = np.arange(len(inputs), dtype=float)
    model = train.Persistence().fit(inputs, y)
    pred = model.predict(inputs)
    has_rate = inputs["prior_nox_rate"].notna()
    expected = inputs["prior_nox_rate"] * inputs["heat_input_mmbtu"] / 2000
    np.testing.assert_allclose(pred[has_rate], expected[has_rate])
    # Row 0 has no prior rate (prior heat input 0): the median baseline stands in.
    assert not has_rate.iloc[0]
    assert pred[0] == pytest.approx(train.Baseline().fit(inputs, y).predict(inputs.iloc[:1])[0])


def test_persistence_without_activity_predicts_last_years_tons():
    raw = raw_frame()
    inputs = train.model_inputs(raw)
    model = train.Persistence().fit(inputs, np.ones(len(inputs)))
    last = raw["prev_nox_mass_tons"].to_numpy(dtype=float).copy()
    last[1] = np.nan
    pred = model.predict(inputs, last)
    np.testing.assert_allclose(pred[2:], last[2:])
    assert pred[1] == pytest.approx(1.0)  # no record last year: the median baseline


def test_bootstrap_intervals_contain_the_point_estimate():
    rng = np.random.default_rng(1)
    y = rng.uniform(0, 100, 400)
    preds = {"good": y + rng.normal(0, 5, 400), "bad": y + rng.normal(0, 30, 400)}
    units = np.repeat(np.arange(200), 2)  # two years per unit
    ci = train.bootstrap(y, preds, units, "bad", samples=300)
    for kind, pred in preds.items():
        m = train.metrics(y, pred)
        lo, hi = ci[kind]["test_ci_low"], ci[kind]["test_ci_high"]
        for name in ("mae", "rmse", "r2"):
            assert lo[name] <= m[name] <= hi[name], (kind, name)
    diff = ci["good"]["test_vs_bad"]
    assert diff["mae_diff_high"] < 0  # clearly better than the reference
    assert ci["bad"]["test_vs_bad"]["mae_diff"] == 0


def test_tree_grid_reaches_past_the_last_choice():
    # Depth 16 won when it was the deepest option; the grid must go beyond it.
    assert None in train.TREE_DEPTHS
    assert max(d for d in train.TREE_DEPTHS if d is not None) > 16
