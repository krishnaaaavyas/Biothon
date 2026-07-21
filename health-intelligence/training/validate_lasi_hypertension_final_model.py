"""Validate the externally packaged restricted LASI hypertension model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

try:
    from training.build_lasi_hypertension_cohort import REPOSITORY_ROOT
    from training.package_lasi_hypertension_final_model import (
        APPROVAL_STATUS,
        FROZEN_CONFIGURATION,
        FROZEN_FEATURES,
        FROZEN_FEATURE_SET,
        FROZEN_THRESHOLD,
        GOVERNANCE_PATH,
        METADATA_FILENAME,
        MODEL_FILENAME,
        MODEL_VERSION,
        OUTPUT_FILENAMES,
        SHA256_FILENAME,
        load_governance,
        sha256_file,
        validate_governance,
    )
    from training.validate_lasi_hypertension_training_outputs import (
        _forbidden_keys,
        _has_absolute_path,
    )
except ModuleNotFoundError:
    from build_lasi_hypertension_cohort import REPOSITORY_ROOT
    from package_lasi_hypertension_final_model import (
        APPROVAL_STATUS,
        FROZEN_CONFIGURATION,
        FROZEN_FEATURES,
        FROZEN_FEATURE_SET,
        FROZEN_THRESHOLD,
        GOVERNANCE_PATH,
        METADATA_FILENAME,
        MODEL_FILENAME,
        MODEL_VERSION,
        OUTPUT_FILENAMES,
        SHA256_FILENAME,
        load_governance,
        sha256_file,
        validate_governance,
    )
    from validate_lasi_hypertension_training_outputs import _forbidden_keys, _has_absolute_path


def _inside(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate_model(
    model_output_dir: Path,
    governance_path: Path = GOVERNANCE_PATH,
) -> dict[str, Any]:
    if _inside(model_output_dir, REPOSITORY_ROOT):
        raise ValueError("model-output-dir must be outside the Git worktree")
    if not model_output_dir.is_dir():
        raise FileNotFoundError(f"Model output directory is unavailable: {model_output_dir}")
    actual = {path.name for path in model_output_dir.iterdir() if path.is_file()}
    if actual != OUTPUT_FILENAMES:
        raise ValueError(
            f"Final model filenames mismatch; missing={sorted(OUTPUT_FILENAMES - actual)}; "
            f"unexpected={sorted(actual - OUTPUT_FILENAMES)}"
        )
    metadata = json.loads((model_output_dir / METADATA_FILENAME).read_text(encoding="utf-8"))
    checksum_payload = json.loads((model_output_dir / SHA256_FILENAME).read_text(encoding="utf-8"))
    decision = load_governance(governance_path)
    validate_governance(decision)
    errors: list[str] = []
    expected = {
        "model_version": MODEL_VERSION,
        "approval_status": APPROVAL_STATUS,
        "configuration": FROZEN_CONFIGURATION,
        "feature_set": FROZEN_FEATURE_SET,
        "features": list(FROZEN_FEATURES),
        "frozen_threshold": FROZEN_THRESHOLD,
        "target": decision["target"],
        "target_policy": decision["target_policy"],
        "model_type": "sklearn.pipeline.Pipeline(LogisticRegression)",
        "locked_test_excluded_from_fitting": True,
        "locked_test_used_for_model_selection": False,
        "fitting_partitions": ["training", "validation"],
        "no_exact_probability_display": True,
        "confirmatory_blood_pressure_measurement_required": True,
        "approved_for_diagnosis": False,
        "approved_for_treatment_decisions": False,
        "approved_for_screening_awareness": True,
        "participant_level_data_exported": False,
        "raw_data_paths_exported": False,
    }
    for key, value in expected.items():
        if metadata.get(key) != value:
            errors.append(f"Metadata mismatch: {key}")
    for key in (
        "allowed_use", "prohibited_uses", "approved_user_facing_interpretation"
    ):
        if metadata.get(key) != decision.get(key):
            errors.append(f"Metadata governance restriction mismatch: {key}")
    if _forbidden_keys(metadata):
        errors.append("Participant, prediction, identifier, or raw BP keys detected")
    if _has_absolute_path(metadata) or _has_absolute_path(checksum_payload):
        errors.append("Absolute path detected in packaged metadata")
    model_path = model_output_dir / MODEL_FILENAME
    observed_hash = sha256_file(model_path)
    if metadata.get("artifact_sha256") != observed_hash:
        errors.append("Metadata artifact hash mismatch")
    if checksum_payload != {
        "model_version": MODEL_VERSION,
        "artifact_filename": MODEL_FILENAME,
        "sha256": observed_hash,
    }:
        errors.append("SHA-256 record mismatch")
    try:
        model = joblib.load(model_path)
    except Exception as exc:
        raise ValueError("Packaged model cannot be loaded") from exc
    if not isinstance(model, Pipeline):
        errors.append("Packaged model is not a complete sklearn Pipeline")
    elif not isinstance(model.named_steps.get("classifier"), LogisticRegression):
        errors.append("Packaged classifier is not LogisticRegression")
    elif set(model.named_steps) != {"preprocessing", "classifier"}:
        errors.append("Packaged pipeline steps are unexpected")
    if errors:
        raise ValueError("; ".join(errors))
    return {
        "validation_passed": True,
        "model_version": MODEL_VERSION,
        "artifact_sha256": observed_hash,
        "locked_test_excluded_from_fitting": True,
        "approval_status": APPROVAL_STATUS,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-output-dir", required=True, type=Path)
    parser.add_argument("--governance-path", type=Path, default=GOVERNANCE_PATH)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    validate_model(args.model_output_dir, args.governance_path)
    print("Restricted LASI hypertension final model passed integrity validation.")


if __name__ == "__main__":
    main()
