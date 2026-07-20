"""Synthetic-only tests for the LASI target-definition audit."""

from types import SimpleNamespace

import pandas as pd
import pytest

from training import audit_lasi_target_definition as audit


@pytest.fixture
def synthetic_frames():
    keys = [f"SYNTHETIC-KEY-{index:02d}" for index in range(10)]
    individual = pd.DataFrame({
        "prim_key": keys,
        "hhid": [f"SYNTHETIC-HH-{index // 2:02d}" for index in range(10)],
        "ssuid": [f"SYNTHETIC-SSU-{index // 4:02d}" for index in range(10)],
        "dm003": [1, 2] * 5,
        "dm005": [45, 45, 45, 45, 45, 45, 44, 50, 50, 50],
        "ht003": [2, 2, 2, 2, 1, 1, 2, None, 2, 1],
        "ht003c": [None, None, None, 1, 1, 2, None, None, None, ""],
        "ht003d": [None, None, None, None, 2, 1, None, None, None, None],
        "stateindividualweight": [1.0] * 10,
    })
    biomarker = pd.DataFrame({
        "prim_key": keys,
        "state": [1] * 10,
        "bm017": [120] * 10,
        "bm018": [80] * 10,
        "bm067": [99, 100, 129.9, 130, 220, 221, 165, 170, 175, 180],
        "bm071": [60] * 10,
        "bm076": [39, 40, 199, 200, 201, 90, 95, 100, 105, 110],
    })
    dbs = pd.DataFrame({
        "prim_key": keys,
        "hba1c": [5.699, 5.7, 6.499, 6.5, 6.5, 6.499, 7.0, 7.0, None, 5.0],
        "indiadbsweight": [1.0, 2.0, 1.0, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        "statedbsweight": [1.0] * 10,
    })
    return individual, biomarker, dbs


@pytest.fixture
def completed_audit(tmp_path, synthetic_frames):
    individual, biomarker, dbs = synthetic_frames
    output_dir = tmp_path / "aggregate-output"
    result = audit.audit_dataframes(individual, biomarker, dbs, output_dir)
    return output_dir, result


def test_age_under_45_is_excluded_from_primary_target(completed_audit):
    _, result = completed_audit
    flow = result["cohort_flow"]
    assert flow["excluded_under_45_count"] == 1
    assert flow["complete_target_count"] == 7
    assert flow["primary_target_eligible_count"] == 4
    assert flow["secondary_target_eligible_count"] == 7


def test_missing_target_evidence_is_excluded(completed_audit):
    _, result = completed_audit
    flow = result["cohort_flow"]
    assert flow["missing_ht003_count_among_age_45_plus"] == 1
    assert flow["missing_hba1c_count_among_age_45_plus"] == 1
    assert result["category_counts"]["five_category_outcome"][
        "denominator_complete_target"
    ] == 7


def test_category_boundaries_are_correct():
    age = pd.Series([45] * 6)
    report = pd.Series([2, 2, 2, 2, 1, 1])
    hba1c = pd.Series([5.699, 5.7, 6.499, 6.5, 6.5, 6.499])

    category, _ = audit.category_series(age, report, hba1c)

    assert category.tolist() == [1, 2, 2, 3, 4, 5]


def test_binary_target_uses_categories_three_four_and_five():
    age = pd.Series([50] * 5)
    report = pd.Series([2, 2, 2, 1, 1])
    hba1c = pd.Series([5.0, 6.0, 7.0, 7.0, 5.0])

    category, binary = audit.category_series(age, report, hba1c)

    assert category.tolist() == [1, 2, 3, 4, 5]
    assert binary.tolist() == [0, 0, 1, 1, 1]


def test_diagnosed_excluded_from_primary_but_eligible_for_secondary():
    age = pd.Series([50, 50, 50])
    report = pd.Series([2, 1, 1])
    hba1c = pd.Series([6.5, 6.5, 5.0])

    primary = audit.undiagnosed_target_series(age, report, hba1c)
    _, secondary = audit.category_series(age, report, hba1c)

    assert primary.iloc[0] == 1
    assert primary.iloc[1:].isna().all()
    assert secondary.tolist() == [1, 1, 1]


def test_exact_hba1c_boundary_is_positive_for_both_targets():
    age = pd.Series([45, 45, 45])
    report = pd.Series([2, 2, 1])
    hba1c = pd.Series([6.499, 6.5, 6.5])

    primary = audit.undiagnosed_target_series(age, report, hba1c)
    _, secondary = audit.category_series(age, report, hba1c)

    assert primary.iloc[:2].tolist() == [0, 1]
    assert pd.isna(primary.iloc[2])
    assert secondary.tolist() == [0, 1, 1]


def test_ineligible_evidence_is_excluded_from_both_targets():
    age = pd.Series([44, 50, 50, 50])
    report = pd.Series([2, None, 3, 2])
    hba1c = pd.Series([7.0, 7.0, 7.0, -0.1])

    primary = audit.undiagnosed_target_series(age, report, hba1c)
    _, secondary = audit.category_series(age, report, hba1c)

    assert primary.isna().all()
    assert secondary.isna().all()


def test_expected_aggregate_count_check_fails_loudly():
    definition = {"eligibility": ["synthetic fixture"]}
    primary = audit._target_report(
        pd.Series([0, 1], dtype="Int64"),
        "target_undiagnosed_diabetes",
        definition,
    )
    secondary = audit._target_report(
        pd.Series([0, 1, 1], dtype="Int64"),
        "target_any_diabetes",
        definition,
    )

    with pytest.raises(ValueError, match="Expected aggregate count check failed"):
        audit.validate_expected_target_counts(primary, secondary)


def test_aggregate_outputs_name_both_targets(completed_audit):
    _, result = completed_audit
    targets = result["category_counts"]["targets"]

    assert targets["target_undiagnosed_diabetes"]["eligible_total"] == 4
    assert targets["target_undiagnosed_diabetes"]["positive_count"] == 1
    assert targets["target_undiagnosed_diabetes"]["negative_count"] == 3
    assert targets["target_any_diabetes"]["eligible_total"] == 7
    assert targets["target_any_diabetes"]["positive_count"] == 4
    assert targets["target_any_diabetes"]["negative_count"] == 3


def test_medication_blanks_are_not_treated_as_no(completed_audit):
    _, result = completed_audit
    medication = result["medication_consistency"]
    oral = medication["among_diagnosed"]["oral_medication"]

    assert medication["blank_responses_treated_as_no"] is False
    assert oral["missing_count"] == 1
    assert not any(
        row["code"] == 0 and row["count"] >= 1 for row in oral["codes"]
    )


def test_duplicate_keys_fail(tmp_path, synthetic_frames):
    individual, biomarker, dbs = synthetic_frames
    biomarker.loc[1, "prim_key"] = biomarker.loc[0, "prim_key"]

    with pytest.raises(ValueError, match="duplicates"):
        audit.audit_dataframes(individual, biomarker, dbs, tmp_path / "out")


def test_many_to_many_merge_and_row_expansion_fail():
    left = pd.DataFrame({"prim_key": ["A", "A"], "hba1c": [5.0, 6.0]})
    right = pd.DataFrame({"prim_key": ["A", "A"], "bm017": [120, 130]})
    with pytest.raises(pd.errors.MergeError):
        audit.merge_one_to_one(left, right, "biomarker")
    with pytest.raises(ValueError, match="Row expansion rejected"):
        audit.reject_row_expansion(10, 11, "synthetic")


def test_identifiers_are_never_exported(completed_audit):
    output_dir, _ = completed_audit
    text = "\n".join(
        path.read_text(encoding="utf-8") for path in output_dir.iterdir()
    )
    for forbidden_value in (
        "SYNTHETIC-KEY-00", "SYNTHETIC-HH-00", "SYNTHETIC-SSU-00"
    ):
        assert forbidden_value not in text


def test_outputs_are_aggregate_only(completed_audit):
    output_dir, result = completed_audit
    assert {path.name for path in output_dir.iterdir()} == set(
        audit.OUTPUT_FILENAMES
    )
    assert result["category_counts"]["participant_level_target_exported"] is False
    assert result["group_structure"]["identifier_values_exported"] is False
    assert result["group_structure"]["unique_ssuid_count"] == 3
    assert result["group_structure"]["unique_household_count"] == 5


def test_reader_loads_exact_approved_columns(tmp_path):
    path = tmp_path / "dbs.dta"
    path.touch()
    metadata = SimpleNamespace(
        column_names=audit.APPROVED_COLUMNS["dbs"] + ["unapproved_secret"],
    )
    calls = []

    def reader(file_path, **kwargs):
        calls.append(kwargs)
        if kwargs.get("metadataonly"):
            return pd.DataFrame(), metadata
        return pd.DataFrame({column: [1] for column in kwargs["usecols"]}), metadata

    frame = audit.read_approved_columns(path, "dbs", reader=reader)

    assert calls[1]["usecols"] == audit.APPROVED_COLUMNS["dbs"]
    assert list(frame.columns) == audit.APPROVED_COLUMNS["dbs"]
    assert "unapproved_secret" not in calls[1]["usecols"]
