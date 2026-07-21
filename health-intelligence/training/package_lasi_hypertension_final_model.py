"""Package the manually approved restricted LASI hypertension model."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn

try:
    from training.build_lasi_hypertension_cohort import (
        REPOSITORY_ROOT,
        construct_target_cohort,
        private_join,
        read_sources,
        validate_paths,
    )
    from training.evaluate_lasi_hypertension_locked_test import (
        FROZEN_CONFIGURATION,
        FROZEN_FEATURES,
        FROZEN_FEATURE_SET,
        FROZEN_MODEL,
        FROZEN_RANDOM_SEED,
        FROZEN_THRESHOLD,
        load_and_verify_development_outputs,
    )
    from training.train_lasi_hypertension_development import (
        build_pipeline,
        create_development_splits,
    )
    from training.validate_lasi_hypertension_locked_test_outputs import (
        validate_outputs as validate_locked_outputs,
    )
except ModuleNotFoundError:
    from build_lasi_hypertension_cohort import (
        REPOSITORY_ROOT,
        construct_target_cohort,
        private_join,
        read_sources,
        validate_paths,
    )
    from evaluate_lasi_hypertension_locked_test import (
        FROZEN_CONFIGURATION,
        FROZEN_FEATURES,
        FROZEN_FEATURE_SET,
        FROZEN_MODEL,
        FROZEN_RANDOM_SEED,
        FROZEN_THRESHOLD,
        load_and_verify_development_outputs,
    )
    from train_lasi_hypertension_development import build_pipeline, create_development_splits
    from validate_lasi_hypertension_locked_test_outputs import (
        validate_outputs as validate_locked_outputs,
    )

MODEL_VERSION = "lasi_hypertension_v1"
APPROVAL_STATUS = "approved_with_restrictions"
CONFIRMATION_TOKEN = "PACKAGE_APPROVED_RESTRICTED_D_LOGISTIC_V1"
GOVERNANCE_PATH = REPOSITORY_ROOT / "model-governance" / "lasi_hypertension_v1_decision.json"
MODEL_FILENAME = f"{MODEL_VERSION}.joblib"
METADATA_FILENAME = f"{MODEL_VERSION}_metadata.json"
SHA256_FILENAME = f"{MODEL_VERSION}_sha256.json"
OUTPUT_FILENAMES = {MODEL_FILENAME, METADATA_FILENAME, SHA256_FILENAME}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_governance(path: Path = GOVERNANCE_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_governance(
    decision: dict[str, Any],
    locked_payloads: dict[str, Any] | None = None,
) -> None:
    expected = {
        "model_version": MODEL_VERSION,
        "approval_status": APPROVAL_STATUS,
        "configuration": FROZEN_CONFIGURATION,
        "feature_set": FROZEN_FEATURE_SET,
        "features": list(FROZEN_FEATURES),
        "frozen_threshold": FROZEN_THRESHOLD,
        "random_seed": FROZEN_RANDOM_SEED,
        "target": "undiagnosed_elevated_bp_screening_target",
        "target_policy": "last_two_pairs_mean",
        "approved_for_diagnosis": False,
        "approved_for_treatment_decisions": False,
        "approved_for_screening_awareness": True,
        "no_exact_probability_display": True,
        "confirmatory_blood_pressure_measurement_required": True,
        "automatic_approval_performed": False,
        "manual_approval_recorded": True,
    }
    for key, value in expected.items():
        if decision.get(key) != value:
            raise ValueError(f"Governance decision mismatch: {key}")
    required_text = ("allowed_use", "approved_user_facing_interpretation", "approval_rationale", "decision_date")
    if any(not isinstance(decision.get(key), str) or not decision[key] for key in required_text):
        raise ValueError("Governance decision is missing required explanatory text")
    if not decision.get("prohibited_uses") or not decision.get("known_limitations"):
        raise ValueError("Governance restrictions and limitations are required")
    if locked_payloads is not None:
        metrics = locked_payloads["lasi_hypertension_locked_test_metrics.json"]
        calibration = locked_payloads["lasi_hypertension_locked_test_calibration.json"]
        observed_metrics = {
            key: metrics.get(key) for key in decision["locked_test_metrics"]
        }
        if observed_metrics != decision["locked_test_metrics"]:
            raise ValueError("Governance locked-test metrics do not match validated evidence")
        observed_calibration = {
            "intercept": calibration.get("calibration_intercept"),
            "slope": calibration.get("calibration_slope"),
        }
        if observed_calibration != decision["locked_test_calibration"]:
            raise ValueError("Governance calibration does not match validated evidence")


def load_locked_payloads(output_dir: Path, minimum: int = 10) -> dict[str, Any]:
    validate_locked_outputs(output_dir, minimum)
    return {
        path.name: json.loads(path.read_text(encoding="utf-8"))
        for path in output_dir.iterdir()
        if path.is_file()
    }


def _validate_in_memory_prerequisites(
    development: dict[str, Any],
    locked: dict[str, Any],
    decision: dict[str, Any],
) -> None:
    development_manifest = development["lasi_hypertension_training_manifest.json"]
    if development_manifest.get("locked_test_evaluated") is not False:
        raise ValueError("Development bundle must precede locked-test evaluation")
    if development_manifest.get("random_seed") != FROZEN_RANDOM_SEED:
        raise ValueError("Development random seed mismatch")
    threshold_rows = development["lasi_hypertension_threshold_selection.json"].get("configurations", [])
    frozen = [row for row in threshold_rows if row.get("configuration") == FROZEN_CONFIGURATION]
    if len(frozen) != 1 or frozen[0].get("threshold") != FROZEN_THRESHOLD:
        raise ValueError("Development frozen threshold mismatch")
    locked_manifest = locked["lasi_hypertension_locked_test_manifest.json"]
    if locked_manifest.get("frozen_configuration") != FROZEN_CONFIGURATION:
        raise ValueError("Locked-test configuration mismatch")
    if locked_manifest.get("frozen_features") != list(FROZEN_FEATURES):
        raise ValueError("Locked-test feature order mismatch")
    if locked_manifest.get("frozen_threshold") != FROZEN_THRESHOLD:
        raise ValueError("Locked-test threshold mismatch")
    if locked_manifest.get("locked_test_evaluated") is not True:
        raise ValueError("Locked-test evidence is incomplete")
    validate_governance(decision, locked)


def package_model(
    joined: pd.DataFrame,
    development: dict[str, Any],
    locked: dict[str, Any],
    decision: dict[str, Any],
    output_dir: Path,
) -> dict[str, Any]:
    """Fit only on development partitions and serialize the complete pipeline."""
    _validate_in_memory_prerequisites(development, locked, decision)
    if output_dir.exists() and not output_dir.is_dir():
        raise ValueError(f"Model output path is not a directory: {output_dir}")
    if output_dir.exists() and any(output_dir.iterdir()):
        raise RuntimeError("Final model output directory must be empty; packaging is not repeatable")
    output_dir.mkdir(parents=True, exist_ok=True)

    cohort, predictors, target, _ = construct_target_cohort(joined)
    groups = cohort[["hhid", "ssuid"]].reset_index(drop=True)
    predictors = predictors.reset_index(drop=True)
    target = target.reset_index(drop=True).astype(int)
    splits = create_development_splits(groups, target, FROZEN_RANDOM_SEED)
    fit_index = np.sort(np.concatenate((splits["training"], splits["validation"])))
    locked_index = splits["locked_test"]
    if np.intersect1d(fit_index, locked_index).size:
        raise RuntimeError("Locked-test rows overlap final fitting rows")

    pipeline = build_pipeline(FROZEN_MODEL, FROZEN_FEATURES, FROZEN_RANDOM_SEED)
    pipeline.fit(
        predictors.iloc[fit_index][list(FROZEN_FEATURES)],
        target.iloc[fit_index],
    )
    model_path = output_dir / MODEL_FILENAME
    temporary_model = output_dir / f".{MODEL_FILENAME}.tmp"
    joblib.dump(pipeline, temporary_model)
    os.replace(temporary_model, model_path)
    checksum = sha256_file(model_path)

    metadata = {
        "model_version": MODEL_VERSION,
        "approval_status": APPROVAL_STATUS,
        "configuration": FROZEN_CONFIGURATION,
        "feature_set": FROZEN_FEATURE_SET,
        "features": list(FROZEN_FEATURES),
        "model_type": "sklearn.pipeline.Pipeline(LogisticRegression)",
        "frozen_threshold": FROZEN_THRESHOLD,
        "random_seed": FROZEN_RANDOM_SEED,
        "target": decision["target"],
        "target_policy": decision["target_policy"],
        "fitting_partitions": ["training", "validation"],
        "locked_test_excluded_from_fitting": True,
        "locked_test_used_for_model_selection": False,
        "accepted_data_types": {
            "age": "numeric",
            "height_cm": "numeric",
            "weight_kg": "numeric",
            "sex": "categorical: 1 or 2",
            "family_history_hypertension": "categorical: 0 or 1",
            "physical_activity_category": "categorical: high, moderate or low",
            "smoking_category": "categorical: never, current or former",
        },
        "categorical_handling": "Missing values are imputed within the fitted pipeline; unknown categories are ignored safely by one-hot encoding.",
        "no_exact_probability_display": True,
        "confirmatory_blood_pressure_measurement_required": True,
        "approved_user_facing_interpretation": decision["approved_user_facing_interpretation"],
        "allowed_use": decision["allowed_use"],
        "prohibited_uses": decision["prohibited_uses"],
        "approved_for_diagnosis": False,
        "approved_for_treatment_decisions": False,
        "approved_for_screening_awareness": True,
        "participant_level_data_exported": False,
        "raw_data_paths_exported": False,
        "artifact_filename": MODEL_FILENAME,
        "artifact_sha256": checksum,
        "runtime_versions": {
            "python": platform.python_version(),
            "sklearn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
    }
    checksum_payload = {
        "model_version": MODEL_VERSION,
        "artifact_filename": MODEL_FILENAME,
        "sha256": checksum,
    }
    (output_dir / METADATA_FILENAME).write_text(
        json.dumps(metadata, indent=2, sort_keys=True), encoding="utf-8"
    )
    (output_dir / SHA256_FILENAME).write_text(
        json.dumps(checksum_payload, indent=2, sort_keys=True), encoding="utf-8"
    )
    return {"metadata": metadata, "sha256": checksum_payload}


def execute(
    data_root: Path,
    development_output_dir: Path,
    locked_test_output_dir: Path,
    model_output_dir: Path,
    confirmation_token: str,
    minimum: int = 10,
) -> dict[str, Any]:
    if confirmation_token != CONFIRMATION_TOKEN:
        raise ValueError("Exact final-model packaging confirmation token is required")
    validate_paths(data_root, model_output_dir)
    for label, path in (
        ("development-output-dir", development_output_dir),
        ("locked-test-output-dir", locked_test_output_dir),
    ):
        try:
            path.resolve().relative_to(REPOSITORY_ROOT.resolve())
        except ValueError:
            pass
        else:
            raise ValueError(f"{label} must be outside the Git worktree")
    development = load_and_verify_development_outputs(development_output_dir, minimum)
    locked = load_locked_payloads(locked_test_output_dir, minimum)
    decision = load_governance()
    validate_governance(decision, locked)
    joined, _ = private_join(*read_sources(data_root))
    return package_model(joined, development, locked, decision, model_output_dir)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", required=True, type=Path)
    parser.add_argument("--development-output-dir", required=True, type=Path)
    parser.add_argument("--locked-test-output-dir", required=True, type=Path)
    parser.add_argument("--model-output-dir", required=True, type=Path)
    parser.add_argument("--confirmation-token", required=True)
    parser.add_argument("--min-cell-count", type=int, default=10)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    execute(
        args.data_root,
        args.development_output_dir,
        args.locked_test_output_dir,
        args.model_output_dir,
        args.confirmation_token,
        args.min_cell_count,
    )
    print("Restricted LASI hypertension model packaged outside Git.")


if __name__ == "__main__":
    main()
