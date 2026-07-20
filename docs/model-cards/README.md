# Model Cards Directory

This directory contains performance and governance cards for clinical
prediction engines and machine-learning classifiers in the V2 platform.

## 1. Card Template Fields

Each model card must document intended and prohibited uses, model formulation,
validation strategy and metrics, lifecycle status, and limitations including
sample size and generalisability.

## 2. Active Models

### Diabetes Screening — Pipeline Logistic Regression (`RESEARCH_ONLY`)

| Field | Value |
|---|---|
| **Lifecycle** | `RESEARCH_ONLY` |
| **Model type** | `Pipeline(SimpleImputer(median) -> StandardScaler -> LogisticRegression)` |
| **Training date** | 2026-07-19 |
| **Training dataset** | ICMR-INDIAB Himachal Pradesh sample (490 rows after target-missing drop) |
| **Target variable** | `diabetes_composite` (v36) |
| **Features** | `age_years`, `bmi` |
| **Validation strategy** | RepeatedStratifiedKFold (5 splits × 10 repeats; 50 folds) |
| **ROC-AUC** | **0.747 ± 0.056** (mean ± std across folds) |
| **PR-AUC** | **0.310 ± 0.081** (mean ± std across folds) |
| **Active threshold** | ~75% sensitivity; mean cutoff **0.1206**; ~64% specificity |
| **Artifact** | `health-intelligence/models/diabetes_model.joblib` |
| **Metadata** | `health-intelligence/models/diabetes_model_metadata.json` |

Exact metadata values are ROC-AUC 0.7469744115893227 ±
0.05637783327610136, PR-AUC 0.3100783603360767 ± 0.08117204122819577,
active mean cutoff 0.12062377210096864, and active mean specificity
0.64174829001368.

The model uses only `age_years` and `bmi`, reduced from the original
six-feature set. Waist circumference, blood pressure, and sex were evaluated
by `train_icmr_compare.py` and showed no PR-AUC improvement beyond
fold-to-fold noise on this 490-row sample.

The active operating point deliberately prioritises sensitivity for
screening. At approximately 64% specificity, roughly 1 in 3 people without
diabetes will still be flagged as `elevated`. Four alternative thresholds
targeting 70%, 80%, 85%, and 90% sensitivity are stored in metadata and can be
selected without retraining if the trade-off needs revisiting.

**Key limitations:**

- `RESEARCH_ONLY`; not validated for clinical use and not diagnostic.
- Small sample of 490 rows.
- No external validation cohort.
- The regional Himachal Pradesh sample is not nationally representative.

See [`docs/data-cards/diabetes.md`](../data-cards/diabetes.md) for the full
dataset card, leakage policy, and retraining instructions.

---

### Cardiovascular Risk Engine (Framingham)

- **Type:** Rule-based (V1 scoring)
- **Formulation:** Framingham General Cardiovascular Risk Score
- **Lifecycle:** V1 production (not ML; governed by V1 freeze tests)

### Hypertension Estimator

- **Type:** Evidence-based rules (V1 scoring)
- **Lifecycle:** V1 production (not ML; governed by V1 freeze tests)

## 3. Governance Rules

- No synthetic data may train user-facing models.
- Every model artifact must carry a recognised `lifecycle_status` in metadata.
- Accepted research lifecycle states are `RESEARCH_ONLY` and
  `VALIDATION_CANDIDATE`.
- Raw datasets must remain outside Git.
- Missing or rejected models return `status: model-unavailable`; the service
  never fabricates a score.
- Every training run requires an explicit `--data-path`; training paths must
  not be hardcoded.
