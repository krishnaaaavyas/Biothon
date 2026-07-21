"""
train_icmr_hypertension_compare.py — Feature-Set Comparison (Research-Only)
============================================================================
Lifecycle:  RESEARCH_ONLY — comparison/reporting only
Purpose:    Compare hypertension predictor configurations and a dummy baseline.
            This script does NOT save or replace any model artifact.

Usage (run manually once the real dataset file is available):
    python health-intelligence/training/train_icmr_hypertension_compare.py \
        --data-path "/path/to/your/private/icmr_indiab_sample.dta"

Optional:
    --output-json /path/to/save/comparison_report.json
    --threshold   0.5

RULES:
  DO NOT run this script against synthetic or fabricated data.
  DO NOT hard-code any dataset path inside this script.
  DO NOT commit participant-level data or comparison outputs to Git.
  This script NEVER saves a trained model artifact.
"""

import argparse
import json
import logging
import os
import sys
import textwrap
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    make_scorer,
    roc_auc_score,
)
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


_TRAINING_DIR = os.path.dirname(os.path.abspath(__file__))
_HI_DIR = os.path.dirname(_TRAINING_DIR)
sys.path.insert(0, _TRAINING_DIR)

from audit_icmr_sample import validate_feature_policy_hypertension  # noqa: E402


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

TARGET_COLUMN = "hypertension_composite"  # v38
MINIMUM_ROWS = 100
DEFAULT_THRESHOLD = 0.5

NUMERIC_FEATURES = ["age_years", "bmi", "waist_cm"]
CATEGORICAL_FEATURES = ["sex", "occupation"]

MODEL_CONFIGS: list[dict] = [
    {
        "label": "E — Minimal (age, BMI only)",
        "features": ["age_years", "bmi"],
    },
    {
        "label": "F — E + waist circumference",
        "features": ["age_years", "bmi", "waist_cm"],
    },
    {
        "label": "G — F + sex",
        "features": ["age_years", "bmi", "waist_cm", "sex"],
    },
    {
        "label": "H — G + occupation",
        "features": ["age_years", "bmi", "waist_cm", "sex", "occupation"],
    },
]

CV = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=42)


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
    """Map raw Stata variable codes to descriptive names."""
    rename = {
        "v4": "age_years",
        "v5": "sex",
        "v7": "occupation",
        "v8": "bmi",
        "v9": "waist_cm",
        "v38": "hypertension_composite",
    }
    return df.rename(columns={k: v for k, v in rename.items() if k in df.columns})


# ---------------------------------------------------------------------------
# Custom scorers — copied from train_icmr_compare.py.
# ---------------------------------------------------------------------------

def _pr_auc_scorer(y_true, y_prob):
    """Area under the Precision-Recall curve (average precision)."""
    return average_precision_score(y_true, y_prob)


def _sensitivity_scorer(threshold: float):
    """Recall / sensitivity at a fixed decision threshold."""
    def _score(y_true, y_prob):
        pred = (y_prob >= threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
        return tp / (tp + fn) if (tp + fn) > 0 else 0.0
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
    """Build the scorer dictionary using positive-class probabilities."""
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


def _build_preprocessor(features: list[str]) -> ColumnTransformer:
    numeric = [feature for feature in features if feature in NUMERIC_FEATURES]
    categorical = [
        feature for feature in features if feature in CATEGORICAL_FEATURES
    ]
    transformers = []
    if numeric:
        transformers.append(
            (
                "numeric",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]),
                numeric,
            )
        )
    if categorical:
        transformers.append(
            (
                "categorical",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ]),
                categorical,
            )
        )
    return ColumnTransformer(transformers=transformers, remainder="drop")


def _build_pipeline(features: list[str]) -> Pipeline:
    """Build fold-safe preprocessing followed by logistic regression."""
    return Pipeline([
        ("preprocessor", _build_preprocessor(features)),
        ("lr", LogisticRegression(max_iter=2000, random_state=42)),
    ])


def _build_dummy(features: list[str]) -> Pipeline:
    """Dummy prior baseline with the same fold-safe preprocessing."""
    return Pipeline([
        ("preprocessor", _build_preprocessor(features)),
        ("dummy", DummyClassifier(strategy="prior", random_state=42)),
    ])


def _evaluate(
    label: str,
    pipeline,
    X: pd.DataFrame,
    y: pd.Series,
    scorers: dict,
    n_features: int,
) -> dict:
    log.info("Evaluating: %s …", label)
    results = cross_validate(
        pipeline,
        X,
        y,
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
            "std": float(np.std(vals)),
            "min": float(np.min(vals)),
            "max": float(np.max(vals)),
        }
    return {"label": label, "n_features": n_features, "metrics": metrics}


_AUC_IMPROVEMENT_THRESHOLD = 0.02
_BRIER_IMPROVEMENT_THRESHOLD = 0.005
_STD_OVERLAP_FACTOR = 1.0


def _recommend(results: list[dict]) -> str:
    """Prefer the simplest model unless AUC gain is consistent and >0.02."""
    real = [result for result in results if "Dummy" not in result["label"]]
    ordered = sorted(real, key=lambda result: result["n_features"])

    preferred = ordered[0]
    explanation_lines = [f"Starting with simplest: {preferred['label']}"]

    for candidate in ordered[1:]:
        gain_auc = (
            candidate["metrics"]["roc_auc"]["mean"]
            - preferred["metrics"]["roc_auc"]["mean"]
        )
        std_simpler = preferred["metrics"]["roc_auc"]["std"]
        non_trivial = (
            gain_auc > _AUC_IMPROVEMENT_THRESHOLD
            and gain_auc > _STD_OVERLAP_FACTOR * std_simpler
        )

        gain_std_ratio = gain_auc / std_simpler if std_simpler else float("inf")
        if non_trivial:
            explanation_lines.append(
                f"  → Upgrade to {candidate['label']}: "
                f"AUC gain = +{gain_auc:.4f} "
                f"(threshold = {_AUC_IMPROVEMENT_THRESHOLD}), "
                f"gain/std = {gain_std_ratio:.2f}× — consistent, non-trivial."
            )
            preferred = candidate
        else:
            explanation_lines.append(
                f"  → {candidate['label']}: AUC gain = +{gain_auc:.4f} "
                f"(threshold = {_AUC_IMPROVEMENT_THRESHOLD}), "
                f"gain/std = {gain_std_ratio:.2f}× — "
                f"{'marginal gain, keeping simpler model.' if gain_auc >= 0 else 'no gain over simpler model.'}"
            )

    explanation_lines.append(f"\nRECOMMENDATION: {preferred['label']}")
    return "\n".join(explanation_lines)


def _print_table(results: list[dict], threshold: float) -> None:
    cols = ["roc_auc", "pr_auc", "sensitivity", "specificity", "brier_score"]
    hdrs = ["ROC-AUC", "PR-AUC", f"Sens@{threshold}", f"Spec@{threshold}", "Brier"]
    width = 52
    sep = "─" * (width + 14 * len(cols))

    print()
    print("=" * (width + 14 * len(cols)))
    print(
        "FEATURE CONFIGURATION COMPARISON  "
        "(RepeatedStratifiedKFold  n_splits=5  n_repeats=10)"
    )
    print(f"Decision threshold for sensitivity/specificity: {threshold}")
    print("=" * (width + 14 * len(cols)))
    header = f"{'Configuration':<{width}}"
    for _ in hdrs:
        header += f"{'mean±std':>14}"
    print(header)
    subheader = " " * width
    for heading in hdrs:
        subheader += f"{heading:>14}"
    print(subheader)
    print(sep)

    for result in results:
        metrics = result["metrics"]
        row = f"{result['label']:<{width}}"
        for column in cols:
            value = f"{metrics[column]['mean']:.3f}±{metrics[column]['std']:.3f}"
            row += f"{value:>14}"
        print(row)
    print(sep)
    print()


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Compare hypertension screening feature configurations on the "
            "ICMR-INDIAB sample. Reports only; does NOT save a model."
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
        help="Absolute path to the externally supplied Stata (.dta) file.",
    )
    parser.add_argument(
        "--output-json",
        default=None,
        help="Optional path for a metadata-only comparison JSON report.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=(
            "Decision threshold for sensitivity/specificity calculation "
            f"(default: {DEFAULT_THRESHOLD})."
        ),
    )
    args = parser.parse_args()

    if not os.path.exists(args.data_path):
        log.error("Dataset file not found: %s", args.data_path)
        sys.exit(1)

    if args.output_json:
        abs_out = os.path.abspath(args.output_json)
        abs_hi = os.path.abspath(_HI_DIR)
        if abs_out.startswith(abs_hi):
            log.warning(
                "Output JSON path is inside health-intelligence (%s). "
                "Ensure it is ignored before committing.",
                abs_out,
            )

    log.info("Loading dataset from: %s", args.data_path)
    df_raw, column_labels = _load_dataset(args.data_path)
    df = _normalise_columns(df_raw)

    # Validate each configuration independently before any training begins.
    for config in MODEL_CONFIGS:
        log.info("Validating hypertension feature policy: %s", config["label"])
        try:
            validate_feature_policy_hypertension(
                config["features"], column_labels
            )
        except ValueError as exc:
            log.error("Leakage policy violation — aborting. %s", exc)
            sys.exit(1)
    log.info("Hypertension feature policy OK for all configurations.")

    if len(df) < MINIMUM_ROWS:
        log.error(
            "Dataset has only %d rows; minimum required is %d. Aborting.",
            len(df), MINIMUM_ROWS,
        )
        sys.exit(1)

    if TARGET_COLUMN not in df.columns:
        log.error("Target column '%s' (v38) not found in dataset.", TARGET_COLUMN)
        sys.exit(1)

    n_before = len(df)
    df = df.dropna(subset=[TARGET_COLUMN])
    n_dropped = n_before - len(df)
    if n_dropped:
        log.info("Dropped %d rows with missing target (%s).", n_dropped, TARGET_COLUMN)

    if len(df) < MINIMUM_ROWS:
        log.error(
            "After dropping missing-target rows only %d rows remain; "
            "minimum required is %d. Aborting.",
            len(df), MINIMUM_ROWS,
        )
        sys.exit(1)

    all_features = list({
        feature for config in MODEL_CONFIGS for feature in config["features"]
    })
    missing_features = [feature for feature in all_features if feature not in df]
    if missing_features:
        log.error("Missing feature columns after normalisation: %s", missing_features)
        sys.exit(1)

    y = pd.to_numeric(df[TARGET_COLUMN], errors="coerce").astype(float)
    n_positive = int(y.sum())
    n_total = len(y)
    prevalence = n_positive / n_total
    log.info(
        "Target distribution: n=%d  positives=%d  prevalence=%.3f",
        n_total, n_positive, prevalence,
    )

    for feature in NUMERIC_FEATURES:
        if feature in df.columns:
            df[feature] = pd.to_numeric(df[feature], errors="coerce")

    scorers = _build_scorers(args.threshold)
    comparison_results: list[dict] = []

    widest_features = MODEL_CONFIGS[-1]["features"]
    log.info("Evaluating: Dummy baseline …")
    dummy_result = _evaluate(
        "Dummy — prior(+) class baseline",
        _build_dummy(widest_features),
        df[widest_features].copy(),
        y,
        scorers,
        n_features=0,
    )
    comparison_results.append(dummy_result)

    for config in MODEL_CONFIGS:
        result = _evaluate(
            config["label"],
            _build_pipeline(config["features"]),
            df[config["features"]].copy(),
            y,
            scorers,
            n_features=len(config["features"]),
        )
        comparison_results.append(result)

    print()
    print("=" * 80)
    print("HEALTHGUARD AI — HYPERTENSION FEATURE CONFIGURATION COMPARISON")
    print("LIFECYCLE: RESEARCH_ONLY — comparison/reporting only")
    print(f"Run at:  {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}")
    print(f"Dataset: {args.data_path}")
    print(f"Sample:  n={n_total}, positives={n_positive} ({prevalence:.1%} prevalence)")
    print("=" * 80)

    _print_table(comparison_results, args.threshold)

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
    print("  • PR-AUC is more informative than ROC-AUC when classes are imbalanced.")
    print("  • Sensitivity/specificity depend on the selected decision threshold.")
    print("  • No external validation — these results do not generalise.")
    print("  • This script does NOT save or update any model artifact.")
    print()

    if args.output_json:
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "lifecycle": "RESEARCH_ONLY",
            "target": TARGET_COLUMN,
            "dataset_path": args.data_path,
            "sample_n": n_total,
            "positives": n_positive,
            "prevalence": prevalence,
            "decision_threshold": args.threshold,
            "cv_strategy": (
                "RepeatedStratifiedKFold(n_splits=5, n_repeats=10, "
                "random_state=42)"
            ),
            "decision_rule": {
                "auc_improvement_threshold": _AUC_IMPROVEMENT_THRESHOLD,
                "std_overlap_factor": _STD_OVERLAP_FACTOR,
            },
            "results": comparison_results,
            "recommendation": recommendation_text,
        }
        out_path = os.path.abspath(args.output_json)
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as output_file:
            json.dump(report, output_file, indent=2)
        log.info("Comparison report saved to: %s", out_path)


if __name__ == "__main__":
    main()
