"""Synthetic-only tests for hypertension development training."""

import json

import numpy as np
import pandas as pd
import pytest
from sklearn.pipeline import Pipeline

from training import train_lasi_hypertension_development as training
from training.build_lasi_hypertension_cohort import (
    BIOMARKER_COLUMNS,
    INDIVIDUAL_COLUMNS,
)


def synthetic_joined(rows: int = 120) -> pd.DataFrame:
    data = {
        column: [1] * rows
        for column in [*INDIVIDUAL_COLUMNS[1:], *BIOMARKER_COLUMNS[1:]]
    }
    data.update(
        {
            "dm005": [45 + index % 35 for index in range(rows)],
            "dm003": [1 + index % 2 for index in range(rows)],
            "ht002": [2] * rows,
            "ht002c": [np.nan] * rows,
            "hhid": [f"H-{index // 2}" for index in range(rows)],
            "ssuid": [f"S-{index // 6}" for index in range(rows)],
            "bm006": [135] * rows,
            "bm007": [82] * rows,
            "bm010": [145 if index % 3 == 0 else 125 for index in range(rows)],
            "bm011": [92 if index % 5 == 0 else 80 for index in range(rows)],
            "bm014": [143 if index % 3 == 0 else 127 for index in range(rows)],
            "bm015": [90 if index % 5 == 0 else 82 for index in range(rows)],
            "bm017": [134] * rows,
            "bm018": [83] * rows,
            "bm067": [165.0 + index % 10 for index in range(rows)],
            "bm071": [60.0 + index % 20 for index in range(rows)],
            "fm303s1": [index % 2 for index in range(rows)],
            "fm303s2": [0] * rows,
            "fm303s3": [0] * rows,
            "fm303s4": [0] * rows,
            "fm303s5": [0] * rows,
            "hb211": [1 + index % 5 for index in range(rows)],
            "hb213": [1 + index % 5 for index in range(rows)],
            "hb001": [2 if index % 2 == 0 else 1 for index in range(rows)],
            "hb003": [1] * rows,
            "hb003_a": [1 + index % 2 for index in range(rows)],
        }
    )
    return pd.DataFrame(data)


def target_and_groups():
    frame = synthetic_joined()
    cohort, _, target, _ = training.construct_target_cohort(frame)
    return cohort[["hhid", "ssuid"]].reset_index(drop=True), target.reset_index(drop=True)


def predictors_with_pandas_missing_values(rows: int = 36) -> pd.DataFrame:
    """Synthetic predictors covering pandas nullable categorical dtypes."""
    frame = pd.DataFrame(
        {
            "age": np.linspace(45.0, 80.0, rows),
            "bmi": np.linspace(18.0, 34.0, rows),
            "sex": pd.Series([1, 2, pd.NA] * (rows // 3), dtype="Int64"),
            "family_history_hypertension": pd.Series(
                [0, 1, pd.NA] * (rows // 3), dtype="Int8"
            ),
            "physical_activity_category": pd.Series(
                ["high", "moderate", pd.NA] * (rows // 3), dtype="string"
            ),
            "smoking_category": pd.Series(
                ["never", "former", pd.NA] * (rows // 3), dtype="object"
            ),
        }
    )
    return frame


def test_splits_are_deterministic_group_safe_and_approximately_stratified():
    groups, target = target_and_groups()
    first = training.create_development_splits(groups, target, 42)
    second = training.create_development_splits(groups, target, 42)
    assert all(np.array_equal(first[name], second[name]) for name in first)
    households = {name: set(groups.iloc[index]["hhid"]) for name, index in first.items()}
    assert not households["training"] & households["validation"]
    assert not households["training"] & households["locked_test"]
    assert not households["validation"] & households["locked_test"]
    overall = float(target.mean())
    assert all(abs(float(target.iloc[index].mean()) - overall) < 0.15 for index in first.values())


def test_feature_registry_is_exact_duplicate_free_and_approved():
    training.validate_feature_sets()
    assert set(training.FEATURE_SETS) == {"A", "B", "C", "D"}
    assert all(len(features) == len(set(features)) for features in training.FEATURE_SETS.values())
    assert all(set(features) <= training.APPROVED_PRODUCTION_PREDICTORS for features in training.FEATURE_SETS.values())


@pytest.mark.parametrize("model_name", training.MODEL_NAMES)
def test_preprocessing_is_inside_pipeline(model_name):
    pipeline = training.build_pipeline(model_name, training.FEATURE_SETS["C"])
    assert isinstance(pipeline, Pipeline)
    assert "preprocessing" in pipeline.named_steps
    assert "classifier" in pipeline.named_steps


def test_categorical_normalization_replaces_pd_na_without_changing_numeric_data():
    predictors = predictors_with_pandas_missing_values()
    categorical = predictors[[
        "sex",
        "family_history_hypertension",
        "physical_activity_category",
        "smoking_category",
    ]]

    normalized = training.normalize_categorical_for_sklearn(categorical)

    assert all(dtype == object for dtype in normalized.dtypes)
    assert not normalized.map(lambda value: value is pd.NA).any().any()
    assert normalized.isna().any().all()
    assert normalized["sex"].dropna().map(type).eq(str).all()
    assert normalized["family_history_hypertension"].dropna().map(type).eq(str).all()
    assert pd.api.types.is_float_dtype(predictors["age"])
    assert pd.api.types.is_float_dtype(predictors["bmi"])


@pytest.mark.parametrize("model_name", training.MODEL_NAMES)
def test_candidate_models_accept_nullable_categorical_missing_values(model_name):
    predictors = predictors_with_pandas_missing_values()
    target = np.tile([0, 1], len(predictors) // 2)
    pipeline = training.build_pipeline(model_name, training.FEATURE_SETS["C"])

    pipeline.fit(predictors, target)
    probabilities = pipeline.predict_proba(predictors)[:, 1]

    assert np.isfinite(probabilities).all()
    assert predictors.isna().any().any()


def test_imputation_is_fitted_only_by_pipeline_on_training_rows():
    predictors = predictors_with_pandas_missing_values()
    training_rows = predictors.iloc[:24].copy()
    validation_rows = predictors.iloc[24:].copy()
    training_rows.loc[:, "age"] = np.arange(45.0, 69.0)
    validation_rows.loc[:, "age"] = 999.0
    target = np.tile([0, 1], len(training_rows) // 2)
    pipeline = training.build_pipeline(
        "logistic_regression", training.FEATURE_SETS["C"]
    )

    pipeline.fit(training_rows, target)
    preprocessing = pipeline.named_steps["preprocessing"]
    numeric_imputer = preprocessing.named_transformers_["numeric"].named_steps[
        "imputer"
    ]

    assert numeric_imputer.statistics_[0] == pytest.approx(
        training_rows["age"].median()
    )
    assert numeric_imputer.statistics_[0] != validation_rows["age"].median()
    assert training_rows.isna().any().any()


def test_threshold_selection_uses_validation_and_meets_target_when_possible():
    result = training.select_validation_threshold(
        np.array([0, 0, 1, 1]), np.array([0.1, 0.3, 0.6, 0.9]), 0.80
    )
    assert result["selection_partition"] == "validation"
    assert result["sensitivity_target_achieved"] is True
    assert result["sensitivity"] >= 0.80


def test_empty_and_invalid_group_data_rejected():
    with pytest.raises(ValueError, match="nonempty"):
        training.create_development_splits(pd.DataFrame(columns=["hhid", "ssuid"]), pd.Series(dtype=int))
    frame = pd.DataFrame({"hhid": ["H", "H"], "ssuid": ["S1", "S2"]})
    with pytest.raises(ValueError, match="nest"):
        training.create_development_splits(frame, pd.Series([0, 1]))


def test_unsupported_target_policy_rejected(monkeypatch):
    monkeypatch.setattr(training, "APPROVED_TARGET_POLICY", "unsupported")
    with pytest.raises(ValueError, match="Unsupported"):
        training.validate_feature_sets()


def test_development_outputs_are_aggregate_and_locked_test_is_not_evaluated(monkeypatch):
    monkeypatch.setattr(training, "MODEL_NAMES", ("logistic_regression",))
    outputs = training.run_development(synthetic_joined(), minimum=10, seed=42)
    serialized = json.dumps(outputs)
    manifest = outputs["lasi_hypertension_training_manifest.json"]
    assert manifest["locked_test_evaluated"] is False
    assert manifest["threshold_selection_partition"] == "validation"
    assert "prim_key" not in serialized
    assert "bm010" not in serialized
    assert '"predictions":' not in serialized
    model_rows = outputs["lasi_hypertension_candidate_model_results.json"]["configurations"]
    assert all(row["locked_test_metrics"] is None for row in model_rows)


def test_reproducible_outputs_with_fixed_seed(monkeypatch):
    monkeypatch.setattr(training, "MODEL_NAMES", ("logistic_regression",))
    first = training.run_development(synthetic_joined(), minimum=10, seed=42)
    second = training.run_development(synthetic_joined(), minimum=10, seed=42)
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
