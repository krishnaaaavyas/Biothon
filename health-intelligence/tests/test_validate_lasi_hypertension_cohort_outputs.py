"""Synthetic tests for hypertension cohort-output validation."""
import json
import pytest
from training import build_lasi_hypertension_cohort as audit
from training import validate_lasi_hypertension_cohort_outputs as validator
from test_build_lasi_hypertension_cohort import joined, diagnostics

@pytest.fixture
def output(tmp_path):
    path=tmp_path/"out"; audit.write_outputs(audit.build_outputs(joined(),diagnostics(),10),path); return path

def mutate(output,name,fn):
    p=output/name; value=json.loads(p.read_text()); fn(value); p.write_text(json.dumps(value))

def test_valid_outputs_pass(output): assert validator.validate_outputs(output,10)["validation_passed"] is True
def test_unexpected_file_rejected(output):
    (output/"rows.json").write_text("[]")
    with pytest.raises(ValueError,match="Unexpected files:\\n- rows.json"): validator.validate_outputs(output,10)
def test_participant_array_rejected(output):
    mutate(output,"lasi_hypertension_cohort_quality_summary.json",lambda x:x.update({"rows":[{"participant_id":"FAKE"}]}))
    with pytest.raises(ValueError,match="participant-like"): validator.validate_outputs(output,10)
def test_unexpected_predictor_rejected(output):
    mutate(output,"lasi_hypertension_cohort_quality_summary.json",lambda x:x["approved_predictor_names"].append("blood_pressure"))
    with pytest.raises(ValueError,match="unexpected"): validator.validate_outputs(output,10)
def test_unsafe_manifest_rejected(output):
    mutate(output,"lasi_hypertension_cohort_manifest.json",lambda x:x.update({"model_trained":True}))
    with pytest.raises(ValueError,match="model_trained"): validator.validate_outputs(output,10)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda names: names.pop(),
        lambda names: names.append("blood_pressure"),
        lambda names: names.append(names[0]),
        lambda names: names.__setitem__(slice(0, 2), reversed(names[:2])),
    ],
    ids=["missing", "extra", "duplicate", "reordered"],
)
def test_manifest_predictor_contract_rejects_invalid_names(output, mutation):
    mutate(
        output,
        "lasi_hypertension_cohort_manifest.json",
        lambda payload: mutation(payload["approved_predictors"]),
    )
    with pytest.raises(ValueError, match="approved predictor set mismatch"):
        validator.validate_outputs(output, 10)


def test_missing_output_directory_reports_received_path(tmp_path):
    missing = tmp_path / "missing-output"
    with pytest.raises(FileNotFoundError, match="Output directory does not exist"):
        validator.validate_outputs(missing, 10)


def test_empty_output_directory_lists_every_missing_file(tmp_path):
    empty = tmp_path / "empty-output"
    empty.mkdir()
    with pytest.raises(ValueError) as error:
        validator.validate_outputs(empty, 10)

    message = str(error.value)
    assert "Output bundle is incomplete." in message
    assert "Unexpected files:\n- none" in message
    assert all(filename in message for filename in audit.OUTPUT_FILENAMES)


def test_partial_output_directory_lists_only_missing_files(output):
    removed = "lasi_hypertension_cohort_manifest.json"
    (output / removed).unlink()
    with pytest.raises(ValueError) as error:
        validator.validate_outputs(output, 10)

    message = str(error.value)
    assert f"Missing files:\n- {removed}" in message
    assert "Unexpected files:\n- none" in message


