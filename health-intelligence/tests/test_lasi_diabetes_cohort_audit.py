"""Synthetic-only tests for the privacy-safe LASI cohort audit.

No real LASI data or participant identifiers are used in this module.
"""

import json
from types import SimpleNamespace

import pandas as pd
import pytest

from training import audit_lasi_diabetes_cohort as audit


@pytest.fixture
def synthetic_frames():
    keys = ["TEST-KEY-A", "TEST-KEY-B", "TEST-KEY-C", "TEST-KEY-D"]
    individual = pd.DataFrame({
        "prim_key": keys,
        "dm003": [1, 2, 1, 2],
        "dm005": [44, 45, 60, 75],
        "ht003": [0, 1, 0, 1],
        "ht003c": [0, 1, 0, 0],
        "ht003d": [0, 0, 0, 1],
        "stateindividualweight": [1.0, 1.2, 0.9, 1.1],
    })
    biomarker = pd.DataFrame({
        "prim_key": keys,
        "bm017": [120, 130, 140, 150],
        "bm018": [75, 80, 85, 90],
        "bm067": [160, 165, 170, 175],
        "bm071": [55, 65, 75, 85],
        "bm076": [75, 85, 95, 105],
    })
    dbs = pd.DataFrame({
        "prim_key": keys,
        "hba1c": [5.4, 5.9, 6.4, 7.1],
        "indiadbsweight": [0.8, 0.9, 1.0, 1.1],
        "statedbsweight": [1.0, 1.0, 1.0, 1.0],
    })
    return individual, biomarker, dbs


@pytest.fixture
def completed_audit(tmp_path, synthetic_frames):
    individual, biomarker, dbs = synthetic_frames
    output_dir = tmp_path / "aggregate-audit"
    result = audit.audit_dataframes(
        individual=individual,
        biomarker=biomarker,
        dbs=dbs,
        output_dir=output_dir,
    )
    return output_dir, result


def test_duplicate_prim_key_causes_failure(tmp_path, synthetic_frames):
    individual, biomarker, dbs = synthetic_frames
    individual.loc[1, "prim_key"] = individual.loc[0, "prim_key"]

    with pytest.raises(ValueError, match="duplicate"):
        audit.audit_dataframes(individual, biomarker, dbs, tmp_path / "out")


def test_missing_prim_key_causes_failure(tmp_path, synthetic_frames):
    individual, biomarker, dbs = synthetic_frames
    dbs.loc[0, "prim_key"] = None

    with pytest.raises(ValueError, match="missing"):
        audit.audit_dataframes(individual, biomarker, dbs, tmp_path / "out")


def test_many_to_many_join_is_rejected():
    left = pd.DataFrame({"prim_key": ["A", "A"], "hba1c": [5.0, 6.0]})
    right = pd.DataFrame({"prim_key": ["A", "A"], "bm017": [120, 130]})

    with pytest.raises(pd.errors.MergeError):
        audit._merge_one_to_one(left, right, "biomarker")


def test_row_expansion_is_rejected():
    with pytest.raises(ValueError, match="Row expansion rejected"):
        audit._reject_row_expansion(4, 5, "synthetic_test")


def test_only_approved_columns_are_loaded(tmp_path):
    fake_path = tmp_path / "individual.dta"
    fake_path.touch()
    metadata = SimpleNamespace(
        column_names=[
            "prim_key", "dm003", "dm005", "ht003", "ht003c", "ht003d",
            "stateindividualweight", "documented_psu", "secret_notes",
        ],
        column_names_to_labels={
            "documented_psu": "Primary Sampling Unit",
            "secret_notes": "Free text notes",
        },
    )
    calls = []

    def fake_reader(path, **kwargs):
        calls.append(kwargs)
        if kwargs.get("metadataonly"):
            return pd.DataFrame(), metadata
        usecols = kwargs["usecols"]
        return pd.DataFrame({column: [1] for column in usecols}), metadata

    dataframe, loaded = audit.read_approved_columns(
        fake_path, "individual", reader=fake_reader
    )

    expected = {
        "prim_key", "dm003", "dm005", "ht003", "ht003c", "ht003d",
        "stateindividualweight", "documented_psu",
    }
    assert set(calls[1]["usecols"]) == expected
    assert set(dataframe.columns) == expected
    assert set(loaded) == expected
    assert "secret_notes" not in calls[1]["usecols"]


def test_no_identifiers_are_exported(completed_audit):
    output_dir, _ = completed_audit
    combined = "\n".join(
        path.read_text(encoding="utf-8")
        for path in output_dir.iterdir()
        if path.is_file()
    )

    assert "prim_key" not in combined.lower()
    for synthetic_identifier in (
        "TEST-KEY-A", "TEST-KEY-B", "TEST-KEY-C", "TEST-KEY-D"
    ):
        assert synthetic_identifier not in combined


def test_no_participant_level_file_is_generated(completed_audit):
    output_dir, _ = completed_audit
    assert {path.name for path in output_dir.iterdir()} == set(
        audit.OUTPUT_FILENAMES.values()
    )
    assert not any(
        token in path.name.lower()
        for path in output_dir.iterdir()
        for token in ("participant", "cohort_rows", "merged", "records")
    )


def test_all_aggregate_outputs_are_created(completed_audit):
    output_dir, result = completed_audit
    for filename in audit.OUTPUT_FILENAMES.values():
        assert (output_dir / filename).is_file()

    assert result["cohort_flow"]["final_rows"] == 4
    assert result["cohort_flow"]["row_expansion"] == 0
    assert result["target_evidence"]["target_constructed"] is False

    target_report = json.loads(
        (output_dir / audit.OUTPUT_FILENAMES["target_evidence"])
        .read_text(encoding="utf-8")
    )
    assert set(target_report) >= {
        "self_reported_diabetes",
        "diabetes_oral_medication",
        "insulin_use",
        "hba1c_availability",
        "possible_hba1c_ranges",
    }
