# LASI undiagnosed-diabetes threshold-selection policy

## Phase 3B scope

Phase 3B recommends screening-threshold candidates using development-only
out-of-fold predictions. It does not access raw LASI files, the old ICMR model,
or the locked test fold. It does not approve a final threshold or save a model.

Before analysis, the program requires a passing independent cohort validation,
real-LASI privacy declarations, an exact cohort checksum and approved counts,
and matching Phase 3A seed, split method, locked-fold index, aggregate locked
structure, and explicit declaration that the locked fold remains unevaluated.

## Status

Development analysis only.

No threshold in this phase is approved for production or locked-test
evaluation. The 80%, 85%, and 90% sensitivity thresholds are provisional
development candidates.

The locked test set remains unevaluated.

The age-and-BMI model remains a baseline while user-collectable feature
enrichment is investigated.

## Models and splitting

The primary model is L2 logistic regression using age and BMI only. Median
imputation and standardization occur inside its sklearn pipeline. The
challenger adds sex plus controlled squared age, squared BMI, and age–BMI
interaction terms constructed after fold-local imputation. The challenger is
not automatically approved.

The Phase 3A shuffled five-fold `StratifiedGroupKFold` is recreated with SSU as
the splitting group and fold zero locked. A second deterministic grouped
five-fold split generates transient out-of-fold probabilities on development
data only. No SSU may cross training and validation.

Waist, blood pressure, group IDs, state, survey weights, quality flags, target
fields, HbA1c, diagnosis evidence, and identifiers are forbidden predictors.
Survey weight is permitted only as `sample_weight` in its sensitivity run.

## Threshold candidates

For sensitivity targets 0.80, 0.85, and 0.90, the highest deterministic pooled
OOF threshold that reaches the requested sensitivity is reported. Aggregate
confusion counts, sensitivity, specificity, precision, negative predictive
value, F1, F2, balanced accuracy, and referral volume are provided. Each fixed
threshold is then assessed across all development folds with aggregate
distribution statistics and a count of folds meeting its sensitivity target.

These results are recommendations for manual review. No classification
threshold is selected automatically.

## Sensitivity analyses

Three development-only comparisons are reported without changing the primary
cohort:

- Primary-model training with India DBS weights passed only as estimator
  sample weights, with ordinary and weighted aggregate metrics.
- BMI treated as missing on a copied view for short-height-flagged records,
  followed by fold-local imputation.
- Age-over-100-flagged records excluded only from a copied sensitivity view.

## Outputs and privacy

Exactly five aggregate files are written to an explicit directory outside Git:

- `lasi_threshold_candidates.csv`
- `lasi_threshold_model_comparison.json`
- `lasi_threshold_fold_stability.json`
- `lasi_threshold_sensitivity_analyses.json`
- `lasi_threshold_run_manifest.json`

They contain no participant records, group values, fold assignments, source
features, row-level probabilities, predictions, absolute paths, model
artifacts, or private data. Outputs are not committed automatically.

