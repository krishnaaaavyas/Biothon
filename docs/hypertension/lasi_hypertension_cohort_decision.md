# LASI Hypertension Cohort Decision

## Status

- Approved target policy: `last_two_pairs_mean`
- Final modelling cohort approved: **false**
- Missing-data policy approved: **false**
- Cohort persistence, splitting, imputation, scaling, polynomial expansion, and model training: **not performed**

## Eligibility and target

Respondents must be at least 45, have `ht002 == 2`, and have complete valid BP pairs 2 and 3. Missing `ht002c` does not exclude an otherwise diagnosis-eligible respondent. Representative BP is the mean of `bm010/bm014` and `bm011/bm015`; the target is positive for systolic ≥140 or diastolic ≥90.

## Predictor derivations

The only approved predictors are age, sex, height, weight, calculated BMI, first-degree family history, deterministic physical-activity category, and deterministic smoking category. BMI uses finite positive height and weight without rounding. Unresolved family-history and categorical evidence remains unknown. Grandchildren, identifiers, survey design fields, diagnosis, treatment, BP, and measurement-quality fields are not predictors.

## Feature sets

- A: age, BMI
- B: A plus sex
- C: B plus family history, physical activity, and smoking
- D: age, height, weight, sex, family history, physical activity, and smoking
- E: all eight approved predictors
- F: the same raw availability as C; no polynomial features are generated in Phase 3

## Missingness policies under consideration

The audit reports both strict complete-case availability and availability when categorical unknowns are retained. No imputation policy has been selected. Numeric missingness is not imputed; categorical unknowns are not silently converted to negative categories.

## Manual aggregate-result review

- Review layer reconciliation and agreement with the Phase 2 constructible count.
- Review predictor missingness, unresolved categories, anthropometric quality flags, and survey-weight validity.
- Select a missing-data policy or reject the proposed cohort.
- Approve a final modelling cohort before any split or training phase.
