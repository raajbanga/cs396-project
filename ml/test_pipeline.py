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
