"""Can the models beat persistence? Three reformulations, each tuned on validation, scored once on test.

The persistence reference in ml/train.py (last year's NOx rate x this year's heat input) beats both
registered models. This script checks whether a different formulation of the same inputs closes
the gap, using train.py's split, preprocessing, and metrics. It writes nothing.

    epaDataVENV/bin/python ml/reformulations.py

1. Persistence as a feature: the persistence estimate (logged) is added to the inputs.
2. Rate target: predict this year's NOx rate (lb/MMBtu); tons = rate x heat input / 2000.
3. Correction of persistence: predict log(actual / persistence estimate) and apply it.
"""

from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.tree import DecisionTreeRegressor

import train as T

DEPTHS = [4, 6, 8, 12, 16, None]
LEAVES = [5, 20, 50, 200]
ALPHAS = [0.1, 1, 10, 100]


def tuned(candidates, y, val, test):
    """The candidate with the lowest validation MAE, and its test MAE. Each predicts all rows."""
    best = min(candidates, key=lambda c: T.metrics(y[val], c[1](val))["mae"])
    return best[0], T.metrics(y[val], best[1](val))["mae"], T.metrics(y[test], best[1](test))["mae"]


def main():
    with sqlite3.connect(T.DB) as conn:
        raw = pd.read_sql_query(T.QUERY, conn, params=(T.TRAIN[0], T.TEST[1]))
    inputs = T.model_inputs(raw)
    y = raw[T.TARGET].to_numpy(dtype=float)
    heat = np.nan_to_num(raw["heat_input_mmbtu"].to_numpy(dtype=float))
    train, val, test = (T.years(raw, s).to_numpy() for s in (T.TRAIN, T.VALIDATION, T.TEST))
    fit = train | val
    persistence = T.Persistence().fit(inputs[fit], y[fit]).predict(inputs)
    expected = (inputs["prior_nox_rate"] * inputs["heat_input_mmbtu"] / 2000).to_numpy(dtype=float)
    has = ~np.isnan(expected) & (heat > 0)
    rows = [("Persistence reference", "-", T.metrics(y[val], persistence[val])["mae"],
             T.metrics(y[test], persistence[test])["mae"])]

    def design(extra=None):
        """train.py's design matrix (prior rate logged too), fit on `rows_fit`, optionally + one input."""
        x = inputs.copy()
        numeric = list(T.NUMERIC)
        if extra is not None:
            x["persistence"] = extra
            numeric.append("persistence")
        T.LOGGED = {"heat_input_mmbtu", "gross_load_mwh", "nameplate_mw", "prior_nox_rate", "persistence"}

        def matrix(rows_fit):
            return T.design_matrix(x, T.fit_spec(x[rows_fit], numeric))

        return matrix

    # Tune on train -> validation; refit the chosen setting on train + validation for the test score.
    def candidates(make):
        """`make(rows_fit, setting)` returns a predictor of all rows; yields (setting, predict(mask))."""
        out = []
        for setting in make.settings:
            tuned_on = make(train, setting)
            final = make(fit, setting)
            out.append((setting, lambda mask, a=tuned_on, b=final: (a if mask is val else b)[mask]))
        return out

    # 1. Persistence as a feature.
    matrix = design(expected)
    for kind in ("ridge", "tree"):
        def make(rows_fit, s, kind=kind):
            X = matrix(rows_fit)
            if kind == "ridge":
                return T.predict_ridge(T.fit_ridge(X[rows_fit], y[rows_fit], s), X)
            return T.fit_tree(X[rows_fit], y[rows_fit], *s).predict(X)
        make.settings = ALPHAS if kind == "ridge" else [(d, l) for d in DEPTHS for l in LEAVES]
        rows.append((f"{kind.title()}, persistence as a feature", *tuned(candidates(make), y, val, test)))

    # 2. Rate target, weighted by heat input so errors count in tons.
    matrix = design()
    rate = np.where(heat > 0, y * 2000 / np.where(heat > 0, heat, 1), np.nan)
    for kind in ("ridge", "tree"):
        def make(rows_fit, s, kind=kind):
            X = matrix(rows_fit)
            m = rows_fit & (heat > 0)
            if kind == "ridge":
                r = Ridge(alpha=s).fit(X[m], np.log(rate[m] + 0.01))
                pred_rate = np.clip(np.exp(r.predict(X)) - 0.01, 0, None)
            else:
                t = DecisionTreeRegressor(max_depth=s[0], min_samples_leaf=s[1], random_state=0)
                pred_rate = t.fit(X[m], rate[m], sample_weight=heat[m]).predict(X)
            return pred_rate * heat / 2000
        make.settings = ALPHAS if kind == "ridge" else [(d, l) for d in DEPTHS for l in LEAVES]
        rows.append((f"{kind.title()}, rate target x heat input", *tuned(candidates(make), y, val, test)))

    # 3. Correction of persistence: log ratio of actual to the estimate, weighted by the estimate.
    ratio = np.log((y + 0.01) / (np.nan_to_num(expected) + 0.01))
    for kind in ("ridge", "tree"):
        def make(rows_fit, s, kind=kind):
            X = matrix(rows_fit)
            m = rows_fit & has & (np.nan_to_num(expected) > 0.01)
            model = (Ridge(alpha=s) if kind == "ridge" else
                     DecisionTreeRegressor(max_depth=s[0], min_samples_leaf=s[1], random_state=0))
            model.fit(X[m], ratio[m], sample_weight=expected[m])
            corrected = (np.nan_to_num(expected) + 0.01) * np.exp(model.predict(X)) - 0.01
            return np.clip(np.where(has, corrected, persistence), 0, None)
        make.settings = ALPHAS if kind == "ridge" else [(d, l) for d in DEPTHS for l in LEAVES]
        rows.append((f"{kind.title()}, correction of persistence", *tuned(candidates(make), y, val, test)))

    print(f"{'Formulation':40} {'chosen on validation':22} {'val MAE':>8} {'test MAE':>9}")
    for name, setting, v, t in rows:
        print(f"{name:40} {str(setting):22} {v:8.1f} {t:9.1f}")


if __name__ == "__main__":
    main()
