"""Unit tests for the ICMR training helpers.

All tabular values in this module are synthetic test fixtures. They are not
real patient data and are never written to the production model directory.
"""

import json

import numpy as np
import pandas as pd
import pytest
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from training import train_icmr
from training.audit_icmr_sample import validate_feature_policy


@pytest.fixture
def synthetic_training_fixture():
    """Clearly synthetic, deterministic fixture with no real patient data."""
    rng = np.random.default_rng(20260719)
    rows = 80
    age = rng.normal(46, 13, rows)
    bmi = rng.normal(24, 4, rows)
    signal = 0.10 * (age - 46) + 0.16 * (bmi - 24) + rng.normal(0, 0.9, rows)
    target = (signal > 0).astype(float)
    frame = pd.DataFrame(
        {"age_years": age, "bmi": bmi, "diabetes_composite": target}
    )
    frame.loc[[3, 19], "bmi"] = np.nan
    frame.loc[[7, 31], "diabetes_composite"] = np.nan
    return frame


def _pipeline():
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("lr", LogisticRegression(max_iter=500, random_state=42)),
        ]
    )


def test_feature_policy_rejects_forbidden_glucose_predictor():
    with pytest.raises(ValueError, match="Feature Leakage Detected"):
        validate_feature_policy(["age_years", "fasting_blood_sugar"])


def test_higher_sensitivity_selects_lower_cutoff(
    synthetic_training_fixture, monkeypatch
):
    clean = synthetic_training_fixture.dropna(subset=["diabetes_composite"])
    X = clean[["age_years", "bmi"]]
    y = clean["diabetes_composite"]
    monkeypatch.setattr(
        train_icmr,
        "CV",
        RepeatedStratifiedKFold(n_splits=4, n_repeats=2, random_state=42),
    )

    options = train_icmr._threshold_analysis(_pipeline(), X, y, [0.50, 0.90])

    assert options[1]["mean_cutoff"] < options[0]["mean_cutoff"]


def test_missing_targets_are_removed_before_cv_folds(
    synthetic_training_fixture, monkeypatch
):
    class RecordingCV:
        def __init__(self):
            self.seen_rows = []
            self.delegate = RepeatedStratifiedKFold(
                n_splits=2, n_repeats=1, random_state=42
            )

        def split(self, X, y, groups=None):
            assert not pd.isna(y).any(), "CV received a missing target"
            self.seen_rows.append(len(y))
            yield from self.delegate.split(X, y, groups)

    recorder = RecordingCV()
    monkeypatch.setattr(train_icmr, "CV", recorder)
    clean = synthetic_training_fixture.dropna(
        subset=[train_icmr.TARGET_COLUMN]
    )
    X = clean[train_icmr.PREDICTOR_COLUMNS]
    y = clean[train_icmr.TARGET_COLUMN]

    train_icmr._threshold_analysis(_pipeline(), X, y, [0.75])

    assert recorder.seen_rows == [len(synthetic_training_fixture) - 2]


def test_saved_metadata_has_threshold_schema():
    metadata_path = train_icmr.METADATA_PATH
    with open(metadata_path, "r", encoding="utf-8") as metadata_file:
        metadata = json.load(metadata_file)

    assert isinstance(metadata["threshold_options"], list)
    assert isinstance(metadata["active_threshold"], dict)
    option_keys = {
        "sensitivity_target",
        "mean_cutoff",
        "std_cutoff",
        "mean_specificity",
        "std_specificity",
        "mean_pr_auc",
        "std_pr_auc",
        "selected_default",
    }
    assert metadata["threshold_options"]
    assert all(option_keys <= option.keys() for option in metadata["threshold_options"])
    assert {
        "sensitivity_target",
        "mean_cutoff",
        "std_cutoff",
        "mean_specificity",
        "std_specificity",
    } <= metadata["active_threshold"].keys()


def test_pipeline_trains_and_predicts_probabilities(synthetic_training_fixture):
    clean = synthetic_training_fixture.dropna(subset=["diabetes_composite"])
    X = clean[["age_years", "bmi"]]
    y = clean["diabetes_composite"]
    pipeline = _pipeline()

    pipeline.fit(X, y)
    probabilities = pipeline.predict_proba(X)[:, 1]

    assert probabilities.shape == (len(clean),)
    assert np.isfinite(probabilities).all()
    assert ((0.0 <= probabilities) & (probabilities <= 1.0)).all()
