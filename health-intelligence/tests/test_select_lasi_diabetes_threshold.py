"""Synthetic-only tests for LASI Phase 3B threshold selection."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from training import select_lasi_diabetes_threshold as selection


@pytest.fixture(scope="module")
def cohort():
    rows = 100
    return pd.DataFrame({
        "age": [45 + i % 45 for i in range(rows)],
        "sex": [1 + i % 2 for i in range(rows)],
        "bmi": [None if i % 19 == 0 else 18 + i % 20 for i in range(rows)],
        "waist_cm": [70 + i % 30 for i in range(rows)],
        "systolic_bp": [110 + i % 40 for i in range(rows)],
        "diastolic_bp": [65 + i % 25 for i in range(rows)],
        selection.TARGET: [1 if i % 5 == 0 else 0 for i in range(rows)],
        "household_group_id": [hashlib.sha256(f"hh-{i // 2}".encode()).hexdigest() for i in range(rows)],
        selection.GROUP: [hashlib.sha256(f"ssu-{i // 4}".encode()).hexdigest() for i in range(rows)],
        "state": [1 + i // 20 for i in range(rows)],
        "india_dbs_weight": [1 + (i % 4) / 10 for i in range(rows)],
        "flag_height_100_to_129": [i % 23 == 0 for i in range(rows)],
        "flag_age_above_100": [i in {11, 57} for i in range(rows)],
        "flag_height_invalid": [False] * rows,
        "flag_waist_invalid": [False] * rows,
        "flag_bmi_invalid": [False] * rows,
    })[selection.EXPECTED_SCHEMA]


@pytest.fixture
def prerequisites(tmp_path, cohort):
    pytest.importorskip("pyarrow")
    path = tmp_path / "lasi_undiagnosed_diabetes_cohort.parquet"
    cohort.to_parquet(path, index=False, engine="pyarrow")
    counts = {"total": 100, "positive": 20, "negative": 80}
    manifest = {
        "source_type": "real_lasi_wave1", "contains_raw_identifiers": False,
        "contains_target_defining_variables": False,
        "contains_synthetic_training_records": False,
        "primary_cohort_count": 100, "positive_count": 20, "negative_count": 80,
        "parquet_sha256": selection._sha256(path),
    }
    validation = {"validation_passed": True}
    dev_index, locked_index, locked = selection.recreate_split(
        cohort, 42, _locked_structure(cohort, 42)
    )
    development_manifest = {
        "random_seed": 42,
        "split_method": "StratifiedGroupKFold(n_splits=5, shuffle=True)",
        "locked_fold_index": 0, "locked_test_evaluated": False,
        "locked_test_aggregate_structure": locked,
    }
    return path, manifest, validation, development_manifest, counts


def _locked_structure(cohort, seed):
    from sklearn.model_selection import StratifiedGroupKFold
    _, index = list(StratifiedGroupKFold(
        n_splits=5, shuffle=True, random_state=seed
    ).split(cohort, cohort[selection.TARGET], cohort[selection.GROUP]))[0]
    locked = cohort.iloc[index]
    return {
        "row_count": len(locked),
        "positive_count": int(locked[selection.TARGET].eq(1).sum()),
        "negative_count": int(locked[selection.TARGET].eq(0).sum()),
        "positive_percentage": float(100 * locked[selection.TARGET].mean()),
        "unique_ssu_count": int(locked[selection.GROUP].nunique()),
    }


def validate(parts, cohort):
    path, manifest, report, dev_manifest, counts = parts
    return selection.validate_preconditions(
        path, cohort, manifest, report, dev_manifest, 42, expected_counts=counts
    )


def test_passing_validation_is_mandatory(prerequisites, cohort):
    prerequisites[2]["validation_passed"] = False
    with pytest.raises(ValueError, match="mandatory"):
        validate(prerequisites, cohort)


@pytest.mark.parametrize("kind", ["checksum", "count"])
def test_checksum_and_count_mismatches_fail(prerequisites, cohort, kind):
    if kind == "checksum":
        prerequisites[1]["parquet_sha256"] = "0" * 64
    else:
        prerequisites[4]["positive"] = 21
    with pytest.raises(ValueError, match="checksum|counts"):
        validate(prerequisites, cohort)


def test_exact_phase3a_split_is_recreated(cohort):
    expected = _locked_structure(cohort, 42)
    first = selection.recreate_split(cohort, 42, expected)
    second = selection.recreate_split(cohort, 42, expected)
    assert np.array_equal(first[0], second[0])
    assert np.array_equal(first[1], second[1])
    bad = dict(expected, row_count=999)
    with pytest.raises(ValueError, match="aggregate mismatch"):
        selection.recreate_split(cohort, 42, bad)


def test_locked_test_is_never_fitted_or_evaluated(cohort):
    dev, locked, structure = selection.recreate_split(cohort, 42, _locked_structure(cohort, 42))
    assert set(dev).isdisjoint(set(locked))
    probabilities, indices = selection.out_of_fold_probabilities(
        cohort.iloc[dev].reset_index(drop=True), "primary_A", 42
    )
    assert len(probabilities) == len(dev)
    assert sum(len(index) for index in indices) == len(dev)
    assert structure["row_count"] == len(locked)


def test_no_ssu_crosses_development_folds(cohort):
    dev, _, _ = selection.recreate_split(cohort, 42, _locked_structure(cohort, 42))
    data = cohort.iloc[dev].reset_index(drop=True)
    for train, validation in selection.development_folds(data, 42):
        assert set(data.iloc[train][selection.GROUP]).isdisjoint(
            set(data.iloc[validation][selection.GROUP])
        )


def test_primary_and_challenger_feature_allowlists():
    primary, primary_raw = selection.build_model("primary_A", 42)
    challenger, challenger_raw = selection.build_model("challenger_C", 42)
    assert selection.PRIMARY_FEATURES == ["age", "bmi"]
    assert primary_raw == ["age", "bmi"]
    assert challenger_raw == ["age", "bmi", "sex"]
    assert selection.CHALLENGER_FEATURES == [
        "age", "bmi", "sex", "age_squared", "bmi_squared", "age_bmi_interaction"
    ]
    assert isinstance(primary.named_steps["preprocessing"], ColumnTransformer)
    numeric = challenger.named_steps["preprocessing"].transformers[0][1]
    assert "engineered_age_bmi" in numeric.named_steps


def test_forbidden_variables_are_never_predictors():
    used = set(selection.PRIMARY_FEATURES) | set(selection.CHALLENGER_FEATURES)
    assert not used & {
        "waist_cm", "systolic_bp", "diastolic_bp", selection.GROUP,
        "state", "india_dbs_weight", selection.TARGET,
    }


@pytest.mark.parametrize("requested", [0.80, 0.85, 0.90])
def test_threshold_is_highest_deterministic_qualifier(requested):
    target = np.array([1, 1, 1, 1, 1, 0, 0])
    probability = np.array([0.9, 0.8, 0.7, 0.6, 0.5, 0.65, 0.4])
    threshold = selection.select_threshold(target, probability, requested)
    sensitivity = ((probability >= threshold) & (target == 1)).sum() / 5
    assert sensitivity >= requested
    assert not any(
        value > threshold and ((probability >= value) & (target == 1)).sum() / 5 >= requested
        for value in np.unique(probability)
    )
    assert threshold == selection.select_threshold(target, probability, requested)


def test_confusion_matrix_metrics_are_correct():
    metrics = selection.threshold_metrics(
        np.array([1, 1, 0, 0]), np.array([0.9, 0.4, 0.8, 0.1]), 0.5
    )
    assert metrics["tp"] == metrics["fp"] == metrics["tn"] == metrics["fn"] == 1
    assert metrics["sensitivity"] == metrics["specificity"] == 0.5
    assert metrics["precision"] == metrics["negative_predictive_value"] == 0.5
    assert metrics["f1"] == metrics["f2"] == metrics["balanced_accuracy"] == 0.5
    assert metrics["referral_count"] == 2
    assert metrics["referral_percentage"] == 50


def test_fold_stability_uses_fixed_thresholds(cohort):
    dev, _, _ = selection.recreate_split(cohort, 42, _locked_structure(cohort, 42))
    data = cohort.iloc[dev].reset_index(drop=True)
    probabilities, _ = selection.out_of_fold_probabilities(data, "primary_A", 42)
    candidates = selection.candidate_results(data[selection.TARGET].to_numpy(), probabilities)
    result = selection.fold_stability(data, probabilities, candidates, 42)
    assert [row["fixed_threshold"] for row in result] == [row["threshold"] for row in candidates]
    assert all(0 <= row["folds_meeting_sensitivity_target"] <= 5 for row in result)


def test_survey_weights_are_only_sample_weights(cohort, monkeypatch):
    dev, _, _ = selection.recreate_split(cohort, 42, _locked_structure(cohort, 42))
    data = cohort.iloc[dev].reset_index(drop=True)
    captured = []
    original = Pipeline.fit

    def spy(self, x, y=None, **kwargs):
        captured.append((list(x.columns), "model__sample_weight" in kwargs))
        return original(self, x, y, **kwargs)

    monkeypatch.setattr(Pipeline, "fit", spy)
    selection.out_of_fold_probabilities(
        data, "primary_A", 42, sample_weight=data["india_dbs_weight"]
    )
    assert captured
    assert all(columns == ["age", "bmi"] and weighted for columns, weighted in captured)


def test_sensitivity_experiments_do_not_alter_primary_data(cohort):
    original = cohort.copy(deep=True)
    dev, _, _ = selection.recreate_split(cohort, 42, _locked_structure(cohort, 42))
    selection.run_analysis(cohort, dev, 42)
    pd.testing.assert_frame_equal(cohort, original)


def test_preprocessing_stays_inside_pipelines():
    for model in ("primary_A", "challenger_C"):
        pipeline, _ = selection.build_model(model, 42)
        assert isinstance(pipeline, Pipeline)
        preprocessing = pipeline.named_steps["preprocessing"]
        for _, transformer, _ in preprocessing.transformers:
            assert isinstance(transformer, Pipeline)
            assert isinstance(transformer.named_steps["imputer"], SimpleImputer)


def test_no_resampling_or_fallback_data_exists():
    source = Path(selection.__file__).read_text(encoding="utf-8").lower()
    for forbidden in ("smote", "oversampl", "undersampl", "fallback dataset"):
        assert forbidden not in source


def test_outputs_are_aggregate_and_contain_no_group_values(
    tmp_path, cohort, monkeypatch
):
    monkeypatch.setattr(selection, "REPOSITORY_ROOT", tmp_path / "repo")
    dev, _, _ = selection.recreate_split(cohort, 42, _locked_structure(cohort, 42))
    candidates, comparison, stability, sensitivity = selection.run_analysis(cohort, dev, 42)
    output = tmp_path / "external"
    selection.write_outputs(output, "a" * 64, 42, candidates, comparison, stability, sensitivity)
    assert {path.name for path in output.iterdir()} == set(selection.OUTPUT_FILES)
    text = "\n".join(path.read_text(encoding="utf-8") for path in output.iterdir())
    for value in cohort[selection.GROUP].unique():
        assert value not in text
    assert "fold_assignments" not in text
    assert "row_level_predictions\": true" not in text.lower()


def test_output_inside_repository_fails(tmp_path, monkeypatch):
    repo = tmp_path / "repo"
    repo.mkdir()
    monkeypatch.setattr(selection, "REPOSITORY_ROOT", repo)
    with pytest.raises(ValueError, match="outside the Git repository"):
        selection.validate_output_dir(repo / "output")


def test_production_cli_requires_all_inputs(monkeypatch):
    monkeypatch.setattr("sys.argv", ["threshold"])
    with pytest.raises(SystemExit):
        selection.parse_args()
