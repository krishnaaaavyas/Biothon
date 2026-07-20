"""
train_icmr_compare.py — Feature-Set Comparison Pipeline (Research-Only)
=========================================================================
Lifecycle:  RESEARCH_ONLY — comparison artifacts only
Purpose:    Compare three feature configurations and a dummy baseline to
            inform which predictor set to use in the next training run.
            This script does NOT save or replace any production model artifact.

Usage (run manually once the real dataset file is available):
    python health-intelligence/training/train_icmr_compare.py \\
        --data-path "/path/to/your/private/icmr_indiab_sample.dta"

    Optional:
        --output-json  /path/to/save/comparison_report.json
        --threshold    0.5   (decision threshold for sensitivity/specificity;
                             default 0.5)

RULES:
  DO NOT run this script against synthetic or fabricated data.
  DO NOT hard-code any file path inside this script.
  DO NOT commit model artifacts or participant-level data to Git.
  This script NEVER writes to diabetes_model.joblib or diabetes_model_metadata.json.
"""

import os
import sys
import json
import argparse
import logging
import textwrap
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate
from sklearn.metrics import (
    make_scorer,
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
)

# ---------------------------------------------------------------------------
# Resolve training/ directory so audit_icmr_sample can be imported regardless
# of the caller's working directory.
# ---------------------------------------------------------------------------
_TRAINING_DIR = os.path.dirname(os.path.abspath(__file__))
_HI_DIR       = os.path.dirname(_TRAINING_DIR)   # health-intelligence/
sys.path.insert(0, _TRAINING_DIR)

from audit_icmr_sample import validate_feature_policy  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants shared with train_icmr.py — must stay in sync
# ---------------------------------------------------------------------------
TARGET_COLUMN = "diabetes_composite"  # v36
MINIMUM_ROWS  = 100

# Decision threshold used for sensitivity / specificity calculation
DEFAULT_THRESHOLD = 0.5

# ---------------------------------------------------------------------------
# Feature configurations under comparison
# ---------------------------------------------------------------------------
MODEL_CONFIGS: list[dict] = [
    {
        "label": "D — Minimal (age, BMI only)",
        "features": ["age_years", "bmi"],
    },
    {
        "label": "A — Core (age, BMI, waist)",
        "features": ["age_years", "bmi", "waist_cm"],
    },
    {
        "label": "B — Core + BP (A + systolic/diastolic)",
        "features": ["age_years", "bmi", "waist_cm", "systolic_bp", "diastolic_bp"],
    },
    {
        "label": "C — Full (B + sex)  [current production feature set]",
        "features": ["age_years", "bmi", "waist_cm", "systolic_bp", "diastolic_bp", "sex"],
    },
]

# Cross-validation strategy — identical across all models for paired comparison
CV = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)

# ---------------------------------------------------------------------------
# Helpers shared with train_icmr.py
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
    """Map raw Stata variable codes (v4, v5, …) to descriptive names."""
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
    """Encode sex to binary numeric (0 = male, 1 = female)."""
    s = series.copy()
    str_map = {"male": 0, "female": 1, "1": 0, "2": 1, "1.0": 0, "2.0": 1}
    if s.dtype == object or hasattr(s, "cat"):
        s = s.astype(str).str.lower().str.strip().map(str_map)
    else:
        s = s.map({1: 0, 2: 1, 1.0: 0, 2.0: 1})
    return s


# ---------------------------------------------------------------------------
# Custom scorers  (sklearn 1.9.0 — uses response_method="predict_proba";
#                  the old needs_proba kwarg was removed in 1.9.0)
# ---------------------------------------------------------------------------
# Scorer callables use the standard (y_true, y_score) signature so they can
# be wrapped with make_scorer(response_method="predict_proba"), which has
# sklearn extract the probability column internally before passing it in.

def _pr_auc_scorer(y_true, y_prob):
    """Area under the Precision-Recall curve (average precision)."""
    return average_precision_score(y_true, y_prob)


def _sensitivity_scorer(threshold: float):
    """Recall / sensitivity at a fixed decision threshold."""
    def _score(y_true, y_prob):
        pred = (y_prob >= threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
        return tp / (tp + fn) if (tp + fn) > 0 else 0.0
    # Give the inner function a stable __name__ for sklearn's scorer repr
    _score.__name__ = f"sensitivity_at_{threshold}"
    return _score


def _specificity_scorer(threshold: float):
    """True-negative rate / specificity at a fixed decision threshold."""
    def _score(y_true, y_prob):
        pred = (y_prob >= threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
        return tn / (tn + fp) if (tn + fp) > 0 else 0.0
    _score.__name__ = f"specificity_at_{threshold}"
    return _score


def _build_scorers(threshold: float) -> dict:
    """
    Build the scoring dict for cross_validate.

    All custom scorers use make_scorer with response_method="predict_proba",
    which is the supported API in sklearn >= 1.4 (needs_proba was removed
    in sklearn 1.9.0).  The scorer callable receives a 1-D probability
    array (already sliced to the positive class) rather than (estimator, X, y),
    so the function signatures above are (y_true, y_prob).
    """
    return {
        "roc_auc": "roc_auc",
        "pr_auc": make_scorer(
            _pr_auc_scorer,
            response_method="predict_proba",
        ),
        "brier_score": make_scorer(
            brier_score_loss,
            response_method="predict_proba",
            greater_is_better=False,
        ),
        "sensitivity": make_scorer(
            _sensitivity_scorer(threshold),
            response_method="predict_proba",
        ),
        "specificity": make_scorer(
            _specificity_scorer(threshold),
            response_method="predict_proba",
        ),
    }


# ---------------------------------------------------------------------------
# Per-model pipeline builder
# ---------------------------------------------------------------------------

def _build_pipeline(features: list[str]) -> Pipeline:
    """
    sklearn Pipeline: median imputation → z-score scaling → L2 LogReg.
    Using liblinear for exact consistency with liblinear's solver behaviour
    on small datasets (also supports L1 in future if needed).
    Imputation inside the pipeline ensures no leakage across CV folds.
    """
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler()),
        ("lr",      LogisticRegression(
            penalty="l2",
            solver="liblinear",
            C=1.0,
            max_iter=500,
            random_state=42,
        )),
    ])


def _build_dummy() -> Pipeline:
    """Dummy baseline wrapped in a Pipeline for uniform API."""
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("dummy",   DummyClassifier(strategy="prior", random_state=42)),
    ])


# ---------------------------------------------------------------------------
# Evaluate one model configuration
# ---------------------------------------------------------------------------

def _evaluate(label: str, pipeline, X: pd.DataFrame, y: pd.Series,
               scorers: dict, n_features: int) -> dict:
    log.info("Evaluating: %s …", label)
    results = cross_validate(
        pipeline, X, y,
        cv=CV,
        scoring=scorers,
        return_train_score=False,
        n_jobs=-1,
    )
    metrics = {}
    for metric_key in scorers:
        vals = results[f"test_{metric_key}"]
        metrics[metric_key] = {
            "mean": float(np.mean(vals)),
            "std":  float(np.std(vals)),
            "min":  float(np.min(vals)),
            "max":  float(np.max(vals)),
        }
    return {"label": label, "n_features": n_features, "metrics": metrics}


# ---------------------------------------------------------------------------
# Decision rule — "prefer simplest unless non-trivial consistent improvement"
# ---------------------------------------------------------------------------

_AUC_IMPROVEMENT_THRESHOLD  = 0.02   # 2 AUC points is the minimum meaningful gain
_BRIER_IMPROVEMENT_THRESHOLD = 0.005  # 0.5 Brier-score points
_STD_OVERLAP_FACTOR          = 1.0    # gain must exceed 1× std of the simpler model


def _recommend(results: list[dict]) -> str:
    """
    Decision rule (stated in task spec):
      Prefer the simplest model unless a more complex one shows a consistent,
      non-trivial improvement.

    "Non-trivial" here means the AUC gain exceeds both:
      (a) AUC_IMPROVEMENT_THRESHOLD absolute points, AND
      (b) 1× the std of the simpler model's AUC distribution
          (i.e. the gain is unlikely to be random fold variation).
    """
    # Filter out dummy; sort by number of features ascending (D → A → B → C).
    # We key on the number of features stored in the result dict, not label
    # length, so the ordering is stable regardless of label string widths.
    real = [r for r in results if "Dummy" not in r["label"]]
    ordered = sorted(real, key=lambda r: r["n_features"])

    preferred = ordered[0]  # start with simplest
    explanation_lines = [
        f"Starting with simplest: {preferred['label']}",
    ]

    for candidate in ordered[1:]:
        gain_auc   = (candidate["metrics"]["roc_auc"]["mean"]
                      - preferred["metrics"]["roc_auc"]["mean"])
        gain_brier = (preferred["metrics"]["brier_score"]["mean"]
                      - candidate["metrics"]["brier_score"]["mean"])
        std_simpler = preferred["metrics"]["roc_auc"]["std"]

        non_trivial = (
            gain_auc > _AUC_IMPROVEMENT_THRESHOLD
            and gain_auc > _STD_OVERLAP_FACTOR * std_simpler
        )

        if non_trivial:
            explanation_lines.append(
                f"  → Upgrade to {candidate['label']}: "
                f"AUC gain = +{gain_auc:.4f} (threshold = {_AUC_IMPROVEMENT_THRESHOLD}), "
                f"gain/std = {gain_auc/std_simpler:.2f}× — consistent, non-trivial."
            )
            preferred = candidate
        else:
            explanation_lines.append(
                f"  → {candidate['label']}: AUC gain = +{gain_auc:.4f} "
                f"(threshold = {_AUC_IMPROVEMENT_THRESHOLD}), "
                f"gain/std = {gain_auc/std_simpler:.2f}× — "
                f"{'marginal gain, keeping simpler model.' if gain_auc >= 0 else 'no gain over simpler model.'}"
            )

    explanation_lines.append(f"\nRECOMMENDATION: {preferred['label']}")
    return "\n".join(explanation_lines)


# ---------------------------------------------------------------------------
# Table printer
# ---------------------------------------------------------------------------

def _print_table(results: list[dict], threshold: float) -> None:
    cols  = ["roc_auc", "pr_auc", "sensitivity", "specificity", "brier_score"]
    hdrs  = ["ROC-AUC", "PR-AUC", f"Sens@{threshold}", f"Spec@{threshold}", "Brier"]
    width = 52

    sep = "─" * (width + 14 * len(cols))
    print()
    print("=" * (width + 14 * len(cols)))
    print(f"FEATURE CONFIGURATION COMPARISON  "
          f"(RepeatedStratifiedKFold  n_splits=5  n_repeats=10)")
    print(f"Decision threshold for sensitivity/specificity: {threshold}")
    print("=" * (width + 14 * len(cols)))

    # Header row
    header = f"{'Configuration':<{width}}"
    for h in hdrs:
        header += f"{'mean±std':>14}"
    print(header)
    # Sub-header with metric names
    subhdr = " " * width
    for h in hdrs:
        subhdr += f"{h:>14}"
    print(subhdr)
    print(sep)

    for r in results:
        m = r["metrics"]
        row = f"{r['label']:<{width}}"
        for c in cols:
            val = f"{m[c]['mean']:.3f}±{m[c]['std']:.3f}"
            row += f"{val:>14}"
        print(row)

    print(sep)
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Compare diabetes screening feature configurations on the ICMR-INDIAB "
            "sample. Produces a comparison report only — does NOT save a model."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            This script is RESEARCH_ONLY. Do not use these results to make
            clinical decisions. Do not commit output files to Git.
        """),
    )
    parser.add_argument(
        "--data-path",
        required=True,
        help=(
            "Absolute path to the Stata (.dta) dataset file. "
            "No default is provided — the caller must supply this explicitly."
        ),
    )
    parser.add_argument(
        "--output-json",
        default=None,
        help=(
            "Optional path to write the comparison report as a JSON file. "
            "If omitted, results are printed to stdout only. "
            "IMPORTANT: do not write to a Git-tracked path."
        ),
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=(
            f"Decision threshold for sensitivity/specificity calculation "
            f"(default: {DEFAULT_THRESHOLD}). Does not affect AUC, PR-AUC, or Brier."
        ),
    )
    args = parser.parse_args()

    # ── GUARD 1 — Dataset file must exist ────────────────────────────────────
    if not os.path.exists(args.data_path):
        log.error("Dataset file not found: %s", args.data_path)
        sys.exit(1)

    # ── GUARD 2 — Output path must not be Git-tracked ────────────────────────
    if args.output_json:
        abs_out = os.path.abspath(args.output_json)
        abs_hi  = os.path.abspath(_HI_DIR)
        # Warn but don't block — researcher may have a good reason
        if abs_out.startswith(abs_hi):
            log.warning(
                "Output JSON path is inside the health-intelligence directory (%s). "
                "Ensure it is listed in .gitignore before committing.",
                abs_out,
            )

    # ── Load and normalise ───────────────────────────────────────────────────
    log.info("Loading dataset from: %s", args.data_path)
    df_raw, column_labels = _load_dataset(args.data_path)
    df = _normalise_columns(df_raw)

    # ── GUARD 3 — Feature leakage policy check (all features across all configs)
    all_features = list({f for cfg in MODEL_CONFIGS for f in cfg["features"]})
    log.info("Validating feature leakage policy for all comparison features …")
    try:
        validate_feature_policy(all_features, column_labels)
    except ValueError as exc:
        log.error("Leakage policy violation — aborting. %s", exc)
        sys.exit(1)
    log.info("Feature policy OK.")

    # ── GUARD 4 — Minimum sample size ────────────────────────────────────────
    if len(df) < MINIMUM_ROWS:
        log.error(
            "Dataset has only %d rows; minimum required is %d. Aborting.",
            len(df), MINIMUM_ROWS,
        )
        sys.exit(1)

    # ── Prepare target ────────────────────────────────────────────────────────
    if TARGET_COLUMN not in df.columns:
        log.error("Target column '%s' (v36) not found in dataset.", TARGET_COLUMN)
        sys.exit(1)

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

    y = pd.to_numeric(df[TARGET_COLUMN], errors="coerce").astype(float)
    n_positive = int(y.sum())
    n_total    = len(y)
    prevalence = n_positive / n_total
    log.info(
        "Target distribution: n=%d  positives=%d  prevalence=%.3f",
        n_total, n_positive, prevalence,
    )

    # ── Encode sex once in the full dataframe ─────────────────────────────────
    if "sex" in df.columns:
        df["sex"] = _encode_sex(df["sex"])
    for col in all_features:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # ── Build scorers ─────────────────────────────────────────────────────────
    scorers = _build_scorers(args.threshold)

    # ── Evaluate all models ───────────────────────────────────────────────────
    comparison_results: list[dict] = []

    # Dummy baseline — evaluated on the widest feature set for a fair
    # imputer fit, but its n_features is set to 0 so it sorts before
    # all real configs in the recommendation logic.
    log.info("Evaluating: Dummy baseline …")
    X_full = df[MODEL_CONFIGS[-1]["features"]].copy()  # widest feature set for dummy
    dummy_result = _evaluate(
        "Dummy — prior(+) class baseline",
        _build_dummy(),
        X_full, y,
        scorers,
        n_features=0,
    )
    comparison_results.append(dummy_result)

    # Feature configurations D → A → B → C (ordered by MODEL_CONFIGS list)
    for cfg in MODEL_CONFIGS:
        X_cfg = df[cfg["features"]].copy()
        result = _evaluate(
            cfg["label"],
            _build_pipeline(cfg["features"]),
            X_cfg, y,
            scorers,
            n_features=len(cfg["features"]),
        )
        comparison_results.append(result)

    # ── Print comparison table ────────────────────────────────────────────────
    print()
    print("=" * 80)
    print("HEALTHGUARD AI — DIABETES SCREENING FEATURE CONFIGURATION COMPARISON")
    print("LIFECYCLE: RESEARCH_ONLY — comparison artifacts only")
    print(f"Run at:  {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}")
    print(f"Dataset: {args.data_path}")
    print(f"Sample:  n={n_total}, positives={n_positive} ({prevalence:.1%} prevalence)")
    print("=" * 80)

    _print_table(comparison_results, args.threshold)

    # ── Recommendation ────────────────────────────────────────────────────────
    print("─" * 80)
    print("DECISION RULE: prefer the simplest model unless a more complex one shows")
    print(f"  a consistent, non-trivial improvement (AUC gain > {_AUC_IMPROVEMENT_THRESHOLD}")
    print(f"  AND gain > {_STD_OVERLAP_FACTOR}× std of simpler model's AUC).")
    print("─" * 80)
    recommendation_text = _recommend(comparison_results)
    print(recommendation_text)
    print("─" * 80)
    print()
    print("LIMITATIONS OF THIS COMPARISON:")
    print("  • Cross-validated metrics on ~500 rows have high sampling variance.")
    print("  • AUC differences < 0.03 should be treated as noise, not signal.")
    print("  • PR-AUC is more informative than ROC-AUC at this prevalence level.")
    print("  • Sensitivity/specificity depend on the chosen threshold — examine")
    print("    the full ROC curve before choosing a deployment threshold.")
    print("  • No external validation — these numbers do not generalise.")
    print("  • This script does NOT update diabetes_model.joblib.")
    print()

    # ── Optionally save JSON report ───────────────────────────────────────────
    if args.output_json:
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "lifecycle": "RESEARCH_ONLY",
            "dataset_path": args.data_path,   # path only, no rows
            "sample_n": n_total,
            "positives": n_positive,
            "prevalence": prevalence,
            "decision_threshold": args.threshold,
            "cv_strategy": "RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)",
            "decision_rule": {
                "auc_improvement_threshold": _AUC_IMPROVEMENT_THRESHOLD,
                "std_overlap_factor": _STD_OVERLAP_FACTOR,
            },
            "results": comparison_results,
            "recommendation": recommendation_text,
        }
        out_path = os.path.abspath(args.output_json)
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        log.info("Comparison report saved to: %s", out_path)
        log.info(
            "REMINDER: This file contains metadata (no patient rows) but "
            "should not be committed to Git without governance review."
        )


if __name__ == "__main__":
    main()
