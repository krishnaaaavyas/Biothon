"""Validate privacy and governance of hypertension development outputs."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

try:
    from training.lasi_hypertension_audit_utils import APPROVED_PRODUCTION_PREDICTORS
    from training.train_lasi_hypertension_development import (
        FEATURE_SETS,
        OUTPUT_FILENAMES,
    )
except ModuleNotFoundError:
    from lasi_hypertension_audit_utils import APPROVED_PRODUCTION_PREDICTORS
    from train_lasi_hypertension_development import FEATURE_SETS, OUTPUT_FILENAMES

FORBIDDEN_KEYS = {
    "participant_id", "prim_key", "hhid", "ssuid", "household_id", "cluster_id",
    "row_index", "rows", "predictions", "prediction", "probabilities",
    "bm006", "bm007", "bm010", "bm011", "bm014", "bm015", "bm017", "bm018",
    "systolic", "diastolic", "raw_bp", "source_path", "data_root",
}


def _has_absolute_path(value: Any) -> bool:
    if isinstance(value, dict):
        return any(_has_absolute_path(key) or _has_absolute_path(item) for key, item in value.items())
    if isinstance(value, list):
        return any(_has_absolute_path(item) for item in value)
    if not isinstance(value, str):
        return False
    return bool(re.match(r"^[A-Za-z]:[\\/]", value)) or (
        value.startswith("/") and PurePosixPath(value).is_absolute()
    ) or PureWindowsPath(value).is_absolute()


def _forbidden_keys(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        found.update(FORBIDDEN_KEYS & set(value))
        for item in value.values():
            found.update(_forbidden_keys(item))
    elif isinstance(value, list):
        for item in value:
            found.update(_forbidden_keys(item))
    return found


def _unsuppressed_small_counts(value: Any, minimum: int) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            if (
                key.endswith("_count")
                and isinstance(item, int)
                and not isinstance(item, bool)
                and 0 < item < minimum
            ):
                return True
            if _unsuppressed_small_counts(item, minimum):
                return True
    elif isinstance(value, list):
        return any(_unsuppressed_small_counts(item, minimum) for item in value)
    return False


def validate_outputs(output_dir: Path, minimum: int = 10) -> dict[str, Any]:
    if minimum < 2:
        raise ValueError("min-cell-count must be at least 2")
    if not output_dir.is_dir():
        raise FileNotFoundError(f"Training output directory is unavailable: {output_dir}")
    actual = {path.name for path in output_dir.iterdir() if path.is_file()}
    if actual != OUTPUT_FILENAMES:
        missing = sorted(OUTPUT_FILENAMES - actual)
        unexpected = sorted(actual - OUTPUT_FILENAMES)
        raise ValueError(
            f"Training output filenames mismatch; missing={missing}; unexpected={unexpected}"
        )
    payloads = {
        name: json.loads((output_dir / name).read_text(encoding="utf-8"))
        for name in sorted(actual)
    }
    errors: list[str] = []
    for name, payload in payloads.items():
        forbidden = _forbidden_keys(payload)
        if forbidden:
            errors.append(f"Forbidden participant, leakage, or BP keys in {name}: {sorted(forbidden)}")
        if _has_absolute_path(payload):
            errors.append(f"Absolute path detected in {name}")
        if _unsuppressed_small_counts(payload, minimum):
            errors.append(f"Unsuppressed small cell detected in {name}")
    manifest = payloads["lasi_hypertension_training_manifest.json"]
    if set(manifest.get("approved_predictors", [])) != APPROVED_PRODUCTION_PREDICTORS:
        errors.append("Approved predictor registry mismatch")
    if manifest.get("locked_test_evaluated") is not False:
        errors.append("Locked test must not be evaluated")
    if manifest.get("threshold_selection_partition") != "validation":
        errors.append("Threshold selection must use validation only")
    for field in (
        "participant_level_exported", "predictions_exported", "raw_bp_values_exported",
        "absolute_paths_exported", "model_files_exported",
    ):
        if manifest.get(field) is not False:
            errors.append(f"Unsafe manifest assertion: {field}")
    feature_payload = payloads["lasi_hypertension_feature_set_results.json"]
    feature_rows = feature_payload.get("feature_sets", [])
    observed_sets = {
        row.get("feature_set"): tuple(row.get("features", [])) for row in feature_rows
    }
    if observed_sets != FEATURE_SETS:
        errors.append("Feature-set registry mismatch")
    if any(len(features) != len(set(features)) for features in observed_sets.values()):
        errors.append("Duplicate predictors detected")
    threshold_rows = payloads[
        "lasi_hypertension_threshold_selection.json"
    ].get("configurations", [])
    if any(row.get("selection_partition") != "validation" for row in threshold_rows):
        errors.append("Non-validation threshold selection detected")
    model_rows = payloads[
        "lasi_hypertension_candidate_model_results.json"
    ].get("configurations", [])
    if any(row.get("locked_test_metrics") is not None for row in model_rows):
        errors.append("Locked-test metrics detected")
    calibration_rows = payloads[
        "lasi_hypertension_calibration_summary.json"
    ].get("configurations", [])
    if any(row.get("locked_test") is not None for row in calibration_rows):
        errors.append("Locked-test calibration detected")
    if errors:
        raise ValueError("; ".join(errors))
    return {
        "validation_passed": True,
        "validated_output_count": len(payloads),
        "locked_test_evaluated": False,
        "minimum_cell_count": minimum,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--min-cell-count", type=int, default=10)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    validate_outputs(args.output_dir, args.min_cell_count)
    print("LASI hypertension development outputs passed privacy validation.")


if __name__ == "__main__":
    main()
