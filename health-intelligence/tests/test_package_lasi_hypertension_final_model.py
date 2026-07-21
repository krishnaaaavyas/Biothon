"""Synthetic-only tests for restricted final hypertension model packaging."""

import copy
import json

import joblib
import numpy as np
import pytest

from training import package_lasi_hypertension_final_model as packaging
from training import train_lasi_hypertension_development as development
from test_train_lasi_hypertension_development import synthetic_joined


def synthetic_prerequisites():
    decision = packaging.load_governance()
    development_payloads = {
        "lasi_hypertension_training_manifest.json": {
            "locked_test_evaluated": False,
            "random_seed": packaging.FROZEN_RANDOM_SEED,
        },
        "lasi_hypertension_threshold_selection.json": {
            "configurations": [{
                "configuration": packaging.FROZEN_CONFIGURATION,
                "threshold": packaging.FROZEN_THRESHOLD,
            }]
        },
    }
    locked_payloads = {
        "lasi_hypertension_locked_test_manifest.json": {
            "frozen_configuration": packaging.FROZEN_CONFIGURATION,
            "frozen_features": list(packaging.FROZEN_FEATURES),
            "frozen_threshold": packaging.FROZEN_THRESHOLD,
            "locked_test_evaluated": True,
        },
        "lasi_hypertension_locked_test_metrics.json": {
            "configuration": packaging.FROZEN_CONFIGURATION,
            "frozen_threshold": packaging.FROZEN_THRESHOLD,
            **decision["locked_test_metrics"],
        },
        "lasi_hypertension_locked_test_calibration.json": {
            "configuration": packaging.FROZEN_CONFIGURATION,
            "calibration_intercept": decision["locked_test_calibration"]["intercept"],
            "calibration_slope": decision["locked_test_calibration"]["slope"],
        },
    }
    return development_payloads, locked_payloads, decision


@pytest.fixture
def packaged(tmp_path):
    prerequisites = synthetic_prerequisites()
    output = tmp_path / "model"
    packaging.package_model(synthetic_joined(120), *prerequisites, output)
    return output, prerequisites


def test_governance_schema_records_restricted_manual_approval():
    decision = packaging.load_governance()
    packaging.validate_governance(decision)
    assert decision["model_version"] == "lasi_hypertension_v1"
    assert decision["approval_status"] == "approved_with_restrictions"
    assert decision["features"] == list(packaging.FROZEN_FEATURES)
    assert decision["frozen_threshold"] == packaging.FROZEN_THRESHOLD
    assert decision["manual_approval_recorded"] is True
    assert decision["automatic_approval_performed"] is False


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("configuration", "C_random_forest", "configuration"),
        ("features", ["age", "bmi"], "features"),
        ("frozen_threshold", 0.5, "frozen_threshold"),
        ("approval_status", "approved", "approval_status"),
    ],
)
def test_governance_frozen_values_are_enforced(field, value, message):
    decision = copy.deepcopy(packaging.load_governance())
    decision[field] = value
    with pytest.raises(ValueError, match=message):
        packaging.validate_governance(decision)


def test_confirmation_token_precedes_data_access(monkeypatch, tmp_path):
    monkeypatch.setattr(
        packaging,
        "read_sources",
        lambda *args: pytest.fail("real data access was attempted"),
    )
    with pytest.raises(ValueError, match="confirmation token"):
        packaging.execute(
            tmp_path / "data",
            tmp_path / "development",
            tmp_path / "locked",
            tmp_path / "model",
            "WRONG",
        )


def test_locked_rows_never_enter_pipeline_fit(monkeypatch, tmp_path):
    prerequisites = synthetic_prerequisites()
    joined = synthetic_joined(120)
    cohort, _, target, _ = packaging.construct_target_cohort(joined)
    groups = cohort[["hhid", "ssuid"]].reset_index(drop=True)
    splits = packaging.create_development_splits(
        groups, target.reset_index(drop=True).astype(int), 42
    )
    expected_fit = set(np.concatenate((splits["training"], splits["validation"])))
    locked = set(splits["locked_test"])
    observed = {}
    real_builder = development.build_pipeline

    class RecordingPipeline:
        def __init__(self):
            self.delegate = real_builder(
                packaging.FROZEN_MODEL,
                packaging.FROZEN_FEATURES,
                packaging.FROZEN_RANDOM_SEED,
            )

        def fit(self, frame, values):
            observed["fit"] = set(frame.index)
            self.delegate.fit(frame, values)
            return self

    monkeypatch.setattr(packaging, "build_pipeline", lambda *args: RecordingPipeline())
    monkeypatch.setattr(packaging.joblib, "dump", lambda model, path: path.write_bytes(b"synthetic-model"))
    packaging.package_model(joined, *prerequisites, tmp_path / "model")
    assert observed["fit"] == expected_fit
    assert not observed["fit"] & locked


def test_model_output_inside_repository_is_rejected(tmp_path):
    data_root = tmp_path / "data"
    data_root.mkdir()
    with pytest.raises(ValueError, match="outside the Git worktree"):
        packaging.execute(
            data_root,
            tmp_path / "development",
            tmp_path / "locked",
            packaging.REPOSITORY_ROOT / "unsafe-model-output",
            packaging.CONFIRMATION_TOKEN,
        )


def test_artifacts_load_and_inference_is_deterministic(packaged):
    output, _ = packaged
    assert {path.name for path in output.iterdir()} == packaging.OUTPUT_FILENAMES
    model = joblib.load(output / packaging.MODEL_FILENAME)
    _, predictors, _, _ = packaging.construct_target_cohort(synthetic_joined(120))
    sample = predictors.iloc[:5][list(packaging.FROZEN_FEATURES)]
    first = model.predict_proba(sample)
    second = model.predict_proba(sample)
    np.testing.assert_array_equal(first, second)


def test_artifact_hash_matches_packaged_bytes(packaged):
    output, _ = packaged
    checksum = json.loads((output / packaging.SHA256_FILENAME).read_text(encoding="utf-8"))
    metadata = json.loads((output / packaging.METADATA_FILENAME).read_text(encoding="utf-8"))
    observed = packaging.sha256_file(output / packaging.MODEL_FILENAME)
    assert checksum["sha256"] == observed
    assert metadata["artifact_sha256"] == observed


def test_repeat_packaging_is_rejected(packaged):
    output, prerequisites = packaged
    with pytest.raises(RuntimeError, match="not repeatable"):
        packaging.package_model(synthetic_joined(120), *prerequisites, output)


def test_metadata_contains_restrictions_and_no_participant_export(packaged):
    output, _ = packaged
    metadata = json.loads((output / packaging.METADATA_FILENAME).read_text(encoding="utf-8"))
    serialized = json.dumps(metadata)
    assert metadata["no_exact_probability_display"] is True
    assert metadata["locked_test_excluded_from_fitting"] is True
    assert metadata["participant_level_data_exported"] is False
    assert "prim_key" not in serialized
    assert '"hhid"' not in serialized
    assert '"ssuid"' not in serialized
    assert "bm010" not in serialized
