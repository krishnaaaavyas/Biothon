"""Privacy-safe, read-only LASI Wave 1 diabetes cohort audit.

The CLI reads only explicitly approved columns from three caller-supplied
Stata files. Outputs contain aggregate counts and summaries only: no join-key
values, participant-level records, or sample rows are printed or written.
This module does not construct a diabetes target and never trains a model.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd


JOIN_KEY = "prim_key"
DBS_ESTABLISHED_ROWS = 64_399

REQUIRED_COLUMNS = {
    "individual": [
        JOIN_KEY,
        "dm003",
        "dm005",
        "ht003",
        "ht003c",
        "ht003d",
    ],
    "biomarker": [
        JOIN_KEY,
        "bm017",
        "bm018",
        "bm067",
        "bm071",
        "bm076",
    ],
    "dbs": [JOIN_KEY, "hba1c"],
}

OPTIONAL_COLUMNS = {
    "individual": ["stateindividualweight"],
    "biomarker": [],
    "dbs": ["indiadbsweight", "statedbsweight"],
}

# These fields are included only when a metadata label exactly confirms the
# concept. No undocumented column name is interpreted by this audit.
CONFIRMED_DESIGN_LABELS = {
    "state",
    "state code",
    "rural urban",
    "rural/urban",
    "primary sampling unit",
    "psu",
    "stratum",
    "strata",
    "survey weight",
    "state weight",
}

OUTPUT_FILENAMES = {
    "join_audit": "lasi_diabetes_join_audit.json",
    "missingness": "lasi_diabetes_missingness.csv",
    "categories": "lasi_diabetes_categories.json",
    "numeric_summary": "lasi_diabetes_numeric_summary.csv",
    "target_evidence": "lasi_diabetes_target_evidence.json",
    "cohort_flow": "lasi_diabetes_cohort_flow.json",
    "manual_review": "lasi_diabetes_manual_review.md",
}

CATEGORICAL_FIELDS = {
    "individual.dm003",
    "individual.ht003",
    "individual.ht003c",
    "individual.ht003d",
}

WEIGHT_FIELDS = {
    "individual.stateindividualweight",
    "dbs.indiadbsweight",
    "dbs.statedbsweight",
}

KNOWN_NUMERIC_FIELDS = {
    "individual.dm005",
    "biomarker.bm017",
    "biomarker.bm018",
    "biomarker.bm067",
    "biomarker.bm071",
    "biomarker.bm076",
    "dbs.hba1c",
} | WEIGHT_FIELDS

PERCENTILES = [0.01, 0.05, 0.25, 0.50, 0.75, 0.95, 0.99]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build aggregate LASI Wave 1 diabetes cohort audit outputs only."
        )
    )
    parser.add_argument("--individual-path", required=True, type=Path)
    parser.add_argument("--biomarker-path", required=True, type=Path)
    parser.add_argument("--dbs-path", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def _normalise_label(label: Any) -> str:
    return " ".join(str(label or "").lower().strip().split())


def _metadata_confirmed_design_columns(metadata: Any) -> list[str]:
    labels = getattr(metadata, "column_names_to_labels", {}) or {}
    confirmed = []
    for column in getattr(metadata, "column_names", []) or []:
        if _normalise_label(labels.get(column)) in CONFIRMED_DESIGN_LABELS:
            confirmed.append(column)
    return confirmed


def read_approved_columns(
    file_path: Path,
    role: str,
    reader: Callable[..., tuple[pd.DataFrame, Any]] | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    """Read only required, optional, or exactly metadata-confirmed columns."""
    if role not in REQUIRED_COLUMNS:
        raise ValueError(f"Unknown file role: {role}")
    if not file_path.is_file():
        raise FileNotFoundError(f"LASI {role} file not found: {file_path}")

    if reader is None:
        import pyreadstat

        reader = pyreadstat.read_dta

    _, metadata = reader(str(file_path), metadataonly=True)
    available = {
        column.lower(): column
        for column in (getattr(metadata, "column_names", []) or [])
    }

    missing_required = [
        column for column in REQUIRED_COLUMNS[role]
        if column.lower() not in available
    ]
    if missing_required:
        raise ValueError(
            f"{role} file is missing approved required columns: "
            f"{missing_required}"
        )

    approved = [available[column.lower()] for column in REQUIRED_COLUMNS[role]]
    approved.extend(
        available[column.lower()]
        for column in OPTIONAL_COLUMNS[role]
        if column.lower() in available
    )
    if role in {"individual", "biomarker"}:
        approved.extend(
            column for column in _metadata_confirmed_design_columns(metadata)
            if column not in approved
        )

    dataframe, _ = reader(
        str(file_path),
        usecols=approved,
        apply_value_formats=False,
    )
    canonical_names = {
        actual: lower
        for lower, actual in available.items()
        if actual in approved
    }
    dataframe = dataframe.rename(columns=canonical_names)
    return dataframe, list(dataframe.columns)


def _key_audit(dataframe: pd.DataFrame, role: str) -> dict[str, Any]:
    if JOIN_KEY not in dataframe:
        raise ValueError(f"{role}: required join key {JOIN_KEY!r} is missing")
    key = dataframe[JOIN_KEY]
    missing = int(key.isna().sum())
    duplicate_rows = int(key.dropna().duplicated().sum())
    duplicate_values = int(
        key.dropna()[key.dropna().duplicated(keep=False)].nunique()
    )
    summary = {
        "role": role,
        "rows": int(len(dataframe)),
        "missing_key_count": missing,
        "duplicate_row_count": duplicate_rows,
        "duplicate_key_value_count": duplicate_values,
        "unique_key_count": int(key.dropna().nunique()),
    }
    if missing:
        raise ValueError(f"{role}: {JOIN_KEY} contains {missing} missing values")
    if duplicate_rows:
        raise ValueError(
            f"{role}: {JOIN_KEY} contains {duplicate_rows} duplicate rows"
        )
    return summary


def _prefixed(dataframe: pd.DataFrame, role: str) -> pd.DataFrame:
    return dataframe.rename(columns={
        column: f"{role}__{column}"
        for column in dataframe.columns
        if column != JOIN_KEY
    })


def _reject_row_expansion(before: int, after: int, stage: str) -> None:
    if after > before:
        raise ValueError(
            f"Row expansion rejected at {stage}: {before} -> {after}"
        )
    if after > DBS_ESTABLISHED_ROWS:
        raise ValueError(
            f"Cohort exceeds established DBS maximum {DBS_ESTABLISHED_ROWS}: "
            f"{after}"
        )


def _merge_one_to_one(
    base: pd.DataFrame,
    right: pd.DataFrame,
    role: str,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    before = len(base)
    right_matches_base = right[JOIN_KEY].isin(base[JOIN_KEY])
    unmatched_right = int((~right_matches_base).sum())
    merged = base.merge(
        _prefixed(right, role),
        on=JOIN_KEY,
        how="left",
        validate="one_to_one",
        indicator=True,
    )
    after = len(merged)
    _reject_row_expansion(before, after, role)
    unmatched = int((merged["_merge"] == "left_only").sum())
    merged = merged.drop(columns=["_merge"])
    return merged, {
        "join": f"dbs_left_join_{role}",
        "rows_before": int(before),
        "rows_after": int(after),
        "unmatched_base_rows": unmatched,
        "matched_base_rows": int(after - unmatched),
        "right_source_rows": int(len(right)),
        "right_source_rows_matching_base": int(right_matches_base.sum()),
        "unmatched_right_source_rows": unmatched_right,
        "validation": "one_to_one",
    }


def _field_name(role: str, column: str) -> str:
    return f"{role}.{column}"


def _merged_column(role: str, column: str) -> str:
    return column if role == "dbs" else f"{role}__{column}"


def _json_scalar(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        numeric = float(value)
        return numeric if math.isfinite(numeric) else str(numeric)
    return str(value)


def _category_counts(series: pd.Series) -> dict[str, Any]:
    counts = series.value_counts(dropna=False)
    return {
        "total_rows": int(len(series)),
        "missing_count": int(series.isna().sum()),
        "codes": [
            {"code": _json_scalar(code), "count": int(count)}
            for code, count in counts.items()
        ],
    }


def _numeric_summary(field: str, series: pd.Series) -> dict[str, Any]:
    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    summary: dict[str, Any] = {
        "variable": field,
        "rows": int(len(series)),
        "numeric_count": int(valid.size),
        "missing_or_nonnumeric_count": int(len(series) - valid.size),
        "suspicious_negative_count": int((valid < 0).sum()),
    }
    if valid.empty:
        summary.update({
            "min": None, "p01": None, "p05": None, "p25": None,
            "p50": None, "p75": None, "p95": None, "p99": None,
            "max": None,
        })
        return summary
    quantiles = valid.quantile(PERCENTILES)
    summary.update({
        "min": float(valid.min()),
        "p01": float(quantiles.loc[0.01]),
        "p05": float(quantiles.loc[0.05]),
        "p25": float(quantiles.loc[0.25]),
        "p50": float(quantiles.loc[0.50]),
        "p75": float(quantiles.loc[0.75]),
        "p95": float(quantiles.loc[0.95]),
        "p99": float(quantiles.loc[0.99]),
        "max": float(valid.max()),
    })
    return summary


def _availability(series: pd.Series) -> dict[str, Any]:
    available = int(series.notna().sum())
    return {
        "available_count": available,
        "missing_count": int(series.isna().sum()),
        "availability_rate": float(available / len(series)) if len(series) else None,
    }


def _implausible_counts(merged: pd.DataFrame) -> dict[str, int]:
    bounds = {
        "individual__dm005": (0, 120),
        "biomarker__bm017": (40, 300),
        "biomarker__bm018": (20, 200),
        "biomarker__bm067": (50, 250),
        "biomarker__bm071": (10, 300),
        "biomarker__bm076": (30, 250),
        "hba1c": (0, 30),
    }
    result = {}
    for column, (minimum, maximum) in bounds.items():
        if column not in merged:
            continue
        numeric = pd.to_numeric(merged[column], errors="coerce")
        result[column.replace("__", ".")] = int(
            ((numeric < minimum) | (numeric > maximum)).sum()
        )
    return result


def _bmi_audit(merged: pd.DataFrame) -> tuple[pd.Series, dict[str, Any]]:
    height = pd.to_numeric(merged["biomarker__bm067"], errors="coerce")
    weight = pd.to_numeric(merged["biomarker__bm071"], errors="coerce")
    valid = height.gt(0) & weight.gt(0)
    bmi = pd.Series(np.nan, index=merged.index, dtype=float)
    bmi.loc[valid] = weight.loc[valid] / ((height.loc[valid] / 100.0) ** 2)
    summary = _availability(bmi)
    summary["comparison_only"] = True
    summary["official_bmi_replaced"] = False
    summary["implausible_bmi_count"] = int(((bmi < 10) | (bmi > 80)).sum())
    return bmi, summary


def _age_audit(series: pd.Series) -> dict[str, Any]:
    age = pd.to_numeric(series, errors="coerce")
    return {
        "availability": _availability(age),
        "aged_45_plus_count": int((age >= 45).sum()),
        "distribution": {
            "under_45": int((age < 45).sum()),
            "45_to_59": int(((age >= 45) & (age < 60)).sum()),
            "60_to_74": int(((age >= 60) & (age < 75)).sum()),
            "75_plus": int((age >= 75).sum()),
        },
    }


def _hba1c_ranges(series: pd.Series) -> dict[str, int]:
    value = pd.to_numeric(series, errors="coerce")
    usable = value[value >= 0]
    return {
        "below_5_7": int((usable < 5.7).sum()),
        "5_7_to_6_4": int(((usable >= 5.7) & (usable < 6.5)).sum()),
        "6_5_or_above": int((usable >= 6.5).sum()),
        "negative_or_special_for_manual_review": int((value < 0).sum()),
    }


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _assert_aggregate_outputs(output_dir: Path) -> None:
    allowed = set(OUTPUT_FILENAMES.values())
    actual = {path.name for path in output_dir.iterdir() if path.is_file()}
    unexpected = actual - allowed
    if unexpected:
        raise RuntimeError(f"Unexpected audit output files created: {unexpected}")
    for path in output_dir.iterdir():
        if path.is_file() and "prim_key" in path.read_text(
            encoding="utf-8", errors="ignore"
        ).lower():
            raise RuntimeError(
                f"Identifier field name leaked into aggregate output: {path.name}"
            )


def audit_dataframes(
    individual: pd.DataFrame,
    biomarker: pd.DataFrame,
    dbs: pd.DataFrame,
    output_dir: Path,
    source_columns: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    """Audit in-memory frames and write only the seven aggregate outputs."""
    source_columns = source_columns or {
        "individual": list(individual.columns),
        "biomarker": list(biomarker.columns),
        "dbs": list(dbs.columns),
    }
    key_summaries = {
        role: _key_audit(frame, role)
        for role, frame in {
            "individual": individual,
            "biomarker": biomarker,
            "dbs": dbs,
        }.items()
    }
    if len(dbs) > DBS_ESTABLISHED_ROWS:
        raise ValueError(
            f"DBS base has {len(dbs)} rows; expected at most {DBS_ESTABLISHED_ROWS}"
        )

    base = _prefixed(dbs, "dbs")
    # Restore the key and use unprefixed DBS variables for simple reporting.
    base = base.rename(columns={
        f"dbs__{column}": column
        for column in dbs.columns if column != JOIN_KEY
    })
    merged_biomarker, biomarker_flow = _merge_one_to_one(
        base, biomarker, "biomarker"
    )
    merged, individual_flow = _merge_one_to_one(
        merged_biomarker, individual, "individual"
    )
    _reject_row_expansion(len(dbs), len(merged), "final_cohort")

    field_map: dict[str, str] = {}
    for role, columns in source_columns.items():
        for column in columns:
            if column == JOIN_KEY:
                continue
            field_map[_field_name(role, column)] = _merged_column(role, column)

    missingness_rows = []
    numeric_rows = []
    categories: dict[str, Any] = {}
    suspicious: dict[str, int] = {}
    for field, merged_column in field_map.items():
        if merged_column not in merged:
            continue
        series = merged[merged_column]
        missingness_rows.append({
            "variable": field,
            "rows": int(len(series)),
            "missing_count": int(series.isna().sum()),
            "missing_rate": float(series.isna().mean()),
        })
        numeric = _numeric_summary(field, series)
        numeric_rows.append(numeric)
        suspicious[field] = numeric["suspicious_negative_count"]
        if field not in KNOWN_NUMERIC_FIELDS:
            categories[field] = _category_counts(series)

    bmi, bmi_summary = _bmi_audit(merged)
    numeric_rows.append(_numeric_summary("audit.calculated_bmi", bmi))

    age = merged["individual__dm005"]
    sex = merged["individual__dm003"]
    hba1c = merged["hba1c"]
    self_reported = merged["individual__ht003"]
    medication = merged["individual__ht003c"]
    insulin = merged["individual__ht003d"]

    target_evidence = {
        "target_constructed": False,
        "self_reported_diabetes": _category_counts(self_reported),
        "diabetes_oral_medication": _category_counts(medication),
        "insulin_use": _category_counts(insulin),
        "hba1c_availability": _availability(hba1c),
        "possible_hba1c_ranges": _hba1c_ranges(hba1c),
    }
    availability = {
        "blood_pressure": {
            "systolic": _availability(merged["biomarker__bm017"]),
            "diastolic": _availability(merged["biomarker__bm018"]),
        },
        "bmi_audit_comparison": bmi_summary,
        "waist": _availability(merged["biomarker__bm076"]),
        "survey_weights": {
            field: _availability(merged[column])
            for field, column in field_map.items()
            if field in WEIGHT_FIELDS and column in merged
        },
        "metadata_confirmed_survey_design_fields": {
            field: _availability(merged[column])
            for field, column in field_map.items()
            if column in merged
            and field.split(".", 1)[1] not in (
                set(REQUIRED_COLUMNS[field.split(".", 1)[0]])
                | set(OPTIONAL_COLUMNS[field.split(".", 1)[0]])
            )
        },
    }
    cohort_flow = {
        "base": "dbs",
        "dbs_rows": int(len(dbs)),
        "joins": [biomarker_flow, individual_flow],
        "final_rows": int(len(merged)),
        "row_expansion": int(len(merged) - len(dbs)),
    }
    join_audit = {
        "contains_identifier_values": False,
        "join_key_name_exported": False,
        "pandas_validation": "one_to_one",
        "key_summaries": key_summaries,
        "established_unique_key_counts": {
            "individual": 73_396,
            "biomarker": 66_859,
            "dbs": DBS_ESTABLISHED_ROWS,
        },
        "cohort_flow": cohort_flow,
        "implausible_measurement_counts": _implausible_counts(merged),
        "suspicious_negative_or_special_counts": suspicious,
        "age_audit": _age_audit(age),
        "sex_distribution": _category_counts(sex),
        "availability": availability,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(missingness_rows).to_csv(
        output_dir / OUTPUT_FILENAMES["missingness"], index=False
    )
    pd.DataFrame(numeric_rows).to_csv(
        output_dir / OUTPUT_FILENAMES["numeric_summary"], index=False
    )
    _write_json(output_dir / OUTPUT_FILENAMES["join_audit"], join_audit)
    _write_json(output_dir / OUTPUT_FILENAMES["categories"], {
        "contains_participant_records": False,
        "variables": categories,
    })
    _write_json(
        output_dir / OUTPUT_FILENAMES["target_evidence"], target_evidence
    )
    _write_json(output_dir / OUTPUT_FILENAMES["cohort_flow"], cohort_flow)

    manual_review = "\n".join([
        "# LASI Diabetes Cohort Manual Review",
        "",
        "This report contains aggregate counts only. No participant IDs or records are exported.",
        "",
        "## Required review items",
        "",
        "- No final diabetes target has been constructed.",
        "- Negative or special numeric values are reported, not interpreted as missing.",
        "- Category codes are reported without guessing undocumented meanings.",
        "- Calculated BMI is comparison-only and does not replace an official BMI field.",
        "- Confirm any metadata-approved survey-design fields before analysis use.",
        "",
        "## Aggregate flags",
        "",
        f"- Final cohort rows: {len(merged)}",
        f"- Number aged 45+: {join_audit['age_audit']['aged_45_plus_count']}",
        f"- HbA1c available: {target_evidence['hba1c_availability']['available_count']}",
        f"- Implausible measurement flags: {sum(join_audit['implausible_measurement_counts'].values())}",
    ])
    (output_dir / OUTPUT_FILENAMES["manual_review"]).write_text(
        manual_review, encoding="utf-8"
    )
    _assert_aggregate_outputs(output_dir)
    return {
        "join_audit": join_audit,
        "cohort_flow": cohort_flow,
        "target_evidence": target_evidence,
    }


def main() -> None:
    args = parse_args()
    frames = {}
    columns = {}
    for role, path in {
        "individual": args.individual_path,
        "biomarker": args.biomarker_path,
        "dbs": args.dbs_path,
    }.items():
        frames[role], columns[role] = read_approved_columns(path, role)

    audit_dataframes(
        individual=frames["individual"],
        biomarker=frames["biomarker"],
        dbs=frames["dbs"],
        output_dir=args.output_dir,
        source_columns=columns,
    )
    print("LASI diabetes cohort audit complete.")
    print("Aggregate outputs only; no identifier values or participant records exported.")


if __name__ == "__main__":
    main()
