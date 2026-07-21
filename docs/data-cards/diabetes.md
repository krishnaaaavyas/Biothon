# Dataset Card: Diabetes Risk Screening (V2 Research)

> **Lifecycle status:** `RESEARCH_ONLY` — not validated for clinical use.

## 1. Current State

| Item | Status |
|---|---|
| Synthetic prototype dataset (`diabetes_data.csv`) | Permanently removed |
| Synthetic model artifact | Permanently removed |
| Authentic ICMR-INDIAB sample | Loaded externally; not tracked in Git |
| Trained model artifact (`models/diabetes_model.joblib`) | **Installed** — `RESEARCH_ONLY` |
| Live endpoint status | **Returns `status: complete` with `screeningProbability` and `riskTier`** |

The current pipeline was trained on 490 rows from the authentic ICMR-INDIAB
sample. Ten rows with a missing composite diabetes outcome were dropped before
training; target values were not imputed.

## 2. Intended Use and Task

- **Intended task:** Research-only pre-laboratory screening prioritisation to
  identify people who may benefit from laboratory confirmation such as HbA1c.
- **Not diagnostic:** The model cannot diagnose diabetes or replace clinical
  assessment and laboratory testing.
- **Prohibited use:** Real-world clinical diagnosis, prescription, clinical
  decision support, or user-facing risk communication without licensed
  physician oversight and formal validation.

## 3. Dataset Characteristics

| Property | Value |
|---|---|
| Source | ICMR-INDIAB (Indian Council of Medical Research–India Diabetes Study) |
| Raw rows available | 500 |
| Rows used for training | **490** (10 dropped for missing `diabetes_composite`) |
| Target variable | `diabetes_composite` (Stata variable `v36`) |
| Format | Stata `.dta`, supplied externally and not committed to Git |
| Geography | Himachal Pradesh regional cohort — **not nationally representative** |
| External validation cohort | **None available** |

### Predictor Variables Used

| Variable | Stata code |
|---|---|
| `age_years` | v4 |
| `bmi` | v8 |

The feature set was reduced from the original six predictors to `age_years`
and `bmi`. Waist circumference, systolic and diastolic blood pressure, and sex
were tested using `training/train_icmr_compare.py`; on this 490-row sample they
showed no PR-AUC improvement beyond fold-to-fold noise.

### Leakage Policy

All predictors were validated against `training/audit_icmr_sample.py`. Glucose,
HbA1c, OGTT, fasting blood sugar, composite outcomes, and correlated outcome
columns are categorically forbidden as predictors.

## 4. Model and Evaluation

The model is a
`Pipeline(SimpleImputer(median) -> StandardScaler -> LogisticRegression)`.
Evaluation used `RepeatedStratifiedKFold` with 5 splits and 10 repeats (50
held-out folds), rather than a single train/test split.

| Metric | Mean | ± Std across 50 folds |
|---|---|---|
| ROC-AUC | **0.747** | ± 0.056 |
| PR-AUC | **0.310** | ± 0.081 |

Exact source values in `models/diabetes_model_metadata.json` are ROC-AUC
0.7469744115893227 ± 0.05637783327610136 and PR-AUC 0.3100783603360767 ±
0.08117204122819577.

### Decision Threshold

The active threshold targets approximately **75% sensitivity**, with a mean
probability cutoff of **0.1206** and mean specificity of approximately **64%**
(exact metadata values: 0.12062377210096864 and 0.64174829001368). Roughly 1 in
3 people without diabetes will therefore still be flagged as `elevated` at
this setting. This trade-off was deliberately chosen to prioritise catching
real cases in a screening context; it is not a diagnostic threshold.

Four alternative operating options targeting 70%, 80%, 85%, and 90%
sensitivity are stored in metadata and can be selected without retraining if
the sensitivity/specificity trade-off needs to be revisited.

## 5. Limitations

- **RESEARCH_ONLY:** Not validated for clinical use.
- **Small sample:** 490 rows; estimates have meaningful variance.
- **No external validation:** Performance on independent cohorts is unknown.
- **Not diagnostic:** Outputs cannot diagnose diabetes or replace laboratory
  confirmation.
- **Regional sample:** The Himachal Pradesh sample is not nationally
  representative.
- **No prospective outcome validation:** The model has not been evaluated
  against prospective clinical outcomes.

## 6. How to Retrain

Once an authorised researcher supplies an updated dataset outside Git:

```powershell
.\.venv\Scripts\python.exe health-intelligence\training\train_icmr.py `
    --data-path "C:\path\to\private\icmr_indiab_sample.dta"
```

The script validates the leakage policy, runs 5-split × 10-repeat stratified
cross-validation, fits the final pipeline, and saves the model artifact and
metadata. The FastAPI service loads them on its next startup.
