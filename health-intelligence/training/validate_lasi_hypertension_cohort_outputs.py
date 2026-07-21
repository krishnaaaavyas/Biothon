"""Validate privacy and schema of aggregate LASI hypertension cohort outputs."""

from __future__ import annotations
import argparse, json, re
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any
try:
    from training.build_lasi_hypertension_cohort import OUTPUT_FILENAMES
    from training.lasi_hypertension_audit_utils import (
        APPROVED_PRODUCTION_PREDICTORS,
        PRODUCTION_PREDICTOR_ORDER,
    )
except ModuleNotFoundError:
    from build_lasi_hypertension_cohort import OUTPUT_FILENAMES
    from lasi_hypertension_audit_utils import (
        APPROVED_PRODUCTION_PREDICTORS,
        PRODUCTION_PREDICTOR_ORDER,
    )

UNSAFE_KEYS = {"prim_key", "hhid", "ssuid", "participant_id", "row_index", "rows", "records", "systolic", "diastolic"}

def _unsafe(value: Any) -> bool:
    if isinstance(value, dict): return bool(UNSAFE_KEYS & set(value)) or any(_unsafe(v) for v in value.values())
    if isinstance(value, list): return any(_unsafe(v) for v in value)
    return False
def _absolute(value: Any) -> bool:
    if isinstance(value, dict): return any(_absolute(k) or _absolute(v) for k,v in value.items())
    if isinstance(value, list): return any(_absolute(v) for v in value)
    if not isinstance(value, str): return False
    return bool(re.match(r"^[A-Za-z]:[\\/]", value)) or (value.startswith("/") and PurePosixPath(value).is_absolute()) or PureWindowsPath(value).is_absolute()
def _small(value: Any, minimum: int) -> bool:
    if isinstance(value, dict): return any(_small(v, minimum) for v in value.values())
    if isinstance(value, list): return any(_small(v, minimum) for v in value)
    return isinstance(value, int) and not isinstance(value, bool) and 0 < value < minimum

def validate_outputs(output_dir: Path, minimum: int = 10) -> dict[str, Any]:
    if minimum < 2: raise ValueError("min-cell-count must be at least 2")
    if not output_dir.exists():
        raise FileNotFoundError(f"Output directory does not exist: {output_dir}")
    if not output_dir.is_dir():
        raise ValueError(f"Output path is not a directory: {output_dir}")
    actual = {p.name for p in output_dir.iterdir() if p.is_file()}
    if actual != OUTPUT_FILENAMES:
        missing = sorted(OUTPUT_FILENAMES - actual)
        unexpected = sorted(actual - OUTPUT_FILENAMES)
        lines = ["Output bundle is incomplete.", "Missing files:"]
        lines.extend(f"- {name}" for name in missing)
        if not missing:
            lines.append("- none")
        lines.append("Unexpected files:")
        lines.extend(f"- {name}" for name in unexpected)
        if not unexpected:
            lines.append("- none")
        raise ValueError("\n".join(lines))
    payloads = {n: json.loads((output_dir/n).read_text(encoding="utf-8")) for n in actual}; errors=[]
    for name,payload in payloads.items():
        if _unsafe(payload): errors.append(f"participant-like array, identifier, or raw BP value: {name}")
        if _absolute(payload): errors.append(f"absolute path: {name}")
        if _small(payload, minimum): errors.append(f"unsuppressed small count: {name}")
    manifest=payloads["lasi_hypertension_cohort_manifest.json"]
    manifest_predictors = manifest.get("approved_predictors")
    if manifest_predictors != list(PRODUCTION_PREDICTOR_ORDER):
        errors.append("approved predictor set mismatch")
    if isinstance(manifest_predictors, list) and len(manifest_predictors) != len(set(manifest_predictors)):
        errors.append("duplicate approved predictor in manifest")
    for field in ("cohort_persisted","model_trained","split_created","locked_test_created","locked_test_evaluated","participant_level_exported","raw_bp_values_exported","direct_identifier_values_exported","group_identifier_values_exported","absolute_paths_exported"):
        if manifest.get(field) is not False: errors.append(f"unsafe manifest assertion: {field}")
    quality=payloads["lasi_hypertension_cohort_quality_summary.json"]
    if quality.get("forbidden_predictor_intersection") != []: errors.append("forbidden predictor present")
    quality_predictors = quality.get("approved_predictor_names", [])
    if set(quality_predictors) != APPROVED_PRODUCTION_PREDICTORS:
        errors.append("unexpected or missing predictor")
    if len(quality_predictors) != len(set(quality_predictors)):
        errors.append("duplicate approved predictor in quality summary")
    if errors: raise ValueError("; ".join(errors))
    return {"validation_passed": True,"validated_output_count":7,"minimum_cell_count":minimum}

def parse_args():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument("--output-dir",required=True,type=Path); p.add_argument("--min-cell-count",type=int,default=10); return p.parse_args()
def main():
    a=parse_args(); validate_outputs(a.output_dir,a.min_cell_count); print("LASI hypertension cohort aggregate outputs passed privacy validation.")
if __name__ == "__main__": main()


