"""Select aggregate LASI screening-threshold candidates on development data.

The locked test fold is recreated and verified but never fitted or evaluated.
All out-of-fold probabilities remain transient in memory; outputs contain only
aggregate threshold and sensitivity-analysis results.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, PolynomialFeatures, StandardScaler


TARGET = "target_undiagnosed_diabetes"
GROUP = "ssu_group_id"
LOCKED_FOLD_INDEX = 0
SENSITIVITY_TARGETS = [0.80, 0.85, 0.90]
EXPECTED_COUNTS = {"total": 50_865, "positive": 4_635, "negative": 46_230}
EXPECTED_SCHEMA = [
    "age", "sex", "bmi", "waist_cm", "systolic_bp", "diastolic_bp", TARGET,
    "household_group_id", GROUP, "state", "india_dbs_weight",
    "flag_height_100_to_129", "flag_age_above_100", "flag_height_invalid",
    "flag_waist_invalid", "flag_bmi_invalid",
]
PRIMARY_FEATURES = ["age", "bmi"]
CHALLENGER_FEATURES = [
    "age", "bmi", "sex", "age_squared", "bmi_squared", "age_bmi_interaction"
]
FORBIDDEN_PREDICTORS = set(EXPECTED_SCHEMA) - {"age", "bmi", "sex"}
OUTPUT_FILES = [
    "lasi_threshold_candidates.csv", "lasi_threshold_model_comparison.json",
    "lasi_threshold_fold_stability.json", "lasi_threshold_sensitivity_analyses.json",
    "lasi_threshold_run_manifest.json",
]
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cohort-path", required=True, type=Path)
    parser.add_argument("--manifest-path", required=True, type=Path)
    parser.add_argument("--validation-report-path", required=True, type=Path)
    parser.add_argument("--development-run-manifest-path", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--random-seed", required=True, type=int)
    return parser.parse_args()


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate_output_dir(output_dir: Path) -> None:
    if _is_within(output_dir, REPOSITORY_ROOT):
        raise ValueError("Output directory must be outside the Git repository")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _cohort_counts(cohort: pd.DataFrame) -> dict[str, int]:
    target = pd.to_numeric(cohort[TARGET], errors="coerce")
    return {
        "total": int(len(cohort)), "positive": int(target.eq(1).sum()),
        "negative": int(target.eq(0).sum()),
    }


def validate_preconditions(
    cohort_path: Path,
    cohort: pd.DataFrame,
    manifest: dict[str, Any],
    validation_report: dict[str, Any],
    development_manifest: dict[str, Any],
    random_seed: int,
    expected_counts: dict[str, int] | None = None,
) -> dict[str, int]:
    expected = expected_counts or EXPECTED_COUNTS
    failures = []
    if validation_report.get("validation_passed") is not True:
        failures.append("Passing independent cohort validation is mandatory")
    for field, required in {
        "source_type": "real_lasi_wave1", "contains_raw_identifiers": False,
        "contains_target_defining_variables": False,
        "contains_synthetic_training_records": False,
    }.items():
        if manifest.get(field) != required:
            failures.append(f"Cohort manifest mismatch: {field}")
    if _sha256(cohort_path) != manifest.get("parquet_sha256"):
        failures.append("Cohort checksum mismatch")
    if list(cohort.columns) != EXPECTED_SCHEMA:
        failures.append("Cohort schema is not exact")
    counts = _cohort_counts(cohort) if TARGET in cohort else {"total": len(cohort), "positive": 0, "negative": 0}
    if counts != expected:
        failures.append("Cohort or target counts mismatch")
    for name, value in expected.items():
        key = "primary_cohort_count" if name == "total" else f"{name}_count"
        if manifest.get(key) != value:
            failures.append(f"Manifest count mismatch: {key}")
    if development_manifest.get("random_seed") != random_seed:
        failures.append("Phase 3A random seed mismatch")
    if development_manifest.get("split_method") != "StratifiedGroupKFold(n_splits=5, shuffle=True)":
        failures.append("Phase 3A split method mismatch")
    if development_manifest.get("locked_fold_index") != LOCKED_FOLD_INDEX:
        failures.append("Phase 3A locked fold index mismatch")
    locked_declared = development_manifest.get("locked_test_evaluated")
    if locked_declared is None:
        locked_declared = development_manifest.get(
            "locked_test_aggregate_structure", {}
        ).get("evaluated")
    if locked_declared is not False:
        failures.append("Phase 3A must declare locked test unevaluated")
    if failures:
        raise ValueError("; ".join(failures))
    return counts


def build_model(model_name: str, random_seed: int) -> tuple[Pipeline, list[str]]:
    numeric_steps = [
        ("imputer", SimpleImputer(strategy="median")),
    ]
    transformers: list[tuple[str, Any, list[str]]] = []
    if model_name == "primary_A":
        numeric_steps.append(("scaler", StandardScaler()))
        transformers.append(("numeric", Pipeline(numeric_steps), ["age", "bmi"]))
        raw_features = ["age", "bmi"]
    elif model_name == "challenger_C":
        numeric_steps.extend([
            ("engineered_age_bmi", PolynomialFeatures(degree=2, include_bias=False)),
            ("scaler", StandardScaler()),
        ])
        transformers.append(("numeric", Pipeline(numeric_steps), ["age", "bmi"]))
        transformers.append((
            "sex", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("one_hot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]), ["sex"],
        ))
        raw_features = ["age", "bmi", "sex"]
    else:
        raise ValueError(f"Unknown model definition: {model_name}")
    if set(raw_features) & FORBIDDEN_PREDICTORS:
        raise ValueError("Forbidden predictor requested")
    estimator = LogisticRegression(
        l1_ratio=0.0, solver="lbfgs", C=1.0, max_iter=2000,
        class_weight=None, random_state=random_seed,
    )
    return Pipeline([
        ("preprocessing", ColumnTransformer(transformers, remainder="drop")),
        ("model", estimator),
    ]), raw_features


def recreate_split(
    cohort: pd.DataFrame, random_seed: int, phase3a_locked: dict[str, Any]
) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=random_seed)
    development_index, locked_index = list(splitter.split(
        cohort, cohort[TARGET], cohort[GROUP]
    ))[LOCKED_FOLD_INDEX]
    locked = cohort.iloc[locked_index]
    structure = {
        "row_count": int(len(locked)),
        "positive_count": int(locked[TARGET].eq(1).sum()),
        "negative_count": int(locked[TARGET].eq(0).sum()),
        "positive_percentage": float(100 * locked[TARGET].mean()),
        "unique_ssu_count": int(locked[GROUP].nunique()),
    }
    for key, value in structure.items():
        expected = phase3a_locked.get(key)
        matches = np.isclose(value, expected) if isinstance(value, float) else value == expected
        if not matches:
            raise ValueError(f"Phase 3A locked-test aggregate mismatch: {key}")
    return development_index, locked_index, structure


def development_folds(development: pd.DataFrame, random_seed: int):
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=random_seed + 1)
    return list(splitter.split(development, development[TARGET], development[GROUP]))


def out_of_fold_probabilities(
    development: pd.DataFrame,
    model_name: str,
    random_seed: int,
    sample_weight: pd.Series | None = None,
) -> tuple[np.ndarray, list[np.ndarray]]:
    probabilities = np.full(len(development), np.nan)
    validation_indices = []
    for train_index, validation_index in development_folds(development, random_seed):
        train_groups = set(development.iloc[train_index][GROUP])
        validation_groups = set(development.iloc[validation_index][GROUP])
        if train_groups & validation_groups:
            raise RuntimeError("SSU crossed a development fold")
        pipeline, raw_features = build_model(model_name, random_seed)
        fit_kwargs = {}
        if sample_weight is not None:
            fit_kwargs["model__sample_weight"] = np.asarray(sample_weight.iloc[train_index])
        pipeline.fit(
            development.iloc[train_index][raw_features],
            development.iloc[train_index][TARGET], **fit_kwargs,
        )
        probabilities[validation_index] = pipeline.predict_proba(
            development.iloc[validation_index][raw_features]
        )[:, 1]
        validation_indices.append(validation_index)
    if not np.isfinite(probabilities).all():
        raise RuntimeError("Incomplete development out-of-fold probabilities")
    return probabilities, validation_indices


def select_threshold(target: np.ndarray, probability: np.ndarray, sensitivity_target: float) -> float:
    positives = int(np.sum(target == 1))
    if positives == 0:
        raise ValueError("Threshold selection requires positive development cases")
    candidates = np.unique(probability)[::-1]
    qualifying = [
        threshold for threshold in candidates
        if np.sum((probability >= threshold) & (target == 1)) / positives >= sensitivity_target
    ]
    if not qualifying:
        raise ValueError(f"No threshold reaches sensitivity {sensitivity_target}")
    return float(max(qualifying))


def threshold_metrics(
    target: np.ndarray,
    probability: np.ndarray,
    threshold: float,
    weights: np.ndarray | None = None,
) -> dict[str, Any]:
    predicted = probability >= threshold
    weight = np.ones(len(target), dtype=float) if weights is None else np.asarray(weights, dtype=float)
    tp = float(weight[(target == 1) & predicted].sum())
    fp = float(weight[(target == 0) & predicted].sum())
    tn = float(weight[(target == 0) & ~predicted].sum())
    fn = float(weight[(target == 1) & ~predicted].sum())
    divide = lambda numerator, denominator: float(numerator / denominator) if denominator else None
    sensitivity = divide(tp, tp + fn)
    specificity = divide(tn, tn + fp)
    precision = divide(tp, tp + fp)
    npv = divide(tn, tn + fn)
    f1 = divide(2 * tp, 2 * tp + fp + fn)
    f2 = divide(5 * tp, 5 * tp + 4 * fn + fp)
    return {
        "threshold": float(threshold), "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "sensitivity": sensitivity, "specificity": specificity,
        "precision": precision, "negative_predictive_value": npv,
        "f1": f1, "f2": f2,
        "balanced_accuracy": (sensitivity + specificity) / 2,
        "referral_count": float(weight[predicted].sum()),
        "referral_percentage": float(100 * weight[predicted].sum() / weight.sum()),
    }


def candidate_results(target: np.ndarray, probability: np.ndarray) -> list[dict[str, Any]]:
    rows = []
    for sensitivity_target in SENSITIVITY_TARGETS:
        threshold = select_threshold(target, probability, sensitivity_target)
        rows.append({"sensitivity_target": sensitivity_target, **threshold_metrics(target, probability, threshold)})
    return rows


def fold_stability(
    development: pd.DataFrame,
    probability: np.ndarray,
    candidates: list[dict[str, Any]],
    random_seed: int,
) -> list[dict[str, Any]]:
    target = development[TARGET].to_numpy()
    folds = development_folds(development, random_seed)
    results = []
    metrics = [
        "tp", "fp", "tn", "fn",
        "sensitivity", "specificity", "precision", "negative_predictive_value",
        "f1", "f2", "balanced_accuracy", "referral_count", "referral_percentage",
    ]
    for candidate in candidates:
        per_fold = [
            threshold_metrics(target[index], probability[index], candidate["threshold"])
            for _, index in folds
        ]
        summary = {}
        for metric in metrics:
            values = np.array([row[metric] for row in per_fold], dtype=float)
            summary[metric] = {
                "mean": float(values.mean()), "standard_deviation": float(values.std(ddof=1)),
                "minimum": float(values.min()), "maximum": float(values.max()),
            }
        results.append({
            "sensitivity_target": candidate["sensitivity_target"],
            "fixed_threshold": candidate["threshold"],
            "fold_metric_summary": summary,
            "folds_meeting_sensitivity_target": int(sum(
                row["sensitivity"] >= candidate["sensitivity_target"] for row in per_fold
            )),
        })
    return results


def run_analysis(
    cohort: pd.DataFrame, development_index: np.ndarray, random_seed: int
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any], dict[str, Any]]:
    development = cohort.iloc[development_index].reset_index(drop=True)
    target = development[TARGET].to_numpy()
    primary_probability, _ = out_of_fold_probabilities(development, "primary_A", random_seed)
    challenger_probability, _ = out_of_fold_probabilities(development, "challenger_C", random_seed)
    primary_candidates = candidate_results(target, primary_probability)
    challenger_candidates = candidate_results(target, challenger_probability)
    stability = {
        "primary_A": fold_stability(development, primary_probability, primary_candidates, random_seed),
        "challenger_C": fold_stability(development, challenger_probability, challenger_candidates, random_seed),
    }
    comparison = {
        "automatic_final_selection": False,
        "manual_approval_required": True,
        "primary_A": primary_candidates,
        "challenger_C": challenger_candidates,
    }

    weighted_probability, _ = out_of_fold_probabilities(
        development, "primary_A", random_seed,
        sample_weight=development["india_dbs_weight"],
    )
    weighted_candidates = candidate_results(target, weighted_probability)
    weighted = []
    weights = development["india_dbs_weight"].to_numpy()
    for candidate in weighted_candidates:
        threshold = candidate["threshold"]
        weighted.append({
            "sensitivity_target": candidate["sensitivity_target"],
            "threshold": threshold,
            "ordinary_metrics": threshold_metrics(target, weighted_probability, threshold),
            "survey_weighted_metrics": threshold_metrics(target, weighted_probability, threshold, weights),
        })

    short_height = development.copy()
    short_height.loc[short_height["flag_height_100_to_129"].eq(True), "bmi"] = np.nan
    short_probability, _ = out_of_fold_probabilities(short_height, "primary_A", random_seed)
    age_filtered = development.loc[~development["flag_age_above_100"].eq(True)].reset_index(drop=True)
    age_probability, _ = out_of_fold_probabilities(age_filtered, "primary_A", random_seed)
    sensitivity = {
        "primary_unweighted_reference": primary_candidates,
        "survey_weighted_training": weighted,
        "short_height_bmi_as_missing": candidate_results(target, short_probability),
        "age_above_100_excluded": candidate_results(age_filtered[TARGET].to_numpy(), age_probability),
        "primary_dataset_modified": False,
    }
    candidate_rows = [
        {"model": model, **row}
        for model, rows in (("primary_A", primary_candidates), ("challenger_C", challenger_candidates))
        for row in rows
    ]
    return candidate_rows, comparison, stability, sensitivity


def _package_version(name: str) -> str | None:
    try:
        return version(name)
    except PackageNotFoundError:
        return None


def write_outputs(
    output_dir: Path,
    cohort_checksum: str,
    random_seed: int,
    candidates: list[dict[str, Any]],
    comparison: dict[str, Any],
    stability: dict[str, Any],
    sensitivity: dict[str, Any],
) -> None:
    validate_output_dir(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(candidates).to_csv(output_dir / OUTPUT_FILES[0], index=False)
    for filename, payload in zip(OUTPUT_FILES[1:4], (comparison, stability, sensitivity)):
        (output_dir / filename).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    manifest = {
        "source_type": "real_lasi_wave1", "cohort_checksum": cohort_checksum,
        "random_seed": random_seed,
        "split_method": "StratifiedGroupKFold(n_splits=5, shuffle=True)",
        "locked_fold_index": LOCKED_FOLD_INDEX, "locked_test_evaluated": False,
        "primary_model_definition": {
            "features": PRIMARY_FEATURES,
            "pipeline": "median imputer -> standard scaler -> L2 logistic regression",
        },
        "challenger_definition": {
            "features": CHALLENGER_FEATURES,
            "pipeline": "fold-local imputation -> degree-2 age/BMI terms and sex encoding -> scaling -> logistic regression",
            "automatically_approved": False,
        },
        "sensitivity_targets": SENSITIVITY_TARGETS,
        "weighted_training_policy": "india_dbs_weight used only as model sample_weight",
        "sensitivity_analysis_policies": {
            "short_height": "BMI set missing only in copied sensitivity data",
            "age_above_100": "flagged rows excluded only from copied sensitivity data",
        },
        "software_versions": {
            "python": platform.python_version(), "pandas": pd.__version__,
            "numpy": np.__version__, "scikit_learn": _package_version("scikit-learn"),
        },
        "contains_participant_records": False, "contains_row_level_predictions": False,
        "contains_group_identifier_values": False, "synthetic_training_records_used": False,
        "raw_lasi_files_accessed": False, "old_icmr_model_used": False,
    }
    (output_dir / OUTPUT_FILES[4]).write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    validate_output_dir(args.output_dir)
    paths = [args.cohort_path, args.manifest_path, args.validation_report_path, args.development_run_manifest_path]
    if not all(path.is_file() for path in paths):
        raise SystemExit("All required Phase 3B inputs must exist; no fallback is available")
    manifest = json.loads(args.manifest_path.read_text(encoding="utf-8"))
    validation = json.loads(args.validation_report_path.read_text(encoding="utf-8"))
    development_manifest = json.loads(args.development_run_manifest_path.read_text(encoding="utf-8"))
    cohort = pd.read_parquet(args.cohort_path, engine="pyarrow")
    validate_preconditions(
        args.cohort_path, cohort, manifest, validation, development_manifest,
        args.random_seed,
    )
    phase3a_locked = development_manifest["locked_test_aggregate_structure"]
    development_index, _locked_index, _ = recreate_split(cohort, args.random_seed, phase3a_locked)
    candidates, comparison, stability, sensitivity = run_analysis(
        cohort, development_index, args.random_seed
    )
    write_outputs(
        args.output_dir, manifest["parquet_sha256"], args.random_seed,
        candidates, comparison, stability, sensitivity,
    )
    print("LASI threshold candidates generated; manual approval remains required.")


if __name__ == "__main__":
    main()
