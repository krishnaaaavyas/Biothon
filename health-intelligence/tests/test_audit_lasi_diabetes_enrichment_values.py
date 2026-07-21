"""Synthetic-only tests for the LASI enrichment value audit."""

import json

import numpy as np
import pandas as pd
import pytest

from training import audit_lasi_diabetes_enrichment_values as audit


@pytest.fixture
def synthetic_frame():
    rows = 40
    return pd.DataFrame({
        "prim_key": [f"SYNTHETIC-KEY-{index:03d}" for index in range(rows)],
        "fm304s1": [1] * 10 + [0] * 30,
        "fm304s2": [0] * 20 + [1] * 10 + [0] * 10,
        "fm304s3": [0] * 30 + [1] * 10,
        "fm304s4": [0] * 38 + [None, None],
        "fs507": [1] * 10 + [2] * 10 + [3] * 10 + [4] * 5 + [5, 6, 7, 99, None],
        "hb212": list(range(38)) + [-1, None],
        "hb214": [30] * 20 + [60] * 18 + [np.inf, "invalid"],
    })[audit.APPROVED_COLUMNS]


def test_reader_requests_only_explicit_approved_columns(tmp_path, synthetic_frame):
    source = tmp_path / audit.EXPECTED_FILENAME
    source.touch()
    calls = []

    def reader(path, **kwargs):
        calls.append(kwargs)
        return synthetic_frame.assign(secret="never loaded"), None

    frame = audit.read_approved_columns(source, reader=reader)
    assert calls == [{
        "usecols": audit.APPROVED_COLUMNS,
        "apply_value_formats": False,
    }]
    assert list(frame.columns) == audit.APPROVED_COLUMNS
    assert "secret" not in frame


def test_key_must_be_present_nonmissing_and_unique(synthetic_frame):
    with pytest.raises(ValueError, match="missing"):
        audit.validate_key(synthetic_frame.drop(columns="prim_key"))
    missing = synthetic_frame.copy()
    missing.loc[0, "prim_key"] = None
    with pytest.raises(ValueError, match="missing values"):
        audit.validate_key(missing)
    duplicate = synthetic_frame.copy()
    duplicate.loc[1, "prim_key"] = duplicate.loc[0, "prim_key"]
    with pytest.raises(ValueError, match="duplicate"):
        audit.validate_key(duplicate)


def test_key_validation_is_aggregate_only(synthetic_frame):
    report = audit.build_aggregate_report(synthetic_frame)
    validation = report["key_validation"]

    assert validation == {
        "key_name": "prim_key",
        "missing_key_count": 0,
        "duplicate_key_count": 0,
        "unique_key_count": 40,
    }
    assert report["report_schema_version"] == "1.1"
    encoded = json.dumps(report)
    for identifier in synthetic_frame["prim_key"]:
        assert identifier not in encoded


def test_suppression_distinguishes_zero_small_and_reportable_counts():
    assert audit._suppressed_count(0) == 0
    assert audit._suppressed_percentage(0, 40) == 0.0
    assert audit._suppressed_count(1) == "suppressed"
    assert audit._suppressed_count(9) == "suppressed"
    assert audit._suppressed_percentage(9, 40) == "suppressed"
    assert audit._suppressed_count(10) == 10
    assert audit._suppressed_percentage(10, 40) == 25.0


def test_zero_invalid_and_unexpected_counts_are_exact_zero(synthetic_frame):
    report = audit.build_aggregate_report(synthetic_frame)

    assert report["per_variable"]["fm304s1"]["unexpected_code_count"] == 0
    assert report["family_history"]["relationships"]["fm304s1"][
        "unexpected_code_count"
    ] == 0


def test_exact_release_and_external_paths_are_required(tmp_path, monkeypatch):
    repo = tmp_path / "repo"
    repo.mkdir()
    external = tmp_path / "restricted"
    external.mkdir()
    approved = external / audit.EXPECTED_FILENAME
    approved.touch()
    monkeypatch.setattr(audit, "REPOSITORY_ROOT", repo)
    audit.validate_paths(approved, tmp_path / "external-output")

    wrong = external / "old_individual.dta"
    wrong.touch()
    with pytest.raises(ValueError, match="Unexpected LASI Individual"):
        audit.validate_paths(wrong, tmp_path / "external-output")
    inside = repo / audit.EXPECTED_FILENAME
    inside.touch()
    with pytest.raises(ValueError, match="input must be outside"):
        audit.validate_paths(inside, tmp_path / "external-output")
    with pytest.raises(ValueError, match="Output directory"):
        audit.validate_paths(approved, repo / "output")


def test_family_relationship_counts_and_prevalence(synthetic_frame):
    report = audit.build_aggregate_report(synthetic_frame)
    relationships = report["family_history"]["relationships"]
    assert relationships["fm304s1"]["1"] == {"count": 10, "percentage": 25.0}
    assert relationships["fm304s2"]["1"] == {"count": 10, "percentage": 25.0}
    assert relationships["fm304s4"]["missing"] == {
        "count": "suppressed", "percentage": "suppressed"
    }


def test_family_history_derivation_policy_is_exact(synthetic_frame):
    report = audit.build_aggregate_report(synthetic_frame)
    derived = report["family_history"][
        "derived_family_history_diabetes_parent_sibling"
    ]
    assert derived["1"] == {"count": 30, "percentage": 75.0}
    assert derived["0"] == {"count": 10, "percentage": 25.0}
    assert derived["missing"] == {"count": 0, "percentage": 0.0}
    assert derived["policy"]["0"] == "all four variables equal 0"


def test_family_derivation_missing_unless_any_one_or_all_zero():
    frame = pd.DataFrame({
        "fm304s1": [1, 0, 0], "fm304s2": [None, 0, 0],
        "fm304s3": [0, 0, 2], "fm304s4": [0, 0, 0],
    })
    result = audit._family_audit(frame)[
        "derived_family_history_diabetes_parent_sibling"
    ]
    assert result["1"]["count"] == "suppressed"
    assert result["0"]["count"] == "suppressed"
    assert result["missing"]["count"] == "suppressed"


def test_fs507_codes_are_not_collapsed_and_small_counts_are_suppressed(synthetic_frame):
    result = audit.build_aggregate_report(synthetic_frame)["fs507"]
    assert result["categories_collapsed"] is False
    assert list(result["codes"]) == [str(code) for code in range(1, 8)]
    assert result["codes"]["1"] == {"count": 10, "percentage": 25.0}
    assert result["codes"]["4"] == {
        "count": "suppressed", "percentage": "suppressed"
    }
    assert result["invalid_code_count"] == "suppressed"


def test_duration_candidates_have_required_numeric_summaries(synthetic_frame):
    durations = audit.build_aggregate_report(synthetic_frame)["duration_candidates"]
    hb212 = durations["hb212"]
    assert hb212["minimum"] == 0
    assert hb212["maximum"] == 37
    assert hb212["median"] == 18.5
    assert set(hb212["percentiles"]) == {"p01", "p25", "p75", "p99"}
    assert hb212["unique_valid_value_count"] == 38
    assert hb212["negative_or_otherwise_invalid_count"] == "suppressed"
    assert durations["hb214"]["negative_or_otherwise_invalid_count"] == "suppressed"


def test_continuous_values_do_not_receive_value_frequency_tables(synthetic_frame):
    report = audit.build_aggregate_report(synthetic_frame)
    for column in ("hb212", "hb214"):
        assert report["per_variable"][column]["observed_code_counts"] == (
            "not_applicable_continuous_measure"
        )
        assert report["duration_candidates"][column]["observed_code_counts"] == (
            "not_applicable_continuous_measure"
        )


def test_output_contains_no_identifiers_rows_or_absolute_paths(
    tmp_path, synthetic_frame, monkeypatch
):
    monkeypatch.setattr(audit, "REPOSITORY_ROOT", tmp_path / "repo")
    output = tmp_path / "external-output"
    path = audit.write_report(synthetic_frame, output)
    text = path.read_text(encoding="utf-8")
    payload = json.loads(text)
    assert payload["aggregate_only"] is True
    assert payload["participant_rows_exported"] is False
    assert payload["identifier_values_exported"] is False
    assert str(tmp_path.resolve()) not in text
    for identifier in synthetic_frame["prim_key"]:
        assert identifier not in text
    assert {item.name for item in output.iterdir()} == {audit.OUTPUT_FILENAME}


def test_write_report_rejects_repository_output(tmp_path, synthetic_frame, monkeypatch):
    repo = tmp_path / "repo"
    repo.mkdir()
    monkeypatch.setattr(audit, "REPOSITORY_ROOT", repo)
    with pytest.raises(ValueError, match="outside the Git repository"):
        audit.write_report(synthetic_frame, repo / "output")


def test_all_small_category_counts_and_percentages_are_suppressed(synthetic_frame):
    report = audit.build_aggregate_report(synthetic_frame)

    def assert_no_small_exact_counts(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in {"count", "unexpected_code_count", "invalid_code_count"}:
                    assert not isinstance(item, int) or item == 0 or item >= 10
                assert_no_small_exact_counts(item)
        elif isinstance(value, list):
            for item in value:
                assert_no_small_exact_counts(item)

    assert_no_small_exact_counts(report)
    assert report["suppression_policy"][
        "percentages_for_suppressed_counts_are_also_suppressed"
    ] is True


def test_cli_requires_all_arguments(monkeypatch):
    monkeypatch.setattr("sys.argv", ["audit"])
    with pytest.raises(SystemExit):
        audit.parse_args()
