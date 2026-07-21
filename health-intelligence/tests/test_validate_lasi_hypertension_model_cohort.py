"""Synthetic-only independent validation tests for the model cohort."""

import json

import pandas as pd
import pytest

from training import build_lasi_hypertension_model_cohort as builder
from training import validate_lasi_hypertension_model_cohort as validator
from test_build_lasi_hypertension_model_cohort import model_cohort


@pytest.fixture
def bundle(tmp_path, monkeypatch):
    repository = tmp_path / "repo"
    repository.mkdir()
    monkeypatch.setattr(builder, "REPOSITORY_ROOT", repository)
    monkeypatch.setattr(validator, "REPOSITORY_ROOT", repository)
    cohort = model_cohort()
    monkeypatch.setattr(validator, "EXPECTED_TOTAL_COUNT", len(cohort))
    monkeypatch.setattr(validator, "EXPECTED_POSITIVE_COUNT", int(cohort[builder.TARGET_COLUMN].eq(1).sum()))
    monkeypatch.setattr(validator, "EXPECTED_NEGATIVE_COUNT", int(cohort[builder.TARGET_COLUMN].eq(0).sum()))
    paths = builder.write_model_cohort(cohort, tmp_path / "external-bundle")
    return (*paths, tmp_path / "validation" / "report.json")


def mutate_json(path, callback):
    payload = json.loads(path.read_text(encoding="utf-8"))
    callback(payload)
    path.write_text(json.dumps(payload), encoding="utf-8")


def validate(bundle):
    return validator.validate_cohort(*bundle)


def test_valid_synthetic_cohort_passes(bundle):
    report = validate(bundle)
    assert report["validation_passed"] is True
    assert report["checksum_match"] is report["schema_match"] is True


def test_checksum_mismatch_rejected(bundle):
    mutate_json(bundle[1], lambda value: value.update({"parquet_sha256": "0" * 64}))
    with pytest.raises(ValueError, match="checksum"):
        validate(bundle)


def test_manifest_mismatch_rejected(bundle):
    mutate_json(bundle[1], lambda value: value.update({"target_policy": "wrong"}))
    with pytest.raises(ValueError, match="Manifest"):
        validate(bundle)


def rewrite_cohort(bundle, callback):
    cohort = pd.read_parquet(bundle[0])
    callback(cohort)
    cohort.to_parquet(bundle[0], index=False)
    mutate_json(bundle[1], lambda value: value.update({"parquet_sha256": builder.sha256_file(bundle[0])}))


def test_wrong_schema_and_missing_target_rejected(bundle):
    rewrite_cohort(bundle, lambda cohort: cohort.drop(columns=[builder.TARGET_COLUMN], inplace=True))
    with pytest.raises(ValueError, match="schema"):
        validate(bundle)


def test_nonbinary_target_rejected(bundle):
    rewrite_cohort(bundle, lambda cohort: cohort.__setitem__(builder.TARGET_COLUMN, 2))
    with pytest.raises(ValueError, match="non-binary"):
        validate(bundle)


def test_household_to_ssu_nesting_failure_rejected(bundle):
    def break_nesting(cohort):
        cohort.loc[1, "household_group_id"] = cohort.loc[0, "household_group_id"]
        cohort.loc[1, "ssu_group_id"] = "f" * 64
    rewrite_cohort(bundle, break_nesting)
    with pytest.raises(ValueError, match="nesting"):
        validate(bundle)


def test_invalid_national_weight_rejected(bundle):
    rewrite_cohort(bundle, lambda cohort: cohort.__setitem__(builder.WEIGHT_COLUMN, 0))
    with pytest.raises(ValueError, match="finite and positive"):
        validate(bundle)


def test_validation_output_inside_repository_rejected(bundle, tmp_path, monkeypatch):
    repository = tmp_path / "repo-two"
    repository.mkdir()
    monkeypatch.setattr(validator, "REPOSITORY_ROOT", repository)
    with pytest.raises(ValueError, match="outside the Git repository"):
        validator.validate_cohort(*bundle[:3], repository / "report.json")
