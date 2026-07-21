"""Privacy-safe LASI Wave 1 diabetes target-definition audit.

This script reads only explicitly approved columns from caller-supplied LASI
files, uses DBS as the base cohort, and writes aggregate reports only. It does
not export identifiers, participant-level records, or a participant-level
target, and it never trains a model.
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

EXPECTED_FILENAMES = {
    "individual": "3_LASI_W1_Individual_v4.dta",
    "biomarker": "4_LASI_W1_Biomarker.dta",
    "dbs": "LASI_Wave1_DBS-Dataset_v1_July2025_STATA.dta",
}

APPROVED_COLUMNS = {
    "individual": [
        "prim_key", "hhid", "ssuid", "dm003", "dm005", "ht003",
        "ht003c", "ht003d", "stateindividualweight",
    ],
    "biomarker": [
        "prim_key", "state", "bm017", "bm018", "bm067", "bm071",
        "bm076",
    ],
    "dbs": [
        "prim_key", "hba1c", "indiadbsweight", "statedbsweight",
    ],
}

IDENTIFIER_COLUMNS = {"prim_key", "hhid", "ssuid"}

CATEGORY_NAMES = {
    1: "no_diabetes",
    2: "prediabetes_range",
    3: "undiagnosed_diabetes",
    4: "diagnosed_diabetes_high_hba1c",
    5: "diagnosed_diabetes_lower_hba1c",
}

POSITIVE_CATEGORIES = {3, 4, 5}
NEGATIVE_CATEGORIES = {1, 2}

EXPECTED_TARGET_COUNTS = {
    "target_undiagnosed_diabetes": {
        "total": 50_865,
        "positive": 4_635,
        "negative": 46_230,
    },
    "target_any_diabetes": {
        "total": 58_367,
        "positive": 12_137,
        "negative": 46_230,
    },
}

OUTPUT_FILENAMES = [
    "lasi_target_cohort_flow.json",
    "lasi_target_category_counts.json",
    "lasi_target_weighted_summary.json",
    "lasi_medication_consistency.json",
    "lasi_predictor_outlier_audit.json",
    "lasi_group_structure.json",
    "lasi_target_manual_review.md",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create aggregate LASI diabetes target-definition audits."
    )
    parser.add_argument("--individual-path", required=True, type=Path)
    parser.add_argument("--biomarker-path", required=True, type=Path)
    parser.add_argument("--dbs-path", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def read_approved_columns(
    path: Path,
    role: str,
    reader: Callable[..., tuple[pd.DataFrame, Any]] | None = None,
) -> pd.DataFrame:
    """Read exactly the approved columns for one source file."""
    if role not in APPROVED_COLUMNS:
        raise ValueError(f"Unknown LASI role: {role}")
    if not path.is_file():
        raise FileNotFoundError(f"LASI {role} file not found: {path}")
    if reader is None:
        import pyreadstat

        reader = pyreadstat.read_dta

    _, metadata = reader(str(path), metadataonly=True)
    available = {
        column.lower(): column
        for column in (getattr(metadata, "column_names", []) or [])
    }
    missing = [
        column for column in APPROVED_COLUMNS[role]
        if column not in available
    ]
    if missing:
        raise ValueError(f"{role} file is missing approved columns: {missing}")

    usecols = [available[column] for column in APPROVED_COLUMNS[role]]
    dataframe, _ = reader(
        str(path), usecols=usecols, apply_value_formats=False
    )
    rename = {available[column]: column for column in APPROVED_COLUMNS[role]}
    return dataframe.rename(columns=rename)[APPROVED_COLUMNS[role]].copy()


def validate_input_filename(path: Path, role: str) -> None:
    expected = EXPECTED_FILENAMES[role]
    if path.name.lower() != expected.lower():
        raise ValueError(
            f"Unexpected {role} file {path.name!r}; expected {expected!r}"
        )


def validate_key(dataframe: pd.DataFrame, role: str) -> dict[str, int]:
    if JOIN_KEY not in dataframe:
        raise ValueError(f"{role}: missing required join key")
    key = dataframe[JOIN_KEY]
    missing = int(key.isna().sum())
    duplicates = int(key.dropna().duplicated().sum())
    if missing:
        raise ValueError(f"{role}: join key contains {missing} missing values")
    if duplicates:
        raise ValueError(f"{role}: join key contains {duplicates} duplicates")
    return {
        "rows": int(len(dataframe)),
        "missing_key_count": missing,
        "duplicate_key_row_count": duplicates,
        "unique_key_count": int(key.nunique()),
    }


def _prefix(dataframe: pd.DataFrame, role: str) -> pd.DataFrame:
    return dataframe.rename(columns={
        column: f"{role}__{column}"
        for column in dataframe.columns if column != JOIN_KEY
    })


def reject_row_expansion(before: int, after: int, stage: str) -> None:
    if after > before:
        raise ValueError(f"Row expansion rejected at {stage}: {before} -> {after}")


def merge_one_to_one(
    base: pd.DataFrame,
    right: pd.DataFrame,
    role: str,
) -> tuple[pd.DataFrame, dict[str, int | str]]:
    before = len(base)
    right_matches = right[JOIN_KEY].isin(base[JOIN_KEY])
    merged = base.merge(
        _prefix(right, role),
        on=JOIN_KEY,
        how="left",
        validate="one_to_one",
        indicator=True,
    )
    after = len(merged)
    reject_row_expansion(before, after, role)
    unmatched_base = int((merged["_merge"] == "left_only").sum())
    merged = merged.drop(columns="_merge")
    return merged, {
        "stage": f"dbs_left_join_{role}",
        "rows_before": int(before),
        "rows_after": int(after),
        "unmatched_base_rows": unmatched_base,
        "unmatched_right_source_rows": int((~right_matches).sum()),
        "validation": "one_to_one",
    }


def _numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").replace(
        [np.inf, -np.inf], np.nan
    )


def _nonblank(series: pd.Series) -> pd.Series:
    """Treat null and blank text as absent without interpreting any code."""
    present = series.notna()
    text = series.astype("string").str.strip()
    return present & text.ne("")


def category_series(
    age: pd.Series,
    self_reported: pd.Series,
    hba1c: pd.Series,
) -> tuple[pd.Series, pd.Series]:
    """Return transient five-category and binary targets; never exported by row."""
    age_numeric = _numeric(age)
    report_numeric = _numeric(self_reported)
    hba1c_numeric = _numeric(hba1c)
    eligible = (
        age_numeric.ge(45)
        & report_numeric.isin([1, 2])
        & hba1c_numeric.notna()
        & hba1c_numeric.ge(0)
    )
    category = pd.Series(pd.NA, index=age.index, dtype="Int64")
    category.loc[eligible & report_numeric.eq(2) & hba1c_numeric.lt(5.7)] = 1
    category.loc[
        eligible & report_numeric.eq(2)
        & hba1c_numeric.ge(5.7) & hba1c_numeric.lt(6.5)
    ] = 2
    category.loc[eligible & report_numeric.eq(2) & hba1c_numeric.ge(6.5)] = 3
    category.loc[eligible & report_numeric.eq(1) & hba1c_numeric.ge(6.5)] = 4
    category.loc[eligible & report_numeric.eq(1) & hba1c_numeric.lt(6.5)] = 5

    binary = pd.Series(pd.NA, index=age.index, dtype="Int64")
    binary.loc[category.isin(POSITIVE_CATEGORIES)] = 1
    binary.loc[category.isin(NEGATIVE_CATEGORIES)] = 0
    return category, binary


def undiagnosed_target_series(
    age: pd.Series,
    self_reported: pd.Series,
    hba1c: pd.Series,
) -> pd.Series:
    """Transient primary target for respondents without a prior diagnosis."""
    age_numeric = _numeric(age)
    report_numeric = _numeric(self_reported)
    hba1c_numeric = _numeric(hba1c)
    eligible = (
        age_numeric.ge(45)
        & report_numeric.eq(2)
        & hba1c_numeric.notna()
        & hba1c_numeric.ge(0)
    )
    target = pd.Series(pd.NA, index=age.index, dtype="Int64")
    target.loc[eligible & hba1c_numeric.ge(6.5)] = 1
    target.loc[eligible & hba1c_numeric.lt(6.5)] = 0
    return target


def _distribution(series: pd.Series) -> dict[str, Any]:
    counts = series.value_counts(dropna=False)
    return {
        "missing_count": int(series.isna().sum()),
        "codes": [
            {
                "code": None if pd.isna(code) else (
                    int(code) if isinstance(code, (int, np.integer)) else str(code)
                ),
                "count": int(count),
            }
            for code, count in counts.items()
        ],
    }


def _category_count_report(category: pd.Series) -> dict[str, Any]:
    denominator = int(category.notna().sum())
    rows = []
    for code, name in CATEGORY_NAMES.items():
        count = int(category.eq(code).sum())
        rows.append({
            "category_code": code,
            "category_name": name,
            "count": count,
            "percentage": float(100 * count / denominator) if denominator else None,
        })
    return {
        "denominator_complete_target": denominator,
        "categories": rows,
    }


def _target_report(
    binary: pd.Series,
    target_name: str,
    definition: dict[str, Any],
) -> dict[str, Any]:
    denominator = int(binary.notna().sum())
    positive = int(binary.eq(1).sum())
    negative = int(binary.eq(0).sum())
    return {
        "target_name": target_name,
        "eligible_total": denominator,
        "positive_count": positive,
        "positive_percentage": float(100 * positive / denominator) if denominator else None,
        "negative_count": negative,
        "negative_percentage": float(100 * negative / denominator) if denominator else None,
        "definition": definition,
    }


def validate_expected_target_counts(
    primary_report: dict[str, Any],
    secondary_report: dict[str, Any],
) -> dict[str, Any]:
    """Raise loudly unless both aggregate targets match approved counts."""
    reports = {
        "target_undiagnosed_diabetes": primary_report,
        "target_any_diabetes": secondary_report,
    }
    comparisons = {}
    for target_name, expected in EXPECTED_TARGET_COUNTS.items():
        report = reports[target_name]
        observed = {
            "total": report["eligible_total"],
            "positive": report["positive_count"],
            "negative": report["negative_count"],
        }
        comparisons[target_name] = {
            "expected": expected,
            "observed": observed,
            "matches": observed == expected,
        }
        if observed != expected:
            raise ValueError(
                f"Expected aggregate count check failed for {target_name}: "
                f"expected={expected}, observed={observed}"
            )
    return comparisons


def _weighted_binary(binary: pd.Series, numeric_weight: pd.Series) -> dict[str, Any]:
    valid = binary.notna() & numeric_weight.gt(0)
    denominator = float(numeric_weight.loc[valid].sum())
    positive_weight = float(numeric_weight.loc[valid & binary.eq(1)].sum())
    negative_weight = float(numeric_weight.loc[valid & binary.eq(0)].sum())
    return {
        "valid_weighted_target_rows": int(valid.sum()),
        "excluded_missing_nonpositive_weight_rows": int(binary.notna().sum() - valid.sum()),
        "weighted_denominator": denominator,
        "positive_weighted_percentage": (
            100 * positive_weight / denominator if denominator > 0 else None
        ),
        "negative_weighted_percentage": (
            100 * negative_weight / denominator if denominator > 0 else None
        ),
    }


def _weighted_report(
    category: pd.Series,
    primary: pd.Series,
    secondary: pd.Series,
    weight: pd.Series,
) -> dict[str, Any]:
    numeric_weight = _numeric(weight)
    valid = category.notna() & numeric_weight.gt(0)
    denominator = float(numeric_weight.loc[valid].sum())
    rows = []
    for code, name in CATEGORY_NAMES.items():
        weighted_sum = float(numeric_weight.loc[valid & category.eq(code)].sum())
        rows.append({
            "category_code": code,
            "category_name": name,
            "weighted_percentage": (
                100 * weighted_sum / denominator if denominator > 0 else None
            ),
        })
    return {
        "weight": "indiadbsweight",
        "descriptive_point_estimates_only": True,
        "confidence_intervals_computed": False,
        "confidence_interval_note": (
            "No confidence intervals until strata and survey-design variables "
            "are confirmed."
        ),
        "valid_weighted_target_rows": int(valid.sum()),
        "excluded_missing_nonpositive_weight_rows": int(category.notna().sum() - valid.sum()),
        "weighted_denominator": denominator,
        "categories": rows,
        "targets": {
            "target_undiagnosed_diabetes": _weighted_binary(
                primary, numeric_weight
            ),
            "target_any_diabetes": _weighted_binary(
                secondary, numeric_weight
            ),
        },
    }


def _band_count(series: pd.Series, lower: float | None, upper: float | None) -> int:
    numeric = _numeric(series)
    mask = numeric.notna()
    if lower is not None:
        mask &= numeric.ge(lower)
    if upper is not None:
        mask &= numeric.lt(upper)
    return int(mask.sum())


def _outlier_audit(merged: pd.DataFrame) -> dict[str, Any]:
    height = _numeric(merged["biomarker__bm067"])
    weight = _numeric(merged["biomarker__bm071"])
    waist = _numeric(merged["biomarker__bm076"])
    age = _numeric(merged["individual__dm005"])
    hba1c = _numeric(merged["hba1c"])
    valid_bmi = height.gt(0) & weight.gt(0)
    bmi = pd.Series(np.nan, index=merged.index, dtype=float)
    bmi.loc[valid_bmi] = weight.loc[valid_bmi] / ((height.loc[valid_bmi] / 100) ** 2)
    observed_max = hba1c.max(skipna=True)
    max_count = (
        int(hba1c.eq(observed_max).sum()) if pd.notna(observed_max) else 0
    )
    return {
        "values_automatically_deleted": False,
        "height_cm": {
            "below_100": _band_count(height, None, 100),
            "100_to_129_9": _band_count(height, 100, 130),
            "130_to_220": _band_count(height, 130, 220.0000000001),
            "above_220": int(height.gt(220).sum()),
        },
        "waist_cm": {
            "below_40": _band_count(waist, None, 40),
            "40_to_200": _band_count(waist, 40, 200.0000000001),
            "above_200": int(waist.gt(200).sum()),
        },
        "calculated_bmi_comparison_only": {
            "below_10": _band_count(bmi, None, 10),
            "10_to_80": _band_count(bmi, 10, 80.0000000001),
            "above_80": int(bmi.gt(80).sum()),
            "available_count": int(bmi.notna().sum()),
            "official_bmi_replaced": False,
        },
        "age_above_100": int(age.gt(100).sum()),
        "hba1c": {
            "observed_maximum_equal_count": max_count,
            "distinct_value_count": int(hba1c.nunique(dropna=True)),
        },
    }


def _group_structure(merged: pd.DataFrame) -> dict[str, Any]:
    ssuid = merged["individual__ssuid"]
    hhid = merged["individual__hhid"]
    sizes = ssuid.dropna().value_counts()
    return {
        "identifier_values_exported": False,
        "unique_ssuid_count": int(ssuid.nunique(dropna=True)),
        "respondents_per_ssuid": {
            "minimum": int(sizes.min()) if not sizes.empty else None,
            "median": float(sizes.median()) if not sizes.empty else None,
            "maximum": int(sizes.max()) if not sizes.empty else None,
        },
        "unique_household_count": int(hhid.nunique(dropna=True)),
    }


def _medication_audit(merged: pd.DataFrame) -> dict[str, Any]:
    report = _numeric(merged["individual__ht003"])
    medication = merged["individual__ht003c"]
    insulin = merged["individual__ht003d"]
    diagnosed = report.eq(1)
    not_diagnosed = report.eq(2)
    med_present = _nonblank(medication)
    insulin_present = _nonblank(insulin)
    medication_for_distribution = medication.mask(~med_present)
    insulin_for_distribution = insulin.mask(~insulin_present)
    return {
        "diagnosed_respondent_count": int(diagnosed.sum()),
        "among_diagnosed": {
            "oral_medication": _distribution(
                medication_for_distribution.loc[diagnosed]
            ),
            "insulin": _distribution(insulin_for_distribution.loc[diagnosed]),
        },
        "blank_responses_treated_as_no": False,
        "inconsistencies_among_ht003_equals_2": {
            "medication_response_present": int((not_diagnosed & med_present).sum()),
            "insulin_response_present": int((not_diagnosed & insulin_present).sum()),
            "either_response_present": int(
                (not_diagnosed & (med_present | insulin_present)).sum()
            ),
        },
    }


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _privacy_check(output_dir: Path, identifier_values: set[str]) -> None:
    actual = {path.name for path in output_dir.iterdir() if path.is_file()}
    if actual != set(OUTPUT_FILENAMES):
        raise RuntimeError(f"Unexpected aggregate output set: {actual}")
    for path in output_dir.iterdir():
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        # Long identifier tokens provide a useful defense-in-depth scan.
        # Very short/numeric IDs are not substring-scanned because they can
        # coincide with legitimate aggregate counts; structural tests ensure
        # identifier columns are never passed to any output constructor.
        leaked = [
            value for value in identifier_values
            if len(value) >= 8 and value in text
        ]
        if leaked:
            raise RuntimeError(f"Identifier value leaked into {path.name}")


def audit_dataframes(
    individual: pd.DataFrame,
    biomarker: pd.DataFrame,
    dbs: pd.DataFrame,
    output_dir: Path,
    enforce_expected_counts: bool = False,
) -> dict[str, Any]:
    """Run the target audit on in-memory frames and write aggregates only."""
    key_audits = {
        "individual": validate_key(individual, "individual"),
        "biomarker": validate_key(biomarker, "biomarker"),
        "dbs": validate_key(dbs, "dbs"),
    }
    identifier_values = set()
    for frame in (individual, biomarker, dbs):
        for column in IDENTIFIER_COLUMNS & set(frame.columns):
            identifier_values.update(
                str(value) for value in frame[column].dropna().tolist()
            )

    base = dbs.copy()
    merged_biomarker, biomarker_flow = merge_one_to_one(
        base, biomarker, "biomarker"
    )
    merged, individual_flow = merge_one_to_one(
        merged_biomarker, individual, "individual"
    )
    reject_row_expansion(len(dbs), len(merged), "final")

    age = _numeric(merged["individual__dm005"])
    report = _numeric(merged["individual__ht003"])
    hba1c = _numeric(merged["hba1c"])
    category, secondary_target = category_series(age, report, hba1c)
    primary_target = undiagnosed_target_series(age, report, hba1c)

    primary_report = _target_report(
        primary_target,
        "target_undiagnosed_diabetes",
        {
            "eligibility": ["age >= 45", "ht003 == 2", "valid nonnegative hba1c"],
            "positive": "hba1c >= 6.5",
            "negative": "hba1c < 6.5",
        },
    )
    secondary_report = _target_report(
        secondary_target,
        "target_any_diabetes",
        {
            "eligibility": [
                "age >= 45", "ht003 in [1, 2]", "valid nonnegative hba1c"
            ],
            "positive_category_codes": [3, 4, 5],
            "negative_category_codes": [1, 2],
        },
    )
    observed_counts = {
        name: {
            "total": summary["eligible_total"],
            "positive": summary["positive_count"],
            "negative": summary["negative_count"],
        }
        for name, summary in {
            "target_undiagnosed_diabetes": primary_report,
            "target_any_diabetes": secondary_report,
        }.items()
    }
    expected_count_check = {
        name: {
            "expected": expected,
            "observed": observed_counts[name],
            "matches": observed_counts[name] == expected,
        }
        for name, expected in EXPECTED_TARGET_COUNTS.items()
    }
    if enforce_expected_counts:
        expected_count_check = validate_expected_target_counts(
            primary_report, secondary_report
        )

    age_45_plus = age.ge(45)
    cohort_flow = {
        "starting_dbs_cohort": int(len(dbs)),
        "key_audits": key_audits,
        "joins": [biomarker_flow, individual_flow],
        "age_45_plus_count": int(age_45_plus.sum()),
        "excluded_under_45_count": int(age.lt(45).sum()),
        "missing_age_count": int(age.isna().sum()),
        "missing_ht003_count_among_age_45_plus": int(
            (age_45_plus & report.isna()).sum()
        ),
        "missing_ht003_count": int(report.isna().sum()),
        "invalid_ht003_code_count_among_age_45_plus": int(
            (age_45_plus & report.notna() & ~report.isin([1, 2])).sum()
        ),
        "missing_hba1c_count_among_age_45_plus": int(
            (age_45_plus & hba1c.isna()).sum()
        ),
        "missing_hba1c_count": int(hba1c.isna().sum()),
        "negative_hba1c_manual_review_count": int((hba1c < 0).sum()),
        "complete_target_count": int(category.notna().sum()),
        "primary_target_eligible_count": int(primary_target.notna().sum()),
        "secondary_target_eligible_count": int(secondary_target.notna().sum()),
        "final_joined_rows": int(len(merged)),
        "row_expansion": int(len(merged) - len(dbs)),
    }
    category_counts = {
        "unweighted_only": True,
        "five_category_outcome": _category_count_report(category),
        "targets": {
            "target_undiagnosed_diabetes": primary_report,
            "target_any_diabetes": secondary_report,
        },
        "expected_aggregate_count_check": {
            "enforced": enforce_expected_counts,
            "targets": expected_count_check,
        },
        "participant_level_target_exported": False,
    }
    weighted = _weighted_report(
        category, primary_target, secondary_target, merged["indiadbsweight"]
    )
    medication = _medication_audit(merged)
    outliers = _outlier_audit(merged)
    groups = _group_structure(merged)

    output_dir.mkdir(parents=True, exist_ok=True)
    _write_json(output_dir / OUTPUT_FILENAMES[0], cohort_flow)
    _write_json(output_dir / OUTPUT_FILENAMES[1], category_counts)
    _write_json(output_dir / OUTPUT_FILENAMES[2], weighted)
    _write_json(output_dir / OUTPUT_FILENAMES[3], medication)
    _write_json(output_dir / OUTPUT_FILENAMES[4], outliers)
    _write_json(output_dir / OUTPUT_FILENAMES[5], groups)

    manual_review = "\n".join([
        "# LASI Target Definition Manual Review",
        "",
        "Aggregate results only; no identifier values or participant-level targets are exported.",
        "",
        "- Target coding uses verified ht003 codes only: 1=diagnosed, 2=not diagnosed.",
        "- Missing, blank, invalid, and suspicious values are not silently recoded.",
        "- Medication blanks are not treated as no.",
        "- Calculated BMI is an audit comparison only.",
        "- Outlier bands are reported without automatic deletion.",
        "- India-DBS-weighted percentages are descriptive point estimates only.",
        "- Confidence intervals are deferred until strata/design variables are confirmed.",
        "",
        f"Primary eligible total: {primary_report['eligible_total']}",
        f"Primary positives: {primary_report['positive_count']}",
        f"Primary negatives: {primary_report['negative_count']}",
        f"Secondary eligible total: {secondary_report['eligible_total']}",
        f"Secondary positives: {secondary_report['positive_count']}",
        f"Secondary negatives: {secondary_report['negative_count']}",
        f"Expected aggregate checks enforced: {enforce_expected_counts}",
    ])
    (output_dir / OUTPUT_FILENAMES[6]).write_text(manual_review, encoding="utf-8")
    _privacy_check(output_dir, identifier_values)
    return {
        "cohort_flow": cohort_flow,
        "category_counts": category_counts,
        "weighted_summary": weighted,
        "medication_consistency": medication,
        "outlier_audit": outliers,
        "group_structure": groups,
    }


def main() -> None:
    args = parse_args()
    validate_input_filename(args.individual_path, "individual")
    validate_input_filename(args.biomarker_path, "biomarker")
    validate_input_filename(args.dbs_path, "dbs")
    individual = read_approved_columns(args.individual_path, "individual")
    biomarker = read_approved_columns(args.biomarker_path, "biomarker")
    dbs = read_approved_columns(args.dbs_path, "dbs")
    audit_dataframes(
        individual, biomarker, dbs, args.output_dir,
        enforce_expected_counts=True,
    )
    print("LASI target-definition audit complete.")
    print("Aggregate outputs only; no identifiers or participant rows exported.")


if __name__ == "__main__":
    main()
