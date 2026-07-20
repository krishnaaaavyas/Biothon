"""
train_icmr_hypertension.py — Research-Only Hypertension Training Pipeline
=========================================================================
Lifecycle:  RESEARCH_ONLY
Purpose:    Pre-laboratory hypertension screening prioritisation using the
            authentic ICMR-INDIAB sample.

Usage (once the real dataset file exists outside this repo):
    python health-intelligence/training/train_icmr_hypertension.py \
        --data-path "/path/to/your/private/icmr_indiab_sample.dta"

RULES:
  DO NOT run this script against synthetic or fabricated data.
  DO NOT hard-code any dataset path inside this script.
  DO NOT commit model artifacts or participant-level data to Git.
  This script writes only hypertension_model.* artifacts and never touches
  diabetes_model.joblib or diabetes_model_metadata.json.

Design choices:
  • Feature set is age_years + bmi (Model E from the comparison). Adding
    waist_cm, sex, or occupation showed no gain beyond fold-level noise.
  • Pipeline imputation and scaling occur inside every CV fold.
  • RepeatedStratifiedKFold(5 splits × 10 repeats) provides 50 folds.
  • Five sensitivity operating points are retained in metadata so the
    selected default can be reviewed without retraining.
"""

import argparse
import json
import logging
import os
import sys
import warnings
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    make_scorer,
    roc_curve,
)
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


_TRAINING_DIR = os.path.dirname(os.path.abspath(__file__))
_HI_DIR = os.path.dirname(_TRAINING_DIR)
sys.path.insert(0, _TRAINING_DIR)

from audit_icmr_sample import validate_feature_policy_hypertension  # noqa: E402


PREDICTOR_COLUMNS = [
    "age_years",  # v4
    "bmi",        # v8
]
TARGET_COLUMN = "hypertension_composite"  # v38

SENSITIVITY_TARGETS = [0.70, 0.75, 0.80, 0.85, 0.90]
DEFAULT_SENSITIVITY_TARGET = 0.75

_MODELS_DIR = os.path.join(_HI_DIR, "models")
MODEL_PATH = os.path.join(_MODELS_DIR, "hypertension_model.joblib")
METADATA_PATH = os.path.join(
    _MODELS_DIR, "hypertension_model_metadata.json"
)

MINIMUM_ROWS = 100
CV = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


def _load_dataset(data_path: str):
    """Load .dta using pyreadstat (preferred) or pandas as fallback."""
    try:
        import pyreadstat

        df, meta = pyreadstat.read_dta(data_path)
        column_labels = meta.column_names_to_labels if meta else {}
    except Exception as exc:
        log.warning(
            "pyreadstat failed (%s) — falling back to pandas.read_stata.", exc
        )
        df = pd.read_stata(data_path)
        column_labels = {}
    return df, column_labels


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Map raw Stata codes to descriptive training column names."""
    rename = {
        "v4": "age_years",
        "v8": "bmi",
        "v38": "hypertension_composite",
    }
    return df.rename(columns={
        code: name for code, name in rename.items() if code in df.columns
    })


def _build_pipeline() -> Pipeline:
    """Create a fresh fold-safe hypertension model pipeline."""
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        (
            "lr",
            LogisticRegression(max_iter=2000, random_state=42),
        ),
    ])


def _threshold_analysis(
    pipeline,
    X: pd.DataFrame,
    y: pd.Series,
    sensitivity_targets: list[float],
) -> list[dict]:
    """Calculate per-target cutoff and specificity across identical CV folds."""
    all_cutoffs = [[] for _ in sensitivity_targets]
    all_specificities = [[] for _ in sensitivity_targets]
    all_pr_aucs = [[] for _ in sensitivity_targets]

    X_array = X.values
    y_array = y.values
    for train_index, test_index in CV.split(X_array, y_array):
        X_train = X_array[train_index]
        X_test = X_array[test_index]
        y_train = y_array[train_index]
        y_test = y_array[test_index]

        pipeline.fit(X_train, y_train)
        probabilities = pipeline.predict_proba(X_test)[:, 1]
        fold_pr_auc = average_precision_score(y_test, probabilities)
        fprs, tprs, thresholds = roc_curve(
            y_test, probabilities, pos_label=1
        )

        for target_index, sensitivity_target in enumerate(sensitivity_targets):
            feasible = np.where(tprs >= sensitivity_target)[0]
            if len(feasible) == 0:
                chosen_threshold = float(thresholds[-1])
                chosen_specificity = float(1.0 - fprs[-1])
            else:
                best_index = feasible[np.argmax(thresholds[feasible])]
                chosen_threshold = float(thresholds[best_index])
                chosen_specificity = float(1.0 - fprs[best_index])

            all_cutoffs[target_index].append(chosen_threshold)
            all_specificities[target_index].append(chosen_specificity)
            all_pr_aucs[target_index].append(fold_pr_auc)

    analysis = []
    for target_index, sensitivity_target in enumerate(sensitivity_targets):
        analysis.append({
            "sensitivity_target": sensitivity_target,
            "mean_cutoff": float(np.mean(all_cutoffs[target_index])),
            "std_cutoff": float(np.std(all_cutoffs[target_index])),
            "mean_specificity": float(
                np.mean(all_specificities[target_index])
            ),
            "std_specificity": float(
                np.std(all_specificities[target_index])
            ),
            "mean_pr_auc": float(np.mean(all_pr_aucs[target_index])),
            "std_pr_auc": float(np.std(all_pr_aucs[target_index])),
        })
    return analysis


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Train a RESEARCH_ONLY hypertension screening model on an "
            "externally supplied ICMR-INDIAB sample."
        )
    )
    parser.add_argument(
        "--data-path",
        required=True,
        help=(
            "Absolute path to the Stata (.dta) dataset. "
            "No default is provided."
        ),
    )
    args = parser.parse_args()

    # Guard 1 — dataset file must exist.
    if not os.path.exists(args.data_path):
        log.error("Dataset file not found: %s", args.data_path)
        sys.exit(1)

    log.info("Loading dataset from: %s", args.data_path)
    dataframe_raw, column_labels = _load_dataset(args.data_path)
    dataframe = _normalise_columns(dataframe_raw)

    # Guard 2 — target-specific leakage policy before any model work.
    log.info("Validating hypertension feature leakage policy …")
    try:
        validate_feature_policy_hypertension(
            PREDICTOR_COLUMNS, column_labels
        )
    except ValueError as exc:
        log.error("Leakage policy violation — aborting. %s", exc)
        sys.exit(1)
    log.info("Feature policy OK: %s", PREDICTOR_COLUMNS)

    # Guard 3 — minimum raw sample size.
    if len(dataframe) < MINIMUM_ROWS:
        log.error(
            "Dataset has only %d rows; minimum required is %d. Aborting.",
            len(dataframe), MINIMUM_ROWS,
        )
        sys.exit(1)

    missing_predictors = [
        column for column in PREDICTOR_COLUMNS if column not in dataframe
    ]
    if missing_predictors:
        log.error(
            "Missing predictor columns after normalisation: %s",
            missing_predictors,
        )
        sys.exit(1)

    if TARGET_COLUMN not in dataframe:
        log.error("Target column '%s' (v38) not found.", TARGET_COLUMN)
        sys.exit(1)

    # Drop missing targets before any CV fold is constructed.
    rows_before = len(dataframe)
    dataframe = dataframe.dropna(subset=[TARGET_COLUMN])
    rows_dropped = rows_before - len(dataframe)
    if rows_dropped:
        log.info(
            "Dropped %d rows with missing target (%s).",
            rows_dropped, TARGET_COLUMN,
        )

    if len(dataframe) < MINIMUM_ROWS:
        log.error(
            "After dropping missing-target rows only %d rows remain; "
            "minimum required is %d. Aborting.",
            len(dataframe), MINIMUM_ROWS,
        )
        sys.exit(1)

    X = dataframe[PREDICTOR_COLUMNS].copy()
    y = pd.to_numeric(
        dataframe[TARGET_COLUMN], errors="coerce"
    ).astype(float)
    for column in X.columns:
        X[column] = pd.to_numeric(X[column], errors="coerce")

    sample_size = len(X)
    positive_cases = int(y.sum())
    log.info(
        "Effective training set: %d rows, %d predictors, %d positives (%.1f%%).",
        sample_size,
        len(PREDICTOR_COLUMNS),
        positive_cases,
        100 * positive_cases / sample_size,
    )

    # Main model cross-validation.
    log.info(
        "Running RepeatedStratifiedKFold(n_splits=5, n_repeats=10) "
        "cross-validation …"
    )
    with warnings.catch_warnings():
        warnings.filterwarnings("error", category=FutureWarning)
        try:
            cv_results = cross_validate(
                _build_pipeline(),
                X,
                y,
                cv=CV,
                scoring={
                    "roc_auc": "roc_auc",
                    "pr_auc": make_scorer(
                        average_precision_score,
                        response_method="predict_proba",
                    ),
                    "brier_score": make_scorer(
                        brier_score_loss,
                        response_method="predict_proba",
                        greater_is_better=False,
                    ),
                },
                return_train_score=False,
                n_jobs=-1,
            )
        except FutureWarning as warning:
            log.error(
                "FutureWarning raised during cross-validation — aborting: %s",
                warning,
            )
            sys.exit(1)

    roc_auc_mean = float(np.mean(cv_results["test_roc_auc"]))
    roc_auc_std = float(np.std(cv_results["test_roc_auc"]))
    pr_auc_mean = float(np.mean(cv_results["test_pr_auc"]))
    pr_auc_std = float(np.std(cv_results["test_pr_auc"]))
    brier_mean = float(np.mean(cv_results["test_brier_score"]))
    brier_std = float(np.std(cv_results["test_brier_score"]))

    log.info("CV ROC-AUC : %.4f ± %.4f", roc_auc_mean, roc_auc_std)
    log.info("CV PR-AUC  : %.4f ± %.4f", pr_auc_mean, pr_auc_std)
    log.info("CV Brier   : %.4f ± %.4f", brier_mean, brier_std)

    # Dummy baseline under the identical CV strategy.
    log.info("Evaluating DummyClassifier(strategy='prior') baseline …")
    dummy_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("dummy", DummyClassifier(strategy="prior", random_state=42)),
    ])
    dummy_cv = cross_validate(
        dummy_pipeline,
        X,
        y,
        cv=CV,
        scoring={
            "roc_auc": "roc_auc",
            "pr_auc": make_scorer(
                average_precision_score,
                response_method="predict_proba",
            ),
            "brier_score": make_scorer(
                brier_score_loss,
                response_method="predict_proba",
                greater_is_better=False,
            ),
        },
        return_train_score=False,
    )
    dummy_baseline = {
        "roc_auc_mean": float(np.mean(dummy_cv["test_roc_auc"])),
        "roc_auc_std": float(np.std(dummy_cv["test_roc_auc"])),
        "pr_auc_mean": float(np.mean(dummy_cv["test_pr_auc"])),
        "pr_auc_std": float(np.std(dummy_cv["test_pr_auc"])),
        "brier_score_mean": float(
            np.mean(dummy_cv["test_brier_score"])
        ),
        "brier_score_std": float(np.std(dummy_cv["test_brier_score"])),
    }

    # Threshold analysis uses a fresh pipeline and the same deterministic CV.
    log.info("Running threshold analysis across sensitivity targets …")
    threshold_analysis = _threshold_analysis(
        _build_pipeline(), X, y, SENSITIVITY_TARGETS
    )

    column_width = 12
    print()
    print("=" * 66)
    print("THRESHOLD ANALYSIS — sensitivity / specificity trade-off")
    print(
        "CV: RepeatedStratifiedKFold(n_splits=5, n_repeats=10)  "
        f"n={sample_size}"
    )
    print("=" * 66)
    print(
        f"{'Target Sens':>{column_width}}"
        f"{'Mean Cutoff':>{column_width}}"
        f"{'Std Cutoff':>{column_width}}"
        f"{'Mean Spec':>{column_width}}"
        f"{'Std Spec':>{column_width}}"
        f"{'Mean PR-AUC':>{column_width}}"
    )
    print("─" * 66)
    for row in threshold_analysis:
        line = (
            f"{row['sensitivity_target']:>{column_width}.0%}"
            f"{row['mean_cutoff']:>{column_width}.4f}"
            f"{row['std_cutoff']:>{column_width}.4f}"
            f"{row['mean_specificity']:>{column_width}.4f}"
            f"{row['std_specificity']:>{column_width}.4f}"
            f"{row['mean_pr_auc']:>{column_width}.4f}"
        )
        if abs(
            row["sensitivity_target"] - DEFAULT_SENSITIVITY_TARGET
        ) < 1e-9:
            line += "  ← default"
        print(line)
    print("─" * 66)
    print()

    default_row = next(
        row for row in threshold_analysis
        if abs(
            row["sensitivity_target"] - DEFAULT_SENSITIVITY_TARGET
        ) < 1e-9
    )

    threshold_options = []
    for row in threshold_analysis:
        selected_default = abs(
            row["sensitivity_target"] - DEFAULT_SENSITIVITY_TARGET
        ) < 1e-9
        threshold_options.append({
            "sensitivity_target": row["sensitivity_target"],
            "mean_cutoff": row["mean_cutoff"],
            "std_cutoff": row["std_cutoff"],
            "mean_specificity": row["mean_specificity"],
            "std_specificity": row["std_specificity"],
            "mean_pr_auc": row["mean_pr_auc"],
            "std_pr_auc": row["std_pr_auc"],
            "selected_default": selected_default,
        })

    # Fit only after every guard and comparison has completed successfully.
    log.info("Fitting final hypertension model on the full dataset …")
    final_pipeline = _build_pipeline()
    final_pipeline.fit(X, y)

    logistic_step = final_pipeline.named_steps["lr"]
    scaler_step = final_pipeline.named_steps["scaler"]
    metadata = {
        "lifecycle_status": "RESEARCH_ONLY",
        "model_type": (
            "Pipeline(SimpleImputer → StandardScaler → LogisticRegression)"
        ),
        "training_date": datetime.now(timezone.utc).isoformat().replace(
            "+00:00", "Z"
        ),
        "sample_size": sample_size,
        "feature_list": PREDICTOR_COLUMNS,
        "feature_selection_rationale": (
            "Model E selected by train_icmr_hypertension_compare.py: adding "
            "waist_cm, sex, or occupation showed no gain beyond fold noise."
        ),
        "target_column": TARGET_COLUMN,
        "coefficients_scaled_space": dict(zip(
            PREDICTOR_COLUMNS, logistic_step.coef_[0].tolist()
        )),
        "intercept_scaled_space": float(logistic_step.intercept_[0]),
        "scaler": {
            "mean": scaler_step.mean_.tolist(),
            "scale": scaler_step.scale_.tolist(),
        },
        "cross_validation": {
            "strategy": (
                "RepeatedStratifiedKFold(n_splits=5, n_repeats=10, "
                "random_state=42) — 50 total folds"
            ),
            "roc_auc_mean": roc_auc_mean,
            "roc_auc_std": roc_auc_std,
            "pr_auc_mean": pr_auc_mean,
            "pr_auc_std": pr_auc_std,
            "brier_score_mean": brier_mean,
            "brier_score_std": brier_std,
        },
        "dummy_baseline": dummy_baseline,
        "threshold_options": threshold_options,
        "active_threshold": {
            "sensitivity_target": default_row["sensitivity_target"],
            "mean_cutoff": default_row["mean_cutoff"],
            "std_cutoff": default_row["std_cutoff"],
            "mean_specificity": default_row["mean_specificity"],
            "std_specificity": default_row["std_specificity"],
            "mean_pr_auc": default_row["mean_pr_auc"],
            "std_pr_auc": default_row["std_pr_auc"],
            "selected_default": True,
        },
        "limitations": [
            "RESEARCH_ONLY: not validated for clinical use",
            "Small sample size — estimates may have high variance",
            "No external validation cohort",
            "Regional sample — national representativeness not established",
            (
                "Threshold cutoffs are averaged across CV folds; actual "
                "performance on new data may differ"
            ),
        ],
        "dataset_source": (
            "ICMR-INDIAB (sample supplied externally, not tracked in Git)"
        ),
    }

    # Write both temporary files before replacing either final artifact.
    os.makedirs(_MODELS_DIR, exist_ok=True)
    model_temporary = MODEL_PATH + ".tmp"
    metadata_temporary = METADATA_PATH + ".tmp"
    try:
        joblib.dump(final_pipeline, model_temporary)
        with open(metadata_temporary, "w", encoding="utf-8") as metadata_file:
            json.dump(metadata, metadata_file, indent=2)
        os.replace(model_temporary, MODEL_PATH)
        os.replace(metadata_temporary, METADATA_PATH)
    except Exception:
        for temporary_path in (model_temporary, metadata_temporary):
            if os.path.exists(temporary_path):
                os.remove(temporary_path)
        raise

    log.info("Hypertension model saved:    %s", MODEL_PATH)
    log.info("Hypertension metadata saved: %s", METADATA_PATH)
    log.info(
        "REMINDER: Artifacts are RESEARCH_ONLY. Do not deploy without "
        "validation and governance review."
    )


if __name__ == "__main__":
    main()
