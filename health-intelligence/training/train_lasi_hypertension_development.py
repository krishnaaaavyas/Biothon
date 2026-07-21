"""Run aggregate-only LASI hypertension development experiments."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

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
    from training.lasi_hypertension_audit_utils import APPROVED_PRODUCTION_PREDICTORS
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
    from lasi_hypertension_audit_utils import APPROVED_PRODUCTION_PREDICTORS

RANDOM_SEED = 42
SENSITIVITY_TARGET = 0.80
FEATURE_SETS = {
    "A": ("age", "bmi"),
    "B": ("age", "bmi", "sex"),
    "C": (
        "age", "bmi", "sex", "family_history_hypertension",
        "physical_activity_category", "smoking_category",
    ),
    "D": (
        "age", "height_cm", "weight_kg", "sex",
        "family_history_hypertension", "physical_activity_category",
        "smoking_category",
    ),
}
NUMERIC_FEATURES = {"age", "height_cm", "weight_kg", "bmi"}
CATEGORICAL_FEATURES = APPROVED_PRODUCTION_PREDICTORS - NUMERIC_FEATURES
MODEL_NAMES = (
    "logistic_regression",
    "random_forest",
    "hist_gradient_boosting",
)
OUTPUT_FILENAMES = {
    "lasi_hypertension_training_manifest.json",
    "lasi_hypertension_split_summary.json",
    "lasi_hypertension_feature_set_results.json",
    "lasi_hypertension_candidate_model_results.json",
    "lasi_hypertension_threshold_selection.json",
    "lasi_hypertension_calibration_summary.json",
}


def suppress_count(count: int, minimum: int) -> int | str:
    return count if count == 0 or count >= minimum else f"SUPPRESSED_BELOW_{minimum}"


def validate_feature_sets() -> None:
    for name, features in FEATURE_SETS.items():
        if len(features) != len(set(features)):
            raise ValueError(f"Feature set {name} contains duplicate predictors")
        forbidden = set(features) - APPROVED_PRODUCTION_PREDICTORS
        if forbidden:
            raise ValueError(f"Feature set {name} contains unapproved predictors: {sorted(forbidden)}")
    if APPROVED_TARGET_POLICY != "last_two_pairs_mean":
        raise ValueError("Unsupported hypertension target policy")


def _best_group_holdout(
    index: np.ndarray,
    groups: pd.Series,
    target: pd.Series,
    fraction: float,
    seed: int,
) -> tuple[np.ndarray, np.ndarray]:
    if len(index) == 0 or groups.iloc[index].nunique() < 2:
        raise ValueError("At least two nonmissing groups are required for splitting")
    overall_prevalence = float(target.iloc[index].mean())
    best: tuple[float, np.ndarray, np.ndarray] | None = None
    for offset in range(100):
        splitter = GroupShuffleSplit(n_splits=1, test_size=fraction, random_state=seed + offset)
        train_local, test_local = next(
            splitter.split(index, target.iloc[index], groups.iloc[index])
        )
        train_index, test_index = index[train_local], index[test_local]
        size_error = abs(len(test_index) / len(index) - fraction)
        prevalence_error = abs(float(target.iloc[test_index].mean()) - overall_prevalence)
        score = size_error + prevalence_error
        if best is None or score < best[0]:
            best = (score, train_index, test_index)
    assert best is not None
    return best[1], best[2]


def create_development_splits(
    frame: pd.DataFrame,
    target: pd.Series,
    seed: int = RANDOM_SEED,
) -> dict[str, np.ndarray]:
    if frame.empty or len(frame) != len(target):
        raise ValueError("Development data and target must be nonempty and aligned")
    if frame[["hhid", "ssuid"]].isna().any().any():
        raise ValueError("Household and SSU groups must be nonmissing")
    if not frame.groupby("hhid")["ssuid"].nunique().le(1).all():
        raise ValueError("Households must nest within one SSU")
    all_index = np.arange(len(frame))
    development, locked = _best_group_holdout(
        all_index, frame["ssuid"], target.reset_index(drop=True), 0.15, seed
    )
    train, validation = _best_group_holdout(
        development,
        frame["ssuid"],
        target.reset_index(drop=True),
        0.15 / 0.85,
        seed + 10_000,
    )
    splits = {"training": train, "validation": validation, "locked_test": locked}
    household_sets = {
        name: set(frame.iloc[index]["hhid"]) for name, index in splits.items()
    }
    if any(
        household_sets[first] & household_sets[second]
        for first, second in (("training", "validation"), ("training", "locked_test"), ("validation", "locked_test"))
    ):
        raise RuntimeError("Household leakage detected between logical partitions")
    return splits


def normalize_categorical_for_sklearn(values: Any) -> Any:
    """Normalize categorical values to strings and missing values to ``np.nan``.

    ColumnTransformer applies this only to categorical predictors. Numeric
    predictors therefore retain their numeric dtypes and continue through the
    separate median-imputation branch.
    """
    if isinstance(values, (pd.DataFrame, pd.Series)):
        normalized = values.astype(object).where(pd.notna(values), np.nan)
        return normalized.map(
            lambda value: str(value) if pd.notna(value) else np.nan
        ).astype(object)
    normalized = np.asarray(values, dtype=object)
    return np.vectorize(
        lambda value: str(value) if pd.notna(value) else np.nan,
        otypes=[object],
    )(normalized)


def build_pipeline(
    model_name: str,
    features: tuple[str, ...],
    seed: int = RANDOM_SEED,
) -> Pipeline:
    numeric = [name for name in features if name in NUMERIC_FEATURES]
    categorical = [name for name in features if name in CATEGORICAL_FEATURES]
    scale = model_name == "logistic_regression"
    dense = model_name == "hist_gradient_boosting"
    numeric_steps: list[tuple[str, Any]] = [("imputer", SimpleImputer(strategy="median"))]
    if scale:
        numeric_steps.append(("scaler", StandardScaler()))
    preprocessing = ColumnTransformer(
        [
            ("numeric", Pipeline(numeric_steps), numeric),
            (
                "categorical",
                Pipeline(
                    [
                        (
                            "object_dtype",
                            FunctionTransformer(
                                normalize_categorical_for_sklearn,
                                feature_names_out="one-to-one",
                            ),
                        ),
                        ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
                        ("one_hot", OneHotEncoder(handle_unknown="ignore", sparse_output=not dense)),
                    ]
                ),
                categorical,
            ),
        ],
        remainder="drop",
    )
    estimators = {
        "logistic_regression": LogisticRegression(max_iter=2000, random_state=seed),
        "random_forest": RandomForestClassifier(
            n_estimators=200, min_samples_leaf=5, random_state=seed, n_jobs=-1
        ),
        "hist_gradient_boosting": HistGradientBoostingClassifier(
            max_iter=150, max_depth=4, random_state=seed
        ),
    }
    if model_name not in estimators:
        raise ValueError(f"Unsupported candidate model: {model_name}")
    return Pipeline([("preprocessing", preprocessing), ("classifier", estimators[model_name])])


def select_validation_threshold(
    target: np.ndarray,
    probability: np.ndarray,
    sensitivity_target: float = SENSITIVITY_TARGET,
) -> dict[str, Any]:
    if len(target) == 0 or len(np.unique(target)) < 2:
        raise ValueError("Validation target must contain both classes")
    candidates = np.unique(np.concatenate(([0.0, 1.0], probability)))
    rows = []
    for threshold in candidates:
        predicted = probability >= threshold
        tn, fp, fn, tp = confusion_matrix(target, predicted, labels=[0, 1]).ravel()
        sensitivity = tp / (tp + fn) if tp + fn else 0.0
        specificity = tn / (tn + fp) if tn + fp else 0.0
        rows.append((float(threshold), sensitivity, specificity))
    qualifying = [row for row in rows if row[1] >= sensitivity_target]
    achieved = bool(qualifying)
    pool = qualifying if qualifying else rows
    selected = max(pool, key=lambda row: (row[2] if achieved else row[1], row[1], row[0]))
    return {
        "threshold": selected[0],
        "sensitivity": selected[1],
        "specificity": selected[2],
        "sensitivity_target": sensitivity_target,
        "sensitivity_target_achieved": achieved,
        "selection_partition": "validation",
    }


def _classification_metrics(
    target: np.ndarray,
    probability: np.ndarray,
    threshold: float,
) -> dict[str, float | None]:
    predicted = probability >= threshold
    tn, fp, fn, tp = confusion_matrix(target, predicted, labels=[0, 1]).ravel()
    def ratio(numerator: int, denominator: int) -> float | None:
        return float(numerator / denominator) if denominator else None
    return {
        "auroc": float(roc_auc_score(target, probability)),
        "average_precision": float(average_precision_score(target, probability)),
        "brier_score": float(brier_score_loss(target, probability)),
        "sensitivity": ratio(tp, tp + fn),
        "specificity": ratio(tn, tn + fp),
        "ppv": ratio(tp, tp + fp),
        "npv": ratio(tn, tn + fn),
    }


def calibration_statistics(target: np.ndarray, probability: np.ndarray) -> dict[str, float | None]:
    clipped = np.clip(probability, 1e-6, 1 - 1e-6)
    logit = np.log(clipped / (1 - clipped)).reshape(-1, 1)
    if len(np.unique(target)) < 2 or float(np.std(logit)) == 0.0:
        return {"intercept": None, "slope": None}
    calibration = LogisticRegression(C=1e6, max_iter=2000)
    calibration.fit(logit, target)
    return {
        "intercept": float(calibration.intercept_[0]),
        "slope": float(calibration.coef_[0][0]),
    }


def split_summary(
    frame: pd.DataFrame,
    target: pd.Series,
    splits: dict[str, np.ndarray],
    minimum: int,
) -> dict[str, Any]:
    partitions = {}
    for name, index in splits.items():
        subset = target.iloc[index]
        partitions[name] = {
            "row_count": suppress_count(len(index), minimum),
            "positive_count": suppress_count(int(subset.eq(1).sum()), minimum),
            "negative_count": suppress_count(int(subset.eq(0).sum()), minimum),
            "prevalence": float(subset.mean()),
            "household_count": suppress_count(int(frame.iloc[index]["hhid"].nunique()), minimum),
            "ssu_count": suppress_count(int(frame.iloc[index]["ssuid"].nunique()), minimum),
        }
    return {
        "partitions": partitions,
        "household_overlap_detected": False,
        "ssu_overlap_detected": False,
        "locked_test_evaluated": False,
    }


def run_development(
    joined: pd.DataFrame,
    minimum: int = 10,
    seed: int = RANDOM_SEED,
) -> dict[str, dict[str, Any]]:
    validate_feature_sets()
    cohort, predictors, target, _ = construct_target_cohort(joined)
    splitting_frame = cohort[["hhid", "ssuid"]].reset_index(drop=True)
    predictors = predictors.reset_index(drop=True)
    target = target.reset_index(drop=True).astype(int)
    splits = create_development_splits(splitting_frame, target, seed)
    feature_results = []
    model_results = []
    threshold_results = []
    calibration_results = []
    for feature_name, features in FEATURE_SETS.items():
        feature_results.append({
            "feature_set": feature_name,
            "features": list(features),
            "experimental_redundancy": False,
        })
        for model_name in MODEL_NAMES:
            configuration = f"{feature_name}_{model_name}"
            pipeline = build_pipeline(model_name, features, seed)
            train_index = splits["training"]
            validation_index = splits["validation"]
            pipeline.fit(predictors.iloc[train_index][list(features)], target.iloc[train_index])
            train_probability = pipeline.predict_proba(
                predictors.iloc[train_index][list(features)]
            )[:, 1]
            validation_probability = pipeline.predict_proba(
                predictors.iloc[validation_index][list(features)]
            )[:, 1]
            threshold = select_validation_threshold(
                target.iloc[validation_index].to_numpy(), validation_probability
            )
            model_results.append({
                "configuration": configuration,
                "feature_set": feature_name,
                "model": model_name,
                "training_metrics": _classification_metrics(
                    target.iloc[train_index].to_numpy(), train_probability, threshold["threshold"]
                ),
                "validation_metrics": _classification_metrics(
                    target.iloc[validation_index].to_numpy(), validation_probability, threshold["threshold"]
                ),
                "locked_test_metrics": None,
            })
            threshold_results.append({"configuration": configuration, **threshold})
            calibration_results.append({
                "configuration": configuration,
                "training": calibration_statistics(target.iloc[train_index].to_numpy(), train_probability),
                "validation": calibration_statistics(target.iloc[validation_index].to_numpy(), validation_probability),
                "locked_test": None,
            })
    return {
        "lasi_hypertension_training_manifest.json": {
            "target_name": TARGET_NAME,
            "target_policy": APPROVED_TARGET_POLICY,
            "approved_predictors": sorted(APPROVED_PRODUCTION_PREDICTORS),
            "feature_sets": list(FEATURE_SETS),
            "candidate_models": list(MODEL_NAMES),
            "participant_level_exported": False,
            "predictions_exported": False,
            "raw_bp_values_exported": False,
            "absolute_paths_exported": False,
            "model_files_exported": False,
            "locked_test_created": True,
            "locked_test_evaluated": False,
            "threshold_selection_partition": "validation",
            "random_seed": seed,
        },
        "lasi_hypertension_split_summary.json": split_summary(
            splitting_frame, target, splits, minimum
        ),
        "lasi_hypertension_feature_set_results.json": {"feature_sets": feature_results},
        "lasi_hypertension_candidate_model_results.json": {"configurations": model_results},
        "lasi_hypertension_threshold_selection.json": {"configurations": threshold_results},
        "lasi_hypertension_calibration_summary.json": {"configurations": calibration_results},
    }


def write_outputs(outputs: dict[str, Any], output_dir: Path) -> None:
    if set(outputs) != OUTPUT_FILENAMES:
        raise RuntimeError("Unexpected training output schema")
    output_dir.mkdir(parents=True, exist_ok=True)
    if any(output_dir.iterdir()):
        raise ValueError("Training output directory must be empty")
    for name in sorted(outputs):
        (output_dir / name).write_text(
            json.dumps(outputs[name], indent=2, sort_keys=True), encoding="utf-8"
        )


def execute(data_root: Path, output_dir: Path, minimum: int = 10) -> dict[str, Any]:
    validate_paths(data_root, output_dir)
    joined, _ = private_join(*read_sources(data_root))
    outputs = run_development(joined, minimum)
    write_outputs(outputs, output_dir)
    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--min-cell-count", type=int, default=10)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    execute(args.data_root, args.output_dir, args.min_cell_count)
    print("LASI hypertension development outputs created; locked test not evaluated.")


if __name__ == "__main__":
    main()
