"""Synthetic privacy-validator tests for hypertension training outputs."""

import json

import pytest

from training import train_lasi_hypertension_development as training
from training import validate_lasi_hypertension_training_outputs as validator
from test_train_lasi_hypertension_development import synthetic_joined


@pytest.fixture
def output(tmp_path, monkeypatch):
    monkeypatch.setattr(training, "MODEL_NAMES", ("logistic_regression",))
    payloads = training.run_development(synthetic_joined(), minimum=10, seed=42)
    path = tmp_path / "outputs"
    training.write_outputs(payloads, path)
    return path


def mutate(output, filename, callback):
    path = output / filename
    payload = json.loads(path.read_text(encoding="utf-8"))
    callback(payload)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_valid_outputs_pass(output):
    assert validator.validate_outputs(output, 10)["validation_passed"] is True


def test_unexpected_file_rejected(output):
    (output / "participant_predictions.json").write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="filenames mismatch"):
        validator.validate_outputs(output, 10)


@pytest.mark.parametrize(
    ("key", "value", "message"),
    [
        ("participant_id", ["FAKE"], "Forbidden"),
        ("bm010", [140], "Forbidden"),
        ("source_path", r"C:\\private\\data", "Forbidden"),
    ],
)
def test_participant_bp_and_path_fields_rejected(output, key, value, message):
    mutate(
        output,
        "lasi_hypertension_candidate_model_results.json",
        lambda payload: payload.update({key: value}),
    )
    with pytest.raises(ValueError, match=message):
        validator.validate_outputs(output, 10)


def test_locked_test_claim_rejected(output):
    mutate(
        output,
        "lasi_hypertension_training_manifest.json",
        lambda payload: payload.update({"locked_test_evaluated": True}),
    )
    with pytest.raises(ValueError, match="Locked test"):
        validator.validate_outputs(output, 10)


def test_unapproved_predictor_rejected(output):
    mutate(
        output,
        "lasi_hypertension_feature_set_results.json",
        lambda payload: payload["feature_sets"][0]["features"].append("blood_pressure"),
    )
    with pytest.raises(ValueError, match="Feature-set"):
        validator.validate_outputs(output, 10)


def test_unsuppressed_small_cell_rejected(output):
    mutate(
        output,
        "lasi_hypertension_split_summary.json",
        lambda payload: payload["partitions"]["training"].update({"positive_count": 3}),
    )
    with pytest.raises(ValueError, match="small cell"):
        validator.validate_outputs(output, 10)


def test_absolute_path_rejected(output):
    mutate(
        output,
        "lasi_hypertension_training_manifest.json",
        lambda payload: payload.update({"note": "/private/source"}),
    )
    with pytest.raises(ValueError, match="Absolute path"):
        validator.validate_outputs(output, 10)
