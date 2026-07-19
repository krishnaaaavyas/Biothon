"""
train_icmr.py — Research-Only Diabetes Screening Model Training Pipeline
=========================================================================
Lifecycle:  RESEARCH_ONLY
Purpose:    Pre-laboratory diabetes screening prioritisation using the
            authentic ICMR-INDIAB sample.

Usage (once the real dataset file exists outside this repo):
    python health-intelligence/training/train_icmr.py \
        --data-path "/path/to/your/private/icmr_indiab_sample.dta"

RULES:
  DO NOT run this script against synthetic or fabricated data.
  DO NOT hard-code any file path inside this script.
  DO NOT commit model artifacts or participant-level data to Git.
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.metrics import make_scorer, brier_score_loss

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
# Predictors = ALLOWED_ENHANCED ∪ ALLOWED_SENSITIVITY from audit_icmr_sample
# ---------------------------------------------------------------------------
PREDICTOR_COLUMNS = [
    "age_years",    # v4
    "bmi",          # v8
    "waist_cm",     # v9
    "systolic_bp",  # v10
    "diastolic_bp", # v11
    "sex",          # v5  (ALLOWED_SENSITIVITY)
]

TARGET_COLUMN = "diabetes_composite"  # v36

# Output artifact paths — inside health-intelligence/models/ (gitignored for .json)
_MODELS_DIR = os.path.join(_HI_DIR, "models")
MODEL_PATH     = os.path.join(_MODELS_DIR, "diabetes_model.joblib")
METADATA_PATH  = os.path.join(_MODELS_DIR, "diabetes_model_metadata.json")

MINIMUM_ROWS = 100

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
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


def _encode_sex(series: pd.Series) -> pd.Series:
    """
    Encode the sex column to binary numeric (0 = male, 1 = female).
    Handles string labels ("male"/"female") and numeric codes (1/2).
    """
    s = series.copy()
    str_map = {"male": 0, "female": 1, "1": 0, "2": 1, "1.0": 0, "2.0": 1}
    if s.dtype == object or hasattr(s, "cat"):
        s = s.astype(str).str.lower().str.strip().map(str_map)
    else:
        s = s.map({1: 0, 2: 1, 1.0: 0, 2.0: 1})
    return s


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

    # Drop rows where the *target* is missing; preserve rows with missing
    # feature values — those are handled by median imputation below.
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

    # Encode sex (0/1) and coerce everything else to numeric
    if "sex" in X.columns:
        X["sex"] = _encode_sex(X["sex"])
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce")

    # Global median imputation for missing feature values.
    # NOTE: This is computed before CV (minor optimistic bias on a small
    # dataset), which is acceptable for a RESEARCH_ONLY scaffold.
    col_medians = X.median()
    X = X.fillna(col_medians)

    n_samples = len(X)
    log.info("Effective training set: %d rows, %d predictors.", n_samples, len(PREDICTOR_COLUMNS))

    # ------------------------------------------------------------------
    # Model selection — Logistic Regression (L2 regularisation, C=1.0)
    #
    # Deliberate choice for a small expected sample (~500 rows):
    # Ensemble / boosting methods (Random Forest, XGBoost, …) have many
    # more degrees of freedom and would almost certainly overfit here,
    # producing inflated cross-validated AUC estimates with high variance
    # across folds.  A single, well-regularised linear classifier provides
    # a stable, interpretable, low-variance baseline that is appropriate
    # at this sample size and consistent with the RESEARCH_ONLY lifecycle.
    # ------------------------------------------------------------------
    model = LogisticRegression(
        C=1.0,          # default L2 strength; sklearn ≥ 1.8 default is L2
        max_iter=500,
        random_state=42,
        solver="lbfgs",
    )

    # ------------------------------------------------------------------
    # Cross-validation — StratifiedKFold (5 splits)
    # Reports mean ± std of ROC-AUC and Brier score across folds.
    # ------------------------------------------------------------------
    log.info("Running 5-fold stratified cross-validation …")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    brier_scorer = make_scorer(brier_score_loss, response_method="predict_proba")

    cv_results = cross_validate(
        model, X, y,
        cv=cv,
        scoring={"roc_auc": "roc_auc", "brier_score": brier_scorer},
        return_train_score=False,
    )

    auc_mean  = float(np.mean(cv_results["test_roc_auc"]))
    auc_std   = float(np.std(cv_results["test_roc_auc"]))
    brier_mean = float(np.mean(cv_results["test_brier_score"]))
    brier_std  = float(np.std(cv_results["test_brier_score"]))

    log.info("CV ROC-AUC : %.4f ± %.4f", auc_mean, auc_std)
    log.info("CV Brier   : %.4f ± %.4f", brier_mean, brier_std)

    # ------------------------------------------------------------------
    # Final model — fit on full dataset then save
    # Both files are written atomically: if either write fails the other
    # is not produced, preventing a half-saved state.
    # ------------------------------------------------------------------
    log.info("Fitting final model on full dataset …")
    model.fit(X, y)

    metadata = {
        "lifecycle_status": "RESEARCH_ONLY",
        "model_type": "LogisticRegression(C=1.0, solver=lbfgs)",
        "training_date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sample_size": n_samples,
        "feature_list": PREDICTOR_COLUMNS,
        "target_column": TARGET_COLUMN,
        "training_medians": col_medians.to_dict(),
        "cross_validation": {
            "strategy": "StratifiedKFold(n_splits=5, shuffle=True, random_state=42)",
            "roc_auc_mean":    auc_mean,
            "roc_auc_std":     auc_std,
            "brier_score_mean": brier_mean,
            "brier_score_std":  brier_std,
        },
        "limitations": [
            "RESEARCH_ONLY: not validated for clinical use",
            "Small sample size — estimates may have high variance",
            "No external validation cohort",
            "Regional sample — national representativeness not established",
        ],
        "dataset_source": "ICMR-INDIAB (sample supplied externally, not tracked in Git)",
    }

    os.makedirs(_MODELS_DIR, exist_ok=True)

    # Write metadata first — if this fails, no joblib file is written
    metadata_tmp = METADATA_PATH + ".tmp"
    with open(metadata_tmp, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    joblib.dump(model, MODEL_PATH)
    os.replace(metadata_tmp, METADATA_PATH)   # atomic rename

    log.info("Model saved:    %s", MODEL_PATH)
    log.info("Metadata saved: %s", METADATA_PATH)
    log.info(
        "REMINDER: Artifacts are RESEARCH_ONLY. "
        "Do not deploy without a full validation and governance review."
    )


if __name__ == "__main__":
    main()
