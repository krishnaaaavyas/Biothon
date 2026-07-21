"""Independently validate the restricted LASI hypertension model cohort."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from training.build_lasi_hypertension_model_cohort import (
        FORBIDDEN_COLUMNS,
        GROUP_COLUMNS,
        MODEL_COHORT_SCHEMA,
        REPOSITORY_ROOT,
        TARGET_COLUMN,
        WEIGHT_COLUMN,
        sha256_file,
    )
    from training.build_lasi_hypertension_cohort import APPROVED_TARGET_POLICY, TARGET_NAME
    from training.lasi_hypertension_audit_utils import PRODUCTION_PREDICTOR_ORDER
except ModuleNotFoundError:
    from build_lasi_hypertension_model_cohort import (
        FORBIDDEN_COLUMNS,
        GROUP_COLUMNS,
        MODEL_COHORT_SCHEMA,
        REPOSITORY_ROOT,
        TARGET_COLUMN,
        WEIGHT_COLUMN,
        sha256_file,
    )
    from build_lasi_hypertension_cohort import APPROVED_TARGET_POLICY, TARGET_NAME
    from lasi_hypertension_audit_utils import PRODUCTION_PREDICTOR_ORDER

EXPECTED_TOTAL_COUNT = 43_022
EXPECTED_POSITIVE_COUNT = 12_570
EXPECTED_NEGATIVE_COUNT = 30_452
HMAC_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def _within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate_output_path(output_path: Path) -> None:
    if _within(output_path, REPOSITORY_ROOT):
        raise ValueError(f"Validation output must be outside the Git repository: {output_path}")
    if output_path.exists() and output_path.is_dir():
        raise ValueError(f"Validation output path is a directory: {output_path}")


def _load_json(path: Path, label: str) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"{label} does not exist: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object")
    return value


def _expected_counts() -> dict[str, int]:
    return {
        "total": EXPECTED_TOTAL_COUNT,
        "positive": EXPECTED_POSITIVE_COUNT,
        "negative": EXPECTED_NEGATIVE_COUNT,
    }


def validate_cohort(
    cohort_path: Path,
    manifest_path: Path,
    summary_path: Path,
    output_path: Path,
) -> dict[str, Any]:
    validate_output_path(output_path)
    if not cohort_path.is_file():
        raise FileNotFoundError(f"Cohort Parquet does not exist: {cohort_path}")
    manifest = _load_json(manifest_path, "Manifest")
    summary = _load_json(summary_path, "Summary")
    cohort = pd.read_parquet(cohort_path)
    errors: list[str] = []
    warnings: list[str] = []
    schema_match = tuple(cohort.columns) == MODEL_COHORT_SCHEMA
    checksum_match = sha256_file(cohort_path) == manifest.get("parquet_sha256")
    if not checksum_match:
        errors.append("Parquet checksum does not match manifest")
    if not schema_match:
        errors.append("Cohort schema or column order is incorrect")
    forbidden = sorted(FORBIDDEN_COLUMNS & set(cohort.columns))
    if forbidden:
        errors.append("Forbidden columns are present")
    target = cohort[TARGET_COLUMN] if TARGET_COLUMN in cohort else pd.Series(dtype="float64")
    total = len(cohort)
    positive = int(target.eq(1).sum())
    negative = int(target.eq(0).sum())
    expected = _expected_counts()
    if {"total": total, "positive": positive, "negative": negative} != expected:
        errors.append("Cohort or target counts do not match approved counts")
    if target.isna().any():
        errors.append("Target contains missing values")
    if not set(target.dropna().unique()).issubset({0, 1}):
        errors.append("Target contains non-binary values")
    age = pd.to_numeric(cohort.get("age"), errors="coerce")
    age_valid = bool(age.notna().all() and np.isfinite(age).all() and age.ge(45).all())
    if not age_valid:
        errors.append("Age eligibility check failed")
    group_format = {}
    for name in GROUP_COLUMNS:
        values = cohort[name].astype("string") if name in cohort else pd.Series(dtype="string")
        valid = bool(values.notna().all() and values.str.fullmatch(HMAC_PATTERN).all())
        group_format[name] = valid
        if not valid:
            errors.append(f"{name} is missing or malformed")
    nesting_ok = False
    if all(name in cohort for name in GROUP_COLUMNS):
        nesting_ok = bool(cohort.groupby("household_group_id")["ssu_group_id"].nunique().le(1).all())
    if not nesting_ok:
        errors.append("Household-to-SSU nesting is inconsistent")
    weights = pd.to_numeric(cohort.get(WEIGHT_COLUMN), errors="coerce")
    weights_valid = bool(weights.notna().all() and np.isfinite(weights).all() and weights.gt(0).all())
    if not weights_valid:
        errors.append("National weights must be finite and positive")
    predictor_missingness = {
        name: int(cohort[name].isna().sum()) if name in cohort else total
        for name in PRODUCTION_PREDICTOR_ORDER
    }
    manifest_checks = {
        "source_type": manifest.get("source_type") == "real_lasi_wave1",
        "target_policy": manifest.get("target_policy") == APPROVED_TARGET_POLICY,
        "canonical_target_name": manifest.get("canonical_target_name") == TARGET_NAME,
        "schema": manifest.get("output_schema") == list(MODEL_COHORT_SCHEMA),
        "predictors": manifest.get("approved_predictors") == list(PRODUCTION_PREDICTOR_ORDER),
        "counts": all(manifest.get(f"{key}_count") == value for key, value in expected.items()),
        "privacy": all(manifest.get(name) is False for name in (
            "contains_raw_identifiers", "contains_raw_bp_values",
            "contains_target_defining_variables", "contains_absolute_paths",
            "contains_synthetic_training_records", "model_trained", "split_created",
            "locked_test_created",
        )),
        "research_only": manifest.get("research_only") is True,
    }
    if not all(manifest_checks.values()):
        errors.append("Manifest assertions are incorrect")
    calculated_summary = {
        "target_counts": {"total": total, "positive": positive, "negative": negative},
        "target_percentage": round(float(target.mean()) * 100, 6) if len(target) else None,
        "predictor_missingness": predictor_missingness,
        "unique_deidentified_household_count": int(cohort["household_group_id"].nunique()) if "household_group_id" in cohort else 0,
        "unique_deidentified_ssu_count": int(cohort["ssu_group_id"].nunique()) if "ssu_group_id" in cohort else 0,
        "positive_finite_national_weight_count": int(weights_valid and len(weights)),
        "invalid_or_missing_weight_count": int((~(weights.notna() & np.isfinite(weights) & weights.gt(0))).sum()),
        "exact_schema_confirmed": schema_match,
        "forbidden_column_intersection": forbidden,
    }
    summary_checks = {
        key: summary.get(key) == value for key, value in calculated_summary.items()
    }
    if not all(summary_checks.values()):
        errors.append("Summary does not reconcile with cohort")
    report = {
        "validation_passed": not errors,
        "checksum_match": checksum_match,
        "schema_match": schema_match,
        "row_and_target_counts": {"total": total, "positive": positive, "negative": negative},
        "predictor_missingness": predictor_missingness,
        "group_counts": calculated_summary["unique_deidentified_household_count"],
        "ssu_group_count": calculated_summary["unique_deidentified_ssu_count"],
        "nesting_checks": {"household_to_ssu": nesting_ok},
        "range_checks": {"age": age_valid, "national_weight": weights_valid, "group_format": group_format},
        "manifest_checks": manifest_checks,
        "summary_consistency_checks": summary_checks,
        "errors": errors,
        "warnings": warnings,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    if errors:
        raise ValueError("; ".join(errors))
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cohort-path", required=True, type=Path)
    parser.add_argument("--manifest-path", required=True, type=Path)
    parser.add_argument("--summary-path", required=True, type=Path)
    parser.add_argument("--output-path", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    validate_cohort(args.cohort_path, args.manifest_path, args.summary_path, args.output_path)
    print("LASI hypertension model cohort passed independent validation.")


if __name__ == "__main__":
    main()
