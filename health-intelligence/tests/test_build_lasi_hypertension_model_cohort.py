"""Synthetic-only tests for the restricted hypertension model cohort builder."""

import re

import numpy as np
import pandas as pd
import pytest

from training import build_lasi_hypertension_model_cohort as builder
from training import build_lasi_hypertension_cohort as phase3
from training import compare_lasi_hypertension_target_policies as policy
from test_build_lasi_hypertension_cohort import joined


def model_cohort(salt: str = "synthetic-test-salt") -> pd.DataFrame:
    data = joined()
    data["ssuid"] = data["hhid"].map(lambda value: f"SSU-{value}")
    return builder.construct_model_cohort(data, salt)


def test_exact_schema_order_and_predictors():
    cohort = model_cohort()
    assert tuple(cohort.columns) == builder.MODEL_COHORT_SCHEMA
    assert tuple(cohort.columns[:8]) == phase3.PRODUCTION_PREDICTOR_ORDER
    assert not (builder.FORBIDDEN_COLUMNS & set(cohort.columns))


def test_phase3_policy_eligibility_and_counts_are_reused():
    data = joined(5)
    data["dm005"] = [44, 55, 55, 55, 55]
    data["ht002"] = [2, 1, np.nan, 2, 2]
    cohort = builder.construct_model_cohort(data, "synthetic-test-salt")
    assert builder.APPROVED_TARGET_POLICY == policy.APPROVED_TARGET_POLICY == "last_two_pairs_mean"
    assert len(cohort) == 2
    assert cohort[builder.TARGET_COLUMN].isin([0, 1]).all()


def test_hmac_is_deterministic_salt_specific_and_domain_separated():
    first = builder.hmac_group_id("FAKE-GROUP", "household", "salt-one")
    repeated = builder.hmac_group_id("FAKE-GROUP", "household", "salt-one")
    different_salt = builder.hmac_group_id("FAKE-GROUP", "household", "salt-two")
    different_domain = builder.hmac_group_id("FAKE-GROUP", "ssu", "salt-one")
    assert first == repeated
    assert first != different_salt != different_domain
    assert re.fullmatch(r"[0-9a-f]{64}", first)


def test_no_original_identifiers_bp_or_target_sources_remain():
    cohort = model_cohort()
    prohibited = {
        "prim_key", "hhid", "ssuid", "ht002", "ht002c",
        "bm006", "bm007", "bm010", "bm011", "bm014", "bm015", "bm017", "bm018",
    }
    assert not (prohibited & set(cohort.columns))


@pytest.mark.parametrize("environment", [{}, {"LASI_GROUP_SALT": ""}, {"LASI_GROUP_SALT": "   "}])
def test_missing_or_empty_salt_rejected(environment):
    with pytest.raises(ValueError, match="LASI_GROUP_SALT"):
        builder.require_group_salt(environment)


def test_output_inside_repository_rejected(tmp_path, monkeypatch):
    repository = tmp_path / "repo"
    repository.mkdir()
    monkeypatch.setattr(builder, "REPOSITORY_ROOT", repository)
    with pytest.raises(ValueError, match="outside the Git repository"):
        builder.validate_output_directory(repository / "private-output")


def test_manifest_summary_and_parquet_are_aggregate_safe(tmp_path, monkeypatch):
    repository = tmp_path / "repo"
    repository.mkdir()
    monkeypatch.setattr(builder, "REPOSITORY_ROOT", repository)
    output = tmp_path / "external-output"
    paths = builder.write_model_cohort(model_cohort(), output)
    assert {path.name for path in paths} == set(builder.OUTPUT_FILENAMES)
    assert all(path.is_file() for path in paths)
    manifest = builder.build_manifest(model_cohort(), "a" * 64)
    assert manifest["contains_raw_identifiers"] is False
    assert manifest["model_trained"] is manifest["split_created"] is False
