"""Build the restricted, de-identified LASI hypertension modelling cohort."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import platform
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from training.build_lasi_hypertension_cohort import (
        APPROVED_TARGET_POLICY,
        REPOSITORY_ROOT,
        TARGET_NAME,
        construct_target_cohort,
        private_join,
        read_sources,
        validate_paths,
    )
    from training.lasi_hypertension_audit_utils import PRODUCTION_PREDICTOR_ORDER
except ModuleNotFoundError:
    from build_lasi_hypertension_cohort import (
        APPROVED_TARGET_POLICY,
        REPOSITORY_ROOT,
        TARGET_NAME,
        construct_target_cohort,
        private_join,
        read_sources,
        validate_paths,
    )
    from lasi_hypertension_audit_utils import PRODUCTION_PREDICTOR_ORDER

TARGET_COLUMN = "target_undiagnosed_elevated_bp"
GROUP_COLUMNS = ("household_group_id", "ssu_group_id")
WEIGHT_COLUMN = "national_weight"
MODEL_COHORT_SCHEMA = (
    *PRODUCTION_PREDICTOR_ORDER,
    TARGET_COLUMN,
    *GROUP_COLUMNS,
    WEIGHT_COLUMN,
)
OUTPUT_FILENAMES = (
    "lasi_hypertension_model_cohort.parquet",
    "lasi_hypertension_model_cohort_manifest.json",
    "lasi_hypertension_model_cohort_summary.json",
)
FORBIDDEN_COLUMNS = {
    "prim_key", "private_join_key", "hhid", "ssuid", "ht002", "ht002c",
    "bm006", "bm007", "bm010", "bm011", "bm014", "bm015", "bm017", "bm018",
    "systolic", "diastolic", "indiaindividualweight", "stateindividualweight",
}


def _within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate_output_directory(output_dir: Path) -> None:
    if _within(output_dir, REPOSITORY_ROOT):
        raise ValueError(f"Output directory must be outside the Git repository: {output_dir}")
    if output_dir.exists() and not output_dir.is_dir():
        raise ValueError(f"Output path exists but is not a directory: {output_dir}")


def require_group_salt(environment: dict[str, str] | None = None) -> str:
    source = os.environ if environment is None else environment
    salt = source.get("LASI_GROUP_SALT")
    if salt is None:
        raise ValueError("LASI_GROUP_SALT is required")
    if not salt.strip():
        raise ValueError("LASI_GROUP_SALT must not be empty")
    return salt


def hmac_group_id(value: Any, namespace: str, salt: str) -> str:
    if pd.isna(value):
        raise ValueError(f"Missing {namespace} source identifier")
    message = f"{namespace}:{value}".encode("utf-8")
    return hmac.new(salt.encode("utf-8"), message, hashlib.sha256).hexdigest()


def construct_model_cohort(joined: pd.DataFrame, salt: str) -> pd.DataFrame:
    cohort, predictors, target, _ = construct_target_cohort(joined)
    if cohort["hhid"].isna().any() or cohort["ssuid"].isna().any():
        raise ValueError("Household and SSU source identifiers must be nonmissing")
    result = predictors.copy()
    result[TARGET_COLUMN] = target.astype("int8")
    result["household_group_id"] = cohort["hhid"].map(
        lambda value: hmac_group_id(value, "household", salt)
    )
    result["ssu_group_id"] = cohort["ssuid"].map(
        lambda value: hmac_group_id(value, "ssu", salt)
    )
    result[WEIGHT_COLUMN] = pd.to_numeric(
        cohort["indiaindividualweight"], errors="coerce"
    )
    if tuple(result.columns) != MODEL_COHORT_SCHEMA:
        raise RuntimeError("Model cohort schema does not match the approved contract")
    if FORBIDDEN_COLUMNS & set(result.columns):
        raise RuntimeError("Forbidden source column entered model cohort")
    return result


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(cohort: pd.DataFrame, checksum: str) -> dict[str, Any]:
    target = cohort[TARGET_COLUMN]
    return {
        "source_type": "real_lasi_wave1",
        "target_policy": APPROVED_TARGET_POLICY,
        "canonical_target_name": TARGET_NAME,
        "target_column": TARGET_COLUMN,
        "output_schema": list(MODEL_COHORT_SCHEMA),
        "approved_predictors": list(PRODUCTION_PREDICTOR_ORDER),
        "total_count": len(cohort),
        "positive_count": int(target.eq(1).sum()),
        "negative_count": int(target.eq(0).sum()),
        "parquet_sha256": checksum,
        "software_versions": {
            "python": platform.python_version(),
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
        "group_id_hashing_method": "HMAC-SHA256 with household/ssu domain separation",
        "contains_raw_identifiers": False,
        "contains_raw_bp_values": False,
        "contains_target_defining_variables": False,
        "contains_absolute_paths": False,
        "contains_synthetic_training_records": False,
        "model_trained": False,
        "split_created": False,
        "locked_test_created": False,
        "research_only": True,
    }


def build_summary(cohort: pd.DataFrame) -> dict[str, Any]:
    target = cohort[TARGET_COLUMN]
    weights = pd.to_numeric(cohort[WEIGHT_COLUMN], errors="coerce")
    valid_weight = weights.notna() & np.isfinite(weights) & weights.gt(0)
    return {
        "target_counts": {
            "total": len(cohort),
            "positive": int(target.eq(1).sum()),
            "negative": int(target.eq(0).sum()),
        },
        "target_percentage": round(float(target.mean()) * 100, 6),
        "predictor_missingness": {
            name: int(cohort[name].isna().sum()) for name in PRODUCTION_PREDICTOR_ORDER
        },
        "unique_deidentified_household_count": int(cohort["household_group_id"].nunique()),
        "unique_deidentified_ssu_count": int(cohort["ssu_group_id"].nunique()),
        "positive_finite_national_weight_count": int(valid_weight.sum()),
        "invalid_or_missing_weight_count": int((~valid_weight).sum()),
        "exact_schema_confirmed": tuple(cohort.columns) == MODEL_COHORT_SCHEMA,
        "forbidden_column_intersection": sorted(FORBIDDEN_COLUMNS & set(cohort.columns)),
    }


def write_model_cohort(
    cohort: pd.DataFrame, output_dir: Path
) -> tuple[Path, Path, Path]:
    validate_output_directory(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    existing = {path.name for path in output_dir.iterdir()}
    if existing:
        raise ValueError("Output directory must be empty before cohort creation")
    parquet_path = output_dir / OUTPUT_FILENAMES[0]
    manifest_path = output_dir / OUTPUT_FILENAMES[1]
    summary_path = output_dir / OUTPUT_FILENAMES[2]
    cohort.to_parquet(parquet_path, index=False)
    manifest = build_manifest(cohort, sha256_file(parquet_path))
    summary = build_summary(cohort)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    return parquet_path, manifest_path, summary_path


def execute(data_root: Path, output_dir: Path, salt: str) -> tuple[Path, Path, Path]:
    validate_paths(data_root, output_dir)
    validate_output_directory(output_dir)
    joined, _ = private_join(*read_sources(data_root))
    return write_model_cohort(construct_model_cohort(joined, salt), output_dir)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    execute(args.data_root, args.output_dir, require_group_salt())
    print("Restricted LASI hypertension model cohort created outside Git.")


if __name__ == "__main__":
    main()
