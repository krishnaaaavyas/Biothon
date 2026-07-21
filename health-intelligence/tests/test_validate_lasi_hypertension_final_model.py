"""Synthetic tests for final hypertension artifact validation."""

import json

import pytest

from training import package_lasi_hypertension_final_model as packaging
from training import validate_lasi_hypertension_final_model as validator
from test_package_lasi_hypertension_final_model import synthetic_prerequisites
from test_train_lasi_hypertension_development import synthetic_joined


@pytest.fixture
def packaged(tmp_path):
    output = tmp_path / "model"
    packaging.package_model(
        synthetic_joined(120), *synthetic_prerequisites(), output
    )
    return output


def mutate_json(path, callback):
    payload = json.loads(path.read_text(encoding="utf-8"))
    callback(payload)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_valid_package_passes(packaged):
    result = validator.validate_model(packaged)
    assert result["validation_passed"] is True
    assert result["approval_status"] == "approved_with_restrictions"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("features", ["age", "weight_kg"]),
        ("frozen_threshold", 0.5),
        ("approval_status", "approved"),
        ("locked_test_excluded_from_fitting", False),
        ("no_exact_probability_display", False),
        ("approved_for_diagnosis", True),
    ],
)
def test_metadata_policy_changes_are_rejected(packaged, field, value):
    mutate_json(
        packaged / packaging.METADATA_FILENAME,
        lambda payload: payload.update({field: value}),
    )
    with pytest.raises(ValueError, match="Metadata mismatch"):
        validator.validate_model(packaged)


def test_corrupted_artifact_hash_is_rejected(packaged):
    with (packaged / packaging.MODEL_FILENAME).open("ab") as model_file:
        model_file.write(b"corruption")
    with pytest.raises(ValueError, match="cannot be loaded|hash mismatch"):
        validator.validate_model(packaged)


def test_checksum_record_mismatch_is_rejected(packaged):
    mutate_json(
        packaged / packaging.SHA256_FILENAME,
        lambda payload: payload.update({"sha256": "0" * 64}),
    )
    with pytest.raises(ValueError, match="SHA-256"):
        validator.validate_model(packaged)


def test_participant_identifier_metadata_is_rejected(packaged):
    mutate_json(
        packaged / packaging.METADATA_FILENAME,
        lambda payload: payload.update({"prim_key": ["synthetic-id"]}),
    )
    with pytest.raises(ValueError, match="Participant"):
        validator.validate_model(packaged)


def test_absolute_raw_path_is_rejected(packaged):
    mutate_json(
        packaged / packaging.METADATA_FILENAME,
        lambda payload: payload.update({"note": r"C:\restricted\raw.dta"}),
    )
    with pytest.raises(ValueError, match="Absolute path"):
        validator.validate_model(packaged)


def test_unexpected_artifact_is_rejected(packaged):
    (packaged / "predictions.json").write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="filenames mismatch"):
        validator.validate_model(packaged)


def test_validator_rejects_model_directory_inside_git():
    with pytest.raises(ValueError, match="outside the Git worktree"):
        validator.validate_model(packaging.REPOSITORY_ROOT / "models")
