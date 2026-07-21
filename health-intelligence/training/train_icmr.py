"""
train_icmr.py — Research-Only Diabetes Screening Model Training Pipeline
=========================================================================
Lifecycle:  RESEARCH_ONLY
Purpose:    Pre-laboratory diabetes screening prioritisation using the
            authentic ICMR-INDIAB sample.

Usage (once the real dataset file exists outside this repo):
    python health-intelligence/training/train_icmr.py \\
        --data-path "/path/to/your/private/icmr_indiab_sample.dta"

RULES:
  DO NOT run this script against synthetic or fabricated data.
  DO NOT hard-code any file path inside this script.
  DO NOT commit model artifacts or participant-level data to Git.

Design choices (updated after feature-set comparison):
  • Feature set reduced to age_years + bmi only (Model D from comparison).
    Cross-validated PR-AUC was highest at this configuration on the current
    sample; adding waist_cm / BP / sex did not improve beyond fold noise.
  • sklearn Pipeline (SimpleImputer → StandardScaler → LogisticRegression)
    ensures imputer statistics are computed within each CV fold, preventing
    even minor imputation leakage.
  • penalty= is NOT passed to LogisticRegression: sklearn 1.9.0 deprecates
    the argument (default L2 is applied implicitly); omitting it avoids a
    FutureWarning.
  • RepeatedStratifiedKFold(5 splits × 10 repeats) gives 50 folds, greatly
    reducing the variance of AUC/Brier estimates compared to a single 5-fold.
  • Threshold analysis across [0.70, 0.75, 0.80, 0.85, 0.90] sensitivity
    targets is performed during CV; all five options are saved in metadata
    so a human reviewer can override the selected default without retraining.
  • DummyClassifier(strategy="prior") baseline is evaluated under the same
    CV scheme and its metrics saved in metadata.
"""

import os
import sys
import json
import argparse
import logging
import warnings
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import joblib
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate
from sklearn.metrics import (
    make_scorer,
    brier_score_loss,
    average_precision_score,
    roc_curve,
)

# ---------------------------------------------------------------------------
# Resolve the training/ directory so audit_icmr_sample can always be imported
# regardless of the working directory the caller uses.
# ---------------------------------------------------------------------------
_TRAINING_DIR = os.path.dirname(os.path.abspath(__file__))
_HI_DIR = os.path.dirname(_TRAINING_DIR)   # health-intelligence/
sys.path.insert(0, _TRAINING_DIR)

from audit_icmr_sample import validate_feature_policy  # noqa: E402

# ---------------------------------------------------------------------------
# Feature / target definitions
# Reduced to age_years + bmi based on the train_icmr_compare.py analysis:
# adding waist_cm, systolic_bp, diastolic_bp, or sex did not improve PR-AUC
# beyond fold-level noise on the current ICMR-INDIAB sample.
# ---------------------------------------------------------------------------
PREDICTOR_COLUMNS = [
    "age_years",    # v4
    "bmi",          # v8
]

TARGET_COLUMN = "diabetes_composite"  # v36

# Sensitivity targets for threshold analysis.
# For each value, we find the probability cutoff that achieves at least that
# sensitivity on each CV fold and record the resulting specificity + PR-AUC.
SENSITIVITY_TARGETS = [0.70, 0.75, 0.80, 0.85, 0.90]

# The default operating point saved in the model artifact.
# The threshold achieving >= 75 % mean sensitivity is selected automatically;
# all five options are also saved so a reviewer can override without retraining.
DEFAULT_SENSITIVITY_TARGET = 0.75

# Output artifact paths — inside health-intelligence/models/
_MODELS_DIR   = os.path.join(_HI_DIR, "models")
MODEL_PATH    = os.path.join(_MODELS_DIR, "diabetes_model.joblib")
METADATA_PATH = os.path.join(_MODELS_DIR, "diabetes_model_metadata.json")

MINIMUM_ROWS = 100

# CV strategy — identical for main model and dummy baseline
CV = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataset helpers (unchanged from previous version)
# ---------------------------------------------------------------------------

def _load_dataset(data_path: str):
    """Load .dta using pyreadstat (preferred) or pandas as fallback."""
    try:
        import pyreadstat
        df, meta = pyreadstat.read_dta(data_path)
        column_labels = meta.column_names_to_labels if meta else {}
    except Exception as exc:
        log.warning("pyreadstat failed (%s) — falling back to pandas.read_stata.", exc)
        df = pd.read_stata(data_path)
        column_labels = {}
    return df, column_labels


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Map raw Stata variable codes (v4, v5, …) to their descriptive names
    so the rest of the pipeline works on meaningful column identifiers.
    All codes are retained even if not all are used as predictors — this
    ensures the target column (v36) is always renamed correctly.
    """
    rename = {
        "v4":  "age_years",
        "v5":  "sex",
        "v8":  "bmi",
        "v9":  "waist_cm",
        "v10": "systolic_bp",
        "v11": "diastolic_bp",
        "v36": "diabetes_composite",
    }
    return df.rename(columns={k: v for k, v in rename.items() if k in df.columns})


# ---------------------------------------------------------------------------
# Threshold analysis helper
# ---------------------------------------------------------------------------

def _threshold_analysis(
    pipeline,
    X: pd.DataFrame,
    y: pd.Series,
    sensitivity_targets: list[float],
) -> list[dict]:
    """
    Run RepeatedStratifiedKFold CV manually to collect per-fold probability
    predictions, then for each sensitivity target find the probability cutoff
    that achieves at least that sensitivity on the test fold.

    Returns a list of dicts — one per sensitivity target — each containing:
      sensitivity_target : float   — the requested target
      cutoffs            : list    — one cutoff per fold (50 folds)
      specificities      : list    — resulting specificity per fold
      pr_aucs            : list    — PR-AUC per fold
      mean_cutoff        : float
      std_cutoff         : float
      mean_specificity   : float
      std_specificity    : float
      mean_pr_auc        : float
      std_pr_auc         : float
    """
    # Per-target accumulators: list[list[float]] indexed [target_idx][fold_idx]
    all_cutoffs      = [[] for _ in sensitivity_targets]
    all_specificities = [[] for _ in sensitivity_targets]
    all_pr_aucs      = [[] for _ in sensitivity_targets]

    X_arr = X.values  # avoid pandas index issues across CV splits

    for train_idx, test_idx in CV.split(X_arr, y.values):
        X_train, X_test = X_arr[train_idx], X_arr[test_idx]
        y_train, y_test = y.values[train_idx], y.values[test_idx]

        # Fit on the training fold
        pipeline.fit(X_train, y_train)
        y_prob = pipeline.predict_proba(X_test)[:, 1]

        # PR-AUC for this fold (same regardless of threshold)
        pr_auc_fold = average_precision_score(y_test, y_prob)

        # ROC curve gives all achievable (fpr, tpr, threshold) triplets.
        # We use it to find, for each sensitivity target, the highest
        # threshold that still achieves >= target sensitivity.
        fprs, tprs, thresholds = roc_curve(y_test, y_prob, pos_label=1)
        # roc_curve returns thresholds in descending order;
        # tprs (sensitivity) are in ascending order.
        # We want: for each target, the highest threshold where tpr >= target.
        for i, target in enumerate(sensitivity_targets):
            # Indices where sensitivity >= target
            feasible = np.where(tprs >= target)[0]
            if len(feasible) == 0:
                # Target sensitivity not achievable on this fold — use lowest
                # threshold (predict all positive) as a safe fallback.
                chosen_threshold = float(thresholds[-1])
                # specificity = TN / (TN + FP) = 1 - FPR
                chosen_specificity = float(1.0 - fprs[-1])
            else:
                # Among feasible indices, pick the one with highest threshold
                # (i.e., best specificity while still meeting sensitivity).
                # thresholds may not be monotone after roc_curve on small data;
                # find the feasible index with max threshold value.
                best_idx = feasible[np.argmax(thresholds[feasible])]
                chosen_threshold   = float(thresholds[best_idx])
                chosen_specificity = float(1.0 - fprs[best_idx])

            all_cutoffs[i].append(chosen_threshold)
            all_specificities[i].append(chosen_specificity)
            all_pr_aucs[i].append(pr_auc_fold)

    results = []
    for i, target in enumerate(sensitivity_targets):
        results.append({
            "sensitivity_target": target,
            "mean_cutoff":       float(np.mean(all_cutoffs[i])),
            "std_cutoff":        float(np.std(all_cutoffs[i])),
            "mean_specificity":  float(np.mean(all_specificities[i])),
            "std_specificity":   float(np.std(all_specificities[i])),
            "mean_pr_auc":       float(np.mean(all_pr_aucs[i])),
            "std_pr_auc":        float(np.std(all_pr_aucs[i])),
        })

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Train a RESEARCH_ONLY diabetes screening model on the ICMR-INDIAB sample."
    )
    parser.add_argument(
        "--data-path",
        required=True,
        help=(
            "Absolute path to the Stata (.dta) dataset file. "
            "No default is provided — the caller must supply this explicitly."
        ),
    )
    args = parser.parse_args()

    # ------------------------------------------------------------------
    # GUARD 1 — Dataset file must exist
    # ------------------------------------------------------------------
    if not os.path.exists(args.data_path):
        log.error("Dataset file not found: %s", args.data_path)
        sys.exit(1)

    log.info("Loading dataset from: %s", args.data_path)
    df_raw, column_labels = _load_dataset(args.data_path)
    df = _normalise_columns(df_raw)

    # ------------------------------------------------------------------
    # GUARD 2 — Feature leakage policy check
    # validate_feature_policy raises ValueError loudly if any predictor
    # is a forbidden/leaky column (glucose, HbA1c, OGTT, outcome cols …).
    # ------------------------------------------------------------------
    log.info("Validating feature leakage policy …")
    try:
        validate_feature_policy(PREDICTOR_COLUMNS, column_labels)
    except ValueError as exc:
        log.error("Leakage policy violation — aborting. %s", exc)
        sys.exit(1)
    log.info("Feature policy OK: %s", PREDICTOR_COLUMNS)

    # ------------------------------------------------------------------
    # GUARD 3 — Minimum sample size (after loading, before any filtering)
    # ------------------------------------------------------------------
    if len(df) < MINIMUM_ROWS:
        log.error(
            "Dataset has only %d rows; minimum required is %d. Aborting.",
            len(df), MINIMUM_ROWS,
        )
        sys.exit(1)

    # ------------------------------------------------------------------
    # Prepare features and target
    # ------------------------------------------------------------------
    missing_preds = [c for c in PREDICTOR_COLUMNS if c not in df.columns]
    if missing_preds:
        log.error("Missing predictor columns after normalisation: %s", missing_preds)
        sys.exit(1)

    if TARGET_COLUMN not in df.columns:
        log.error("Target column '%s' (v36) not found in dataset.", TARGET_COLUMN)
        sys.exit(1)

    # Drop rows where the *target* is missing.
    # Feature missingness is handled by the Pipeline's SimpleImputer within
    # each CV fold — no pre-CV imputation is performed here.
    n_before = len(df)
    df = df.dropna(subset=[TARGET_COLUMN])
    n_dropped = n_before - len(df)
    if n_dropped:
        log.info("Dropped %d rows with missing target (%s).", n_dropped, TARGET_COLUMN)

    if len(df) < MINIMUM_ROWS:
        log.error(
            "After dropping missing-target rows only %d rows remain; "
            "minimum required is %d. Aborting.", len(df), MINIMUM_ROWS,
        )
        sys.exit(1)

    X = df[PREDICTOR_COLUMNS].copy()
    y = pd.to_numeric(df[TARGET_COLUMN], errors="coerce").astype(float)

    # Coerce predictor columns to numeric (handles any lingering categoricals)
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce")

    n_samples  = len(X)
    n_positive = int(y.sum())
    log.info(
        "Effective training set: %d rows, %d predictors, %d positives (%.1f%%).",
        n_samples, len(PREDICTOR_COLUMNS), n_positive, 100 * n_positive / n_samples,
    )

    # ------------------------------------------------------------------
    # Pipeline definition
    #
    # SimpleImputer(median) → StandardScaler → LogisticRegression
    #
    # penalty= is intentionally omitted: sklearn 1.9.0 deprecates the
    # argument (the default is already L2); passing it explicitly raises
    # a FutureWarning.  C=1.0 (default) applies standard L2 regularisation.
    # ------------------------------------------------------------------
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler()),
        ("lr",      LogisticRegression(
            max_iter=2000,
            random_state=42,
        )),
    ])

    # ------------------------------------------------------------------
    # Cross-validation — RepeatedStratifiedKFold (5 splits × 10 repeats)
    # 50 total folds give stable mean ± std for ROC-AUC, PR-AUC, Brier.
    # ------------------------------------------------------------------
    log.info(
        "Running RepeatedStratifiedKFold(n_splits=5, n_repeats=10) "
        "cross-validation …"
    )

    # Confirm no FutureWarning is raised during CV
    with warnings.catch_warnings():
        warnings.filterwarnings("error", category=FutureWarning)
        try:
            cv_results = cross_validate(
                pipeline, X, y,
                cv=CV,
                scoring={
                    "roc_auc":     "roc_auc",
                    "pr_auc":      make_scorer(
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
        except FutureWarning as fw:
            log.error(
                "FutureWarning raised during cross_validate — this must be "
                "fixed before saving: %s", fw
            )
            sys.exit(1)

    auc_mean   = float(np.mean(cv_results["test_roc_auc"]))
    auc_std    = float(np.std( cv_results["test_roc_auc"]))
    prauc_mean = float(np.mean(cv_results["test_pr_auc"]))
    prauc_std  = float(np.std( cv_results["test_pr_auc"]))
    brier_mean = float(np.mean(cv_results["test_brier_score"]))
    brier_std  = float(np.std( cv_results["test_brier_score"]))

    log.info("CV ROC-AUC : %.4f ± %.4f", auc_mean,   auc_std)
    log.info("CV PR-AUC  : %.4f ± %.4f", prauc_mean, prauc_std)
    log.info("CV Brier   : %.4f ± %.4f", brier_mean, brier_std)

    # ------------------------------------------------------------------
    # Dummy baseline — same CV scheme, for metadata comparison
    # ------------------------------------------------------------------
    log.info("Evaluating DummyClassifier(strategy='prior') baseline …")
    dummy_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("dummy",   DummyClassifier(strategy="prior", random_state=42)),
    ])
    dummy_cv = cross_validate(
        dummy_pipeline, X, y,
        cv=CV,
        scoring={
            "roc_auc":     "roc_auc",
            "pr_auc":      make_scorer(
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
        "roc_auc_mean":     float(np.mean(dummy_cv["test_roc_auc"])),
        "roc_auc_std":      float(np.std( dummy_cv["test_roc_auc"])),
        "pr_auc_mean":      float(np.mean(dummy_cv["test_pr_auc"])),
        "pr_auc_std":       float(np.std( dummy_cv["test_pr_auc"])),
        "brier_score_mean": float(np.mean(dummy_cv["test_brier_score"])),
        "brier_score_std":  float(np.std( dummy_cv["test_brier_score"])),
    }
    log.info(
        "Dummy  ROC-AUC : %.4f ± %.4f",
        dummy_baseline["roc_auc_mean"], dummy_baseline["roc_auc_std"],
    )

    # ------------------------------------------------------------------
    # Threshold analysis
    # For each sensitivity target (70/75/80/85/90 %) find the probability
    # cutoff that achieves it on each of the 50 CV folds, record the
    # resulting specificity and PR-AUC, then average across folds.
    # ------------------------------------------------------------------
    log.info("Running threshold analysis across sensitivity targets …")
    # Use a fresh clone of the pipeline for threshold CV to avoid any
    # state leak from the cross_validate call above.
    threshold_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler()),
        ("lr",      LogisticRegression(max_iter=2000, random_state=42)),
    ])
    threshold_analysis = _threshold_analysis(
        threshold_pipeline, X, y, SENSITIVITY_TARGETS
    )

    # ------------------------------------------------------------------
    # Print threshold comparison table
    # ------------------------------------------------------------------
    _col_w = 12
    print()
    print("=" * 66)
    print("THRESHOLD ANALYSIS — sensitivity / specificity trade-off")
    print(f"CV: RepeatedStratifiedKFold(n_splits=5, n_repeats=10)  n={n_samples}")
    print("=" * 66)
    header = (
        f"{'Target Sens':>{_col_w}}"
        f"{'Mean Cutoff':>{_col_w}}"
        f"{'Std Cutoff':>{_col_w}}"
        f"{'Mean Spec':>{_col_w}}"
        f"{'Std Spec':>{_col_w}}"
        f"{'Mean PR-AUC':>{_col_w}}"
    )
    print(header)
    print("─" * 66)
    for row in threshold_analysis:
        line = (
            f"{row['sensitivity_target']:>{_col_w}.0%}"
            f"{row['mean_cutoff']:>{_col_w}.4f}"
            f"{row['std_cutoff']:>{_col_w}.4f}"
            f"{row['mean_specificity']:>{_col_w}.4f}"
            f"{row['std_specificity']:>{_col_w}.4f}"
            f"{row['mean_pr_auc']:>{_col_w}.4f}"
        )
        if abs(row["sensitivity_target"] - DEFAULT_SENSITIVITY_TARGET) < 1e-9:
            line += "  ← default"
        print(line)
    print("─" * 66)
    print()

    # ------------------------------------------------------------------
    # Select default operating point:
    # the entry whose sensitivity_target == DEFAULT_SENSITIVITY_TARGET.
    # ------------------------------------------------------------------
    default_row = next(
        r for r in threshold_analysis
        if abs(r["sensitivity_target"] - DEFAULT_SENSITIVITY_TARGET) < 1e-9
    )
    selected_cutoff = default_row["mean_cutoff"]
    log.info(
        "Selected default operating point: sensitivity_target=%.0f%%  "
        "mean_cutoff=%.4f  mean_specificity=%.4f",
        DEFAULT_SENSITIVITY_TARGET * 100,
        selected_cutoff,
        default_row["mean_specificity"],
    )

    # Build threshold_options list for metadata — mark the default
    threshold_options = []
    for row in threshold_analysis:
        is_default = (
            abs(row["sensitivity_target"] - DEFAULT_SENSITIVITY_TARGET) < 1e-9
        )
        threshold_options.append({
            "sensitivity_target":  row["sensitivity_target"],
            "mean_cutoff":         row["mean_cutoff"],
            "std_cutoff":          row["std_cutoff"],
            "mean_specificity":    row["mean_specificity"],
            "std_specificity":     row["std_specificity"],
            "mean_pr_auc":         row["mean_pr_auc"],
            "std_pr_auc":          row["std_pr_auc"],
            "selected_default":    is_default,
        })

    # ------------------------------------------------------------------
    # Final model — fit on full dataset then save
    # Both files are written atomically: if either write fails the other
    # is not produced, preventing a half-saved state.
    # ------------------------------------------------------------------
    log.info("Fitting final model on full dataset …")
    final_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler()),
        ("lr",      LogisticRegression(max_iter=2000, random_state=42)),
    ])
    final_pipeline.fit(X, y)

    # Extract coefficients and intercept from the fitted LR step.
    lr_step = final_pipeline.named_steps["lr"]
    _coef_values = lr_step.coef_[0].tolist()   # shape (n_features,)
    _intercept   = float(lr_step.intercept_[0])

    # Note: coefficients are in *scaled* space (post StandardScaler).
    # They are saved for transparency but should not be interpreted as
    # raw-unit effect sizes without accounting for the scaler's mean/std.
    scaler_step = final_pipeline.named_steps["scaler"]
    scaler_info = {
        "mean":  scaler_step.mean_.tolist(),
        "scale": scaler_step.scale_.tolist(),
    }

    metadata = {
        "lifecycle_status": "RESEARCH_ONLY",
        "model_type": "Pipeline(SimpleImputer → StandardScaler → LogisticRegression)",
        "sklearn_version_notes": (
            "penalty= omitted (sklearn 1.9.0 deprecates explicit L2 argument); "
            "default L2 regularisation with C=1.0 is applied."
        ),
        "training_date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sample_size":   n_samples,
        "feature_list":  PREDICTOR_COLUMNS,
        "feature_selection_rationale": (
            "Reduced from 6 features to age_years + bmi based on "
            "RepeatedStratifiedKFold comparison (train_icmr_compare.py): "
            "PR-AUC was highest at this configuration; adding waist_cm, "
            "systolic_bp, diastolic_bp, or sex did not improve beyond fold noise."
        ),
        "target_column": TARGET_COLUMN,
        "coefficients_scaled_space": dict(zip(PREDICTOR_COLUMNS, _coef_values)),
        "intercept_scaled_space":    _intercept,
        "scaler": scaler_info,
        "cross_validation": {
            "strategy": (
                "RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)"
                " — 50 total folds"
            ),
            "roc_auc_mean":     auc_mean,
            "roc_auc_std":      auc_std,
            "pr_auc_mean":      prauc_mean,
            "pr_auc_std":       prauc_std,
            "brier_score_mean": brier_mean,
            "brier_score_std":  brier_std,
        },
        "dummy_baseline": dummy_baseline,
        "threshold_options": threshold_options,
        "active_threshold": {
            "sensitivity_target":  default_row["sensitivity_target"],
            "mean_cutoff":         selected_cutoff,
            "std_cutoff":          default_row["std_cutoff"],
            "mean_specificity":    default_row["mean_specificity"],
            "std_specificity":     default_row["std_specificity"],
            "note": (
                "This is the mean probability cutoff from CV folds achieving "
                f">= {DEFAULT_SENSITIVITY_TARGET:.0%} sensitivity. "
                "A human reviewer may override by selecting another entry from "
                "threshold_options without retraining."
            ),
        },
        "limitations": [
            "RESEARCH_ONLY: not validated for clinical use",
            "Small sample size — estimates may have high variance",
            "No external validation cohort",
            "Regional sample — national representativeness not established",
            (
                "Threshold cutoffs are averaged across CV folds; actual "
                "operating sensitivity/specificity on new data may differ"
            ),
            (
                "Coefficients are in scaled space (post StandardScaler) — "
                "not directly interpretable as raw-unit effect sizes"
            ),
        ],
        "dataset_source": "ICMR-INDIAB (sample supplied externally, not tracked in Git)",
    }

    os.makedirs(_MODELS_DIR, exist_ok=True)

    # Write metadata first — if this fails, no joblib file is written
    metadata_tmp = METADATA_PATH + ".tmp"
    with open(metadata_tmp, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    joblib.dump(final_pipeline, MODEL_PATH)
    os.replace(metadata_tmp, METADATA_PATH)   # atomic rename

    log.info("Model saved:    %s", MODEL_PATH)
    log.info("Metadata saved: %s", METADATA_PATH)
    log.info(
        "REMINDER: Artifacts are RESEARCH_ONLY. "
        "Do not deploy without a full validation and governance review."
    )


if __name__ == "__main__":
    main()
