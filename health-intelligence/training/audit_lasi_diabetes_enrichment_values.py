"""Privacy-safe aggregate suitability audit for LASI enrichment variables."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd


EXPECTED_FILENAME = "3_LASI_W1_Individual_v4.dta"
APPROVED_COLUMNS = [
    "prim_key", "fm304s1", "fm304s2", "fm304s3", "fm304s4", "fs507",
    "hb212", "hb214",
]
FAMILY_COLUMNS = ["fm304s1", "fm304s2", "fm304s3", "fm304s4"]
OUTPUT_FILENAME = "lasi_diabetes_enrichment_value_audit.json"
SUPPRESSION_THRESHOLD = 10
SUPPRESSED = "suppressed"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


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


def validate_paths(individual_dta: Path, output_dir: Path) -> None:
    if individual_dta.name.lower() != EXPECTED_FILENAME.lower():
        raise ValueError(
            f"Unexpected LASI Individual file {individual_dta.name!r}; "
            f"expected {EXPECTED_FILENAME!r}"
        )
    if _is_within(individual_dta, REPOSITORY_ROOT):
        raise ValueError("LASI Individual input must be outside the Git repository")
    if _is_within(output_dir, REPOSITORY_ROOT):
        raise ValueError("Output directory must be outside the Git repository")
    if not individual_dta.is_file():
        raise FileNotFoundError(f"LASI Individual file not found: {individual_dta.name}")


def read_approved_columns(
    individual_dta: Path,
    reader: Callable[..., tuple[pd.DataFrame, Any]] | None = None,
) -> pd.DataFrame:
    """Read exactly the eight approved fields and no other LASI columns."""
    if reader is None:
        import pyreadstat
        reader = pyreadstat.read_dta
    frame, _ = reader(
        str(individual_dta), usecols=APPROVED_COLUMNS, apply_value_formats=False
    )
    missing = [column for column in APPROVED_COLUMNS if column not in frame]
    if missing:
        raise ValueError(f"LASI Individual file is missing approved columns: {missing}")
    return frame[APPROVED_COLUMNS].copy()


def validate_key(frame: pd.DataFrame) -> dict[str, int]:
    if "prim_key" not in frame:
        raise ValueError("prim_key is missing")
    missing = int(frame["prim_key"].isna().sum())
    duplicates = int(frame["prim_key"].dropna().duplicated().sum())
    if missing:
        raise ValueError(f"prim_key contains {missing} missing values")
    if duplicates:
        raise ValueError(f"prim_key contains {duplicates} duplicate values")
    return {
        "key_name": "prim_key",
        "missing_key_count": missing,
        "duplicate_key_count": duplicates,
        "unique_key_count": int(frame["prim_key"].nunique()),
    }


def _suppressed_count(count: int) -> int | str:
    if count == 0:
        return 0
    return count if count >= SUPPRESSION_THRESHOLD else SUPPRESSED


def _suppressed_percentage(count: int, total: int) -> float | str | None:
    if count == 0:
        return 0.0
    if count < SUPPRESSION_THRESHOLD:
        return SUPPRESSED
    return float(100 * count / total) if total else None


def _count_and_percentage(count: int, total: int) -> dict[str, Any]:
    return {
        "count": _suppressed_count(count),
        "percentage": _suppressed_percentage(count, total),
    }


def _numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").replace([np.inf, -np.inf], np.nan)


def _categorical_summary(
    series: pd.Series, expected_codes: list[int], total: int
) -> dict[str, Any]:
    numeric = _numeric(series)
    missing = int(series.isna().sum())
    invalid_mask = series.notna() & (~numeric.isin(expected_codes) | numeric.isna())
    invalid = int(invalid_mask.sum())
    return {
        "missing": _count_and_percentage(missing, total),
        "observed_code_counts": {
            str(code): _suppressed_count(int(numeric.eq(code).sum()))
            for code in expected_codes
        },
        "unexpected_code_count": _suppressed_count(invalid),
    }


def _family_audit(frame: pd.DataFrame) -> dict[str, Any]:
    total = len(frame)
    relationships = {}
    numeric = {column: _numeric(frame[column]) for column in FAMILY_COLUMNS}
    for column in FAMILY_COLUMNS:
        values = numeric[column]
        counts = {
            "0": int(values.eq(0).sum()),
            "1": int(values.eq(1).sum()),
            "missing": int(frame[column].isna().sum()),
        }
        relationships[column] = {
            key: _count_and_percentage(count, total)
            for key, count in counts.items()
        }
        invalid = int(frame[column].notna().sum() - values.isin([0, 1]).sum())
        relationships[column]["unexpected_code_count"] = _suppressed_count(invalid)

    matrix = pd.DataFrame(numeric)
    derived = pd.Series(pd.NA, index=frame.index, dtype="Int64")
    derived.loc[matrix.eq(1).any(axis=1)] = 1
    derived.loc[matrix.eq(0).all(axis=1)] = 0
    derived_counts = {
        "1": int(derived.eq(1).sum()),
        "0": int(derived.eq(0).sum()),
        "missing": int(derived.isna().sum()),
    }
    return {
        "relationships": relationships,
        "derived_family_history_diabetes_parent_sibling": {
            "policy": {
                "1": "any fm304s1-fm304s4 equals 1",
                "0": "all four variables equal 0",
                "missing": "otherwise",
            },
            **{
                key: _count_and_percentage(count, total)
                for key, count in derived_counts.items()
            },
        },
    }


def _fs507_audit(series: pd.Series) -> dict[str, Any]:
    total = len(series)
    numeric = _numeric(series)
    invalid = int(series.notna().sum() - numeric.isin(range(1, 8)).sum())
    return {
        "categories_collapsed": False,
        "codes": {
            str(code): _count_and_percentage(int(numeric.eq(code).sum()), total)
            for code in range(1, 8)
        },
        "missing": _count_and_percentage(int(series.isna().sum()), total),
        "invalid_code_count": _suppressed_count(invalid),
    }


def _duration_audit(series: pd.Series, total: int) -> dict[str, Any]:
    numeric = pd.to_numeric(series, errors="coerce")
    finite = numeric.replace([np.inf, -np.inf], np.nan)
    valid = finite[finite.ge(0)].dropna()
    otherwise_invalid = series.notna() & (numeric.isna() | ~np.isfinite(numeric))
    negative = int(finite.lt(0).sum())
    invalid = negative + int(otherwise_invalid.sum())
    quantiles = valid.quantile([0.01, 0.25, 0.50, 0.75, 0.99]) if not valid.empty else None
    return {
        "missing": _count_and_percentage(int(series.isna().sum()), total),
        "minimum": float(valid.min()) if not valid.empty else None,
        "maximum": float(valid.max()) if not valid.empty else None,
        "median": float(quantiles.loc[0.50]) if quantiles is not None else None,
        "percentiles": {
            "p01": float(quantiles.loc[0.01]) if quantiles is not None else None,
            "p25": float(quantiles.loc[0.25]) if quantiles is not None else None,
            "p75": float(quantiles.loc[0.75]) if quantiles is not None else None,
            "p99": float(quantiles.loc[0.99]) if quantiles is not None else None,
        },
        "unique_valid_value_count": int(valid.nunique()),
        "negative_value_count": _suppressed_count(negative),
        "negative_or_otherwise_invalid_count": _suppressed_count(invalid),
        "invalidity_policy": "negative, nonnumeric, or nonfinite; no undocumented upper bound assumed",
        "observed_code_counts": "not_applicable_continuous_measure",
        "unexpected_code_count": _suppressed_count(invalid),
    }


def build_aggregate_report(frame: pd.DataFrame) -> dict[str, Any]:
    key_audit = validate_key(frame)
    total = len(frame)
    per_variable = {}
    for column in FAMILY_COLUMNS:
        per_variable[column] = _categorical_summary(frame[column], [0, 1], total)
    per_variable["fs507"] = _categorical_summary(frame["fs507"], list(range(1, 8)), total)
    for column in ("hb212", "hb214"):
        per_variable[column] = {
            "missing": _count_and_percentage(int(frame[column].isna().sum()), total),
            "observed_code_counts": "not_applicable_continuous_measure",
            "unexpected_code_count": _duration_audit(frame[column], total)[
                "unexpected_code_count"
            ],
        }
    return {
        "report_schema_version": "1.1",
        "aggregate_only": True,
        "participant_rows_exported": False,
        "identifier_values_exported": False,
        "source_filename": EXPECTED_FILENAME,
        "total_row_count": int(total),
        "duplicate_key_count": key_audit["duplicate_key_count"],
        "key_validation": key_audit,
        "per_variable": per_variable,
        "family_history": _family_audit(frame),
        "fs507": _fs507_audit(frame["fs507"]),
        "duration_candidates": {
            column: _duration_audit(frame[column], total)
            for column in ("hb212", "hb214")
        },
        "suppression_policy": {
            "minimum_reportable_category_count": SUPPRESSION_THRESHOLD,
            "replacement": SUPPRESSED,
            "zero_counts_reported_as_zero": True,
            "percentages_for_suppressed_counts_are_also_suppressed": True,
        },
    }


def write_report(frame: pd.DataFrame, output_dir: Path) -> Path:
    if _is_within(output_dir, REPOSITORY_ROOT):
        raise ValueError("Output directory must be outside the Git repository")
    report = build_aggregate_report(frame)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / OUTPUT_FILENAME
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return output_path


def main() -> None:
    args = parse_args()
    validate_paths(args.individual_dta, args.output_dir)
    frame = read_approved_columns(args.individual_dta)
    write_report(frame, args.output_dir)
    print("LASI diabetes enrichment aggregate value audit complete.")


if __name__ == "__main__":
    main()
