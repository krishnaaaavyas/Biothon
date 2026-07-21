"""Synthetic-metadata tests for the LASI enrichment audit."""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from training import audit_lasi_diabetes_enrichment_features as audit


@pytest.fixture
def synthetic_metadata():
    return SimpleNamespace(
        column_names=[
            "fm_diab",
            "pa_vig",
            "pa_walk_freq",
            "sym_polyuria",
            "sym_blur",
            "hba1c",
            "ht003",
            "ht003c",
            "insulin_use",
            "prim_key",
            "unrelated",
            "heart_family",
        ],
        column_names_to_labels={
            "fm_diab": (
                "Family history of diabetes in biological relative"
            ),
            "pa_vig": "Frequency of vigorous activity",
            "pa_walk_freq": (
                "Walking exercise duration and frequency"
            ),
            "sym_polyuria": "Frequent urination or polyuria",
            "sym_blur": "Blurred vision during the last year",
            "hba1c": "HbA1c measurement",
            "ht003": (
                "Respondent self-reported diagnosed diabetes "
                "or high blood sugar"
            ),
            "ht003c": "Diabetes oral medication",
            "insulin_use": "Insulin use after diagnosis",
            "prim_key": "Primary respondent key",
            "unrelated": "Current housing material",
            "heart_family": "Family history of heart disease",
        },
        readstat_variable_types={
            "fm_diab": "int8",
            "pa_vig": "int8",
            "pa_walk_freq": "int8",
            "sym_polyuria": "int8",
            "sym_blur": "int8",
        },
        variable_value_labels={
            "fm_diab": {
                2: "No",
                1: "Yes",
            },
            "pa_vig": {
                1: "Every day",
                2: "Weekly",
            },
        },
    )


def _expected_source(tmp_path: Path) -> Path:
    source = (
        tmp_path
        / "private"
        / audit.EXPECTED_INDIVIDUAL_FILENAME
    )
    source.parent.mkdir(parents=True, exist_ok=True)
    source.touch()
    return source


def test_metadata_reader_never_reads_participant_rows(
    tmp_path,
    synthetic_metadata,
    monkeypatch,
):
    monkeypatch.setattr(
        audit,
        "REPOSITORY_ROOT",
        tmp_path / "repo",
    )

    source = _expected_source(tmp_path)
    calls = []

    def reader(path, **kwargs):
        calls.append(kwargs)

        if kwargs != {"metadataonly": True}:
            raise AssertionError(
                "Participant rows must never be requested"
            )

        return None, synthetic_metadata

    result = audit.read_metadata_only(
        source,
        reader=reader,
    )

    assert result is synthetic_metadata
    assert calls == [{"metadataonly": True}]


def test_reader_refuses_fallback_when_metadataonly_is_unsupported(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        audit,
        "REPOSITORY_ROOT",
        tmp_path / "repo",
    )

    source = _expected_source(tmp_path)

    def unsupported_reader(path, **kwargs):
        raise TypeError("metadataonly unsupported")

    with pytest.raises(
        RuntimeError,
        match="refusing to read participant rows",
    ):
        audit.read_metadata_only(
            source,
            reader=unsupported_reader,
        )


def test_candidates_are_grouped_into_approved_domains(
    synthetic_metadata,
):
    payload = audit.candidates_from_metadata(
        synthetic_metadata,
        audit.EXPECTED_INDIVIDUAL_FILENAME,
    )

    domains = payload["semantic_domains"]

    assert {
        item["variable_name"]
        for item in domains["family_history"]
    } == {"fm_diab"}

    assert {
        item["variable_name"]
        for item in domains["physical_activity"]
    } == {
        "pa_vig",
        "pa_walk_freq",
    }

    assert {
        item["variable_name"]
        for item in domains["symptoms"]
    } == {
        "sym_polyuria",
        "sym_blur",
    }


def test_family_history_with_high_blood_sugar_is_not_false_leakage():
    result = audit.classify_candidate(
        "fm304",
        (
            "Any biological family member diagnosed with "
            "diabetes or high blood sugar"
        ),
    )

    assert result is not None
    assert result["semantic_domain"] == "family_history"
    assert result["recommendation"] == "suitable_candidate"


def test_household_membership_alone_is_not_treated_as_biological_history():
    result = audit.classify_candidate(
        "household_diabetes",
        "Someone in the household has diabetes",
    )

    assert result is None


@pytest.mark.parametrize(
    ("name", "label"),
    [
        (
            "hba1c",
            "HbA1c measurement",
        ),
        (
            "fasting_glucose",
            "Fasting glucose measurement",
        ),
        (
            "ht003",
            "Respondent self-reported diagnosed diabetes",
        ),
        (
            "ht003c",
            "Diabetes oral medication",
        ),
        (
            "insulin",
            "Insulin use",
        ),
        (
            "prim_key",
            "Primary key",
        ),
    ],
)
def test_leakage_and_identifier_variables_are_rejected(
    name,
    label,
):
    result = audit.classify_candidate(name, label)

    assert result is not None
    assert result["recommendation"] == "reject"
    assert result["semantic_domain"] == "excluded"


def test_rejected_metadata_is_not_exported(
    synthetic_metadata,
):
    payload = audit.candidates_from_metadata(
        synthetic_metadata,
        audit.EXPECTED_INDIVIDUAL_FILENAME,
    )

    text = json.dumps(payload).lower()

    for forbidden in (
        "hba1c measurement",
        "ht003",
        "ht003c",
        "insulin_use",
        "prim_key",
    ):
        assert forbidden not in text

    assert (
        payload[
            "excluded_leakage_or_identifier_metadata_count"
        ]
        == 5
    )


def test_unsupported_concepts_are_not_invented(
    synthetic_metadata,
):
    result = audit.classify_candidate(
        "housing",
        "Current housing material",
    )

    assert result is None

    payload = audit.candidates_from_metadata(
        synthetic_metadata,
        audit.EXPECTED_INDIVIDUAL_FILENAME,
    )

    text = json.dumps(payload)

    assert "unrelated" not in text
    assert "heart_family" not in text


def test_output_has_metadata_only_and_no_participant_values(
    tmp_path,
    synthetic_metadata,
    monkeypatch,
    capsys,
):
    monkeypatch.setattr(
        audit,
        "REPOSITORY_ROOT",
        tmp_path / "repo",
    )

    source = _expected_source(tmp_path)
    output = tmp_path / "external-output"

    path = audit.write_audit(
        synthetic_metadata,
        source,
        output,
    )

    payload = json.loads(
        path.read_text(encoding="utf-8")
    )

    assert payload["metadata_only"] is True
    assert payload["participant_rows_read"] is False
    assert payload["participant_values_exported"] is False
    assert payload["metadata_column_count_scanned"] == 12

    assert (
        "SYNTHETIC-PARTICIPANT-VALUE"
        not in path.read_text(encoding="utf-8")
    )

    assert capsys.readouterr().out == ""


@pytest.mark.parametrize(
    "source_name",
    [
        r"C:\restricted\3_LASI_W1_Individual_v4.dta",
        "/restricted/3_LASI_W1_Individual_v4.dta",
    ],
)
def test_source_uses_basename_and_excludes_absolute_path(
    synthetic_metadata,
    source_name,
):
    payload = audit.candidates_from_metadata(
        synthetic_metadata,
        source_name,
    )

    text = json.dumps(payload)

    assert "restricted" not in text

    assert (
        payload["source_filename"]
        == audit.EXPECTED_INDIVIDUAL_FILENAME
    )


def test_raw_input_inside_repository_fails(
    tmp_path,
    monkeypatch,
):
    repo = tmp_path / "repo"

    source = (
        repo
        / "private-data"
        / audit.EXPECTED_INDIVIDUAL_FILENAME
    )

    source.parent.mkdir(parents=True)
    source.touch()

    monkeypatch.setattr(
        audit,
        "REPOSITORY_ROOT",
        repo,
    )

    with pytest.raises(
        ValueError,
        match="raw input must be outside",
    ):
        audit.validate_input_path(source)


def test_unexpected_individual_release_fails(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        audit,
        "REPOSITORY_ROOT",
        tmp_path / "repo",
    )

    source = (
        tmp_path
        / "private"
        / "LASI_individual_old.dta"
    )

    source.parent.mkdir()
    source.touch()

    with pytest.raises(
        ValueError,
        match="Unexpected LASI Individual file",
    ):
        audit.validate_input_path(source)


def test_output_directory_inside_repository_fails(
    tmp_path,
    monkeypatch,
):
    repo = tmp_path / "repo"
    repo.mkdir()

    monkeypatch.setattr(
        audit,
        "REPOSITORY_ROOT",
        repo,
    )

    with pytest.raises(
        ValueError,
        match="outside the Git repository",
    ):
        audit.validate_output_dir(
            repo / "output"
        )


def test_production_cli_requires_all_inputs(monkeypatch):
    monkeypatch.setattr(
        "sys.argv",
        ["audit"],
    )

    with pytest.raises(SystemExit):
        audit.parse_args()


def test_codebook_metadata_is_preserved_without_frequencies(
    synthetic_metadata,
):
    payload = audit.candidates_from_metadata(
        synthetic_metadata,
        audit.EXPECTED_INDIVIDUAL_FILENAME,
    )

    family = payload[
        "semantic_domains"
    ]["family_history"][0]

    assert family[
        "value_label_codebook_metadata"
    ] == [
        {
            "code": "1",
            "label": "Yes",
        },
        {
            "code": "2",
            "label": "No",
        },
    ]

    assert "frequency" not in family
    assert "count" not in family