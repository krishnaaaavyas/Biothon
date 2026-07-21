"""Metadata-only audit for LASI diabetes feature-enrichment candidates.

The script never reads participant rows. It inspects variable names, labels,
storage types, and codebook metadata from one caller-supplied Individual DTA
file and writes one aggregate metadata report outside the Git repository.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path, PureWindowsPath
from typing import Any, Callable


OUTPUT_FILENAME = "lasi_diabetes_enrichment_variable_candidates.json"
EXPECTED_INDIVIDUAL_FILENAME = "3_LASI_W1_Individual_v4.dta"
REPORT_SCHEMA_VERSION = "1.1"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

DOMAIN_RULES = {
    "family_history": [
    r"\bfamily history\b.*\b(?:diabet|high blood sugar)",
    r"\b(?:diabet|high blood sugar).*\bfamily history\b",
    r"\b(?:father|mother|parent|sibling|brother|sister|biological relative|family member)\b.*\b(?:diabet|high blood sugar)",
    r"\b(?:diabet|high blood sugar).*\b(?:father|mother|parent|sibling|brother|sister|biological relative|family member)\b",
    ],
    "physical_activity": [
        r"\bvigorous activity\b", r"\bmoderate activity\b",
        r"\blight activity\b", r"\bwalking\b", r"\bexercise\b",
        r"\bsedentary\b", r"\binactive\b",
        r"\bphysical activity\b.*\b(?:frequency|duration)\b",
        r"\b(?:frequency|duration)\b.*\bphysical activity\b",
    ],
    "symptoms": [
        r"\bfrequent urination\b", r"\bpolyuria\b",
        r"\bexcessive thirst\b", r"\bpolydipsia\b",
        r"\bunexplained weight loss\b", r"\bfatigue\b",
        r"\bblurred vision\b", r"\brecurrent infection",
        r"\bslow[- ]healing wounds?\b", r"\bnumbness\b", r"\btingling\b",
    ],
}

HARD_LEAKAGE_RULES = [
    r"\bhba1c\b",
    r"\b(?:fasting|random|plasma|serum) glucose\b",
    r"\bglucose\b.*\b(?:measure(?:ment|d)?|test|result|level|value|reading)\b",
    r"\b(?:measure(?:ment|d)?|test|result|level|value|reading)\b.*\bglucose\b",
    r"\bblood sugar\b.*\b(?:measure(?:ment|d)?|test|result|level|value|reading)\b",
    r"\b(?:measure(?:ment|d)?|test|result|level|value|reading)\b.*\bblood sugar\b",
    r"\btarget\b",
]

RESPONDENT_LEAKAGE_RULES = [
    r"\bself[- ]reported\b.*\b(?:diabet|high blood sugar)",
    r"\brespondent\b.*\b(?:diagnos(?:is|ed)|told)\b.*\b(?:diabet|high blood sugar)",
    r"\b(?:diagnos(?:is|ed)|told)\b.*\brespondent\b.*\b(?:diabet|high blood sugar)",
    r"\bdiabet.*\bmedicat",
    r"\bmedicat.*\bdiabet",
    r"\binsulin\b",
    r"\bpost[- ]diagnos",
    r"\btreatment\b.*\bdiabet",
]
IDENTIFIER_NAME_RULES = [
    r"(?:^|_)(?:prim_key|hhid|ssuid|person_id|participant_id|respondent_id)(?:$|_)",
    r"(?:^|_)(?:stateid|psu|cluster_id)(?:$|_)",
    r"(?:^|_)id(?:$|_)",
]

QUESTION_MAPPINGS = {
    "family_history": "Has a biological parent or sibling had diabetes?",
    "physical_activity": "How often and how intensely are you physically active?",
    "symptoms": "Have you experienced this potential diabetes-screening symptom?",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--individual-dta", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False
def _safe_basename(path_like: str | Path) -> str:
    """Return a safe basename for POSIX or Windows-style paths."""
    return PureWindowsPath(str(path_like)).name


def validate_input_path(individual_dta: Path) -> None:
    if _is_within(individual_dta, REPOSITORY_ROOT):
        raise ValueError("LASI raw input must be outside the Git repository")

    if _safe_basename(individual_dta).lower() != EXPECTED_INDIVIDUAL_FILENAME.lower():
        raise ValueError(
            f"Unexpected LASI Individual file {_safe_basename(individual_dta)!r}; "
            f"expected {EXPECTED_INDIVIDUAL_FILENAME!r}"
        )

def validate_output_dir(output_dir: Path) -> None:
    if _is_within(output_dir, REPOSITORY_ROOT):
        raise ValueError("Output directory must be outside the Git repository")


def _normalise(text: Any) -> str:
    if text is None:
        return ""
    return " ".join(str(text).lower().strip().split())

def _matches(patterns: list[str], text: str) -> bool:
    return any(re.search(pattern, text) for pattern in patterns)


def _classification(
    domain: str,
    recommendation: str,
    concern: str,
) -> dict[str, str]:
    return {
        "semantic_domain": domain,
        "possible_healthguard_question_mapping": QUESTION_MAPPINGS.get(
            domain, "none"
        ),
        "leakage_concern": concern,
        "recommendation": recommendation,
    }


def classify_candidate(variable_name: str, variable_label: str) -> dict[str, str] | None:
    """Classify from metadata text only; return None for unsupported concepts."""
    name = _normalise(variable_name)
    label = _normalise(variable_label)
    combined = f"{name.replace('_', ' ')} {label}"
    if _matches(IDENTIFIER_NAME_RULES, name):
        return _classification("excluded", "reject", "raw_identifier")

    if _matches(HARD_LEAKAGE_RULES, combined):
        return _classification(
            "excluded",
            "reject",
            "target_definition_or_laboratory_measurement_leakage",
        )

    # Family history must be checked before respondent diagnosis leakage.
    if _matches(DOMAIN_RULES["family_history"], combined):
        return _classification(
            "family_history",
            "suitable_candidate",
            "biological relationship and coding require manual confirmation",
        )

    if _matches(RESPONDENT_LEAKAGE_RULES, combined):
        return _classification(
            "excluded",
            "reject",
            "target_definition_or_post_diagnosis_leakage",
        )

    if _matches(DOMAIN_RULES["physical_activity"], combined):
        return _classification(
            "physical_activity",
            "suitable_candidate",
            "coding, recall period, and user-input mapping require manual review",
        )

    if _matches(DOMAIN_RULES["symptoms"], combined):
        return _classification(
            "symptoms",
            "exploratory_only",
            "symptom may be nonspecific and requires clinical/content review",
        )

    return None


def _json_codebook(value_labels: Any) -> list[dict[str, Any]]:
    if not isinstance(value_labels, dict):
        return []
    return [
        {"code": str(code), "label": str(label)}
        for code, label in sorted(value_labels.items(), key=lambda item: str(item[0]))
    ]


def candidates_from_metadata(metadata: Any, source_basename: str) -> dict[str, Any]:
    names = list(getattr(metadata, "column_names", []) or [])
    labels = getattr(metadata, "column_names_to_labels", {}) or {}
    storage = getattr(metadata, "readstat_variable_types", {}) or {}
    variable_value_labels = getattr(metadata, "variable_value_labels", {}) or {}
    grouped = {domain: [] for domain in DOMAIN_RULES}
    rejected_count = 0
    for name in names:
        label = labels.get(name, "") or ""
        classification = classify_candidate(name, label)
        if classification is None:
            continue
        if classification["recommendation"] == "reject":
            rejected_count += 1
            continue
        candidate = {
            "variable_name": str(name),
            "variable_label": str(label),
            "source_role": "individual",
            "source_filename": _safe_basename(source_basename),
            "metadata_column_count_scanned": len(names),
            "storage_type": str(storage.get(name, "unknown")),
            "value_label_codebook_metadata": _json_codebook(
                variable_value_labels.get(name)
            ),
            **classification,
        }
        grouped[classification["semantic_domain"]].append(candidate)
    for candidates in grouped.values():
        candidates.sort(key=lambda item: item["variable_name"].lower())
    return {
        "metadata_only": True,
        "participant_rows_read": False,
        "participant_values_exported": False,
        "source_role": "individual",
        "source_filename": _safe_basename(source_basename),
        "metadata_column_count_scanned": len(names),
        "semantic_domains": grouped,
        "candidate_count": sum(len(items) for items in grouped.values()),
        "excluded_leakage_or_identifier_metadata_count": rejected_count,
        "report_schema_version": REPORT_SCHEMA_VERSION,
    }


def read_metadata_only(
    individual_dta: Path,
    reader: Callable[..., tuple[Any, Any]] | None = None,
) -> Any:
    validate_input_path(individual_dta)
    if not individual_dta.is_file():
        raise FileNotFoundError(
    f"Required LASI Individual file is missing: "
    f"{_safe_basename(individual_dta)}"
)
    if reader is None:
        import pyreadstat
        reader = pyreadstat.read_dta
    try:
        _, metadata = reader(str(individual_dta), metadataonly=True)
    except TypeError as exc:
        raise RuntimeError(
        "Installed pyreadstat lacks metadata-only support; "
        "refusing to read participant rows"
    ) from exc
    return metadata


def write_audit(metadata: Any, source_path: Path, output_dir: Path) -> Path:
    validate_output_dir(output_dir)
    payload = candidates_from_metadata(metadata, _safe_basename(source_path))
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / OUTPUT_FILENAME
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return output_path


def main() -> None:
    args = parse_args()
    validate_input_path(args.individual_dta)
    validate_output_dir(args.output_dir)
    metadata = read_metadata_only(args.individual_dta)
    write_audit(metadata, args.individual_dta, args.output_dir)
    print("LASI diabetes enrichment metadata audit complete.")


if __name__ == "__main__":
    main()
