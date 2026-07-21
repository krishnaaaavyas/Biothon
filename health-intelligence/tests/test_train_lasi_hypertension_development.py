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
