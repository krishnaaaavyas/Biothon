# LASI Hypertension Model Cohort — Phase 4A

## Status and purpose

This phase creates a restricted, de-identified participant-level research cohort for later development experiments. It does not train, evaluate, select, serialize, or deploy a model and does not create a train/test split.

The intended use remains pre-measurement screening prioritisation among LASI adults aged 45 or older without previous hypertension diagnosis. It is not a diagnosis or future-risk model. Measured BP, uploaded evidence, known diagnosis, medication, and urgent safety pathways remain higher-authority product routes.

## Authoritative target

- Canonical target: `undiagnosed_elevated_bp_screening_target`
- Persisted field: `target_undiagnosed_elevated_bp`
- Policy: `last_two_pairs_mean` (Policy B)
- Eligibility and target construction are imported from Phase 3 and are not redefined here.

## Exact restricted schema

1. `age`
2. `sex`
3. `height_cm`
4. `weight_kg`
5. `bmi`
6. `family_history_hypertension`
7. `physical_activity_category`
8. `smoking_category`
9. `target_undiagnosed_elevated_bp`
10. `household_group_id`
11. `ssu_group_id`
12. `national_weight`

Group identifiers are HMAC-SHA256 values derived with a private `LASI_GROUP_SALT` and distinct `household:` and `ssu:` namespaces. They support future leakage-safe splitting only and are not predictors. The salt and source identifier values are never persisted.

## Privacy boundary

The Parquet cohort is restricted research data and must remain outside Git and outside automatic cloud synchronisation. It contains no raw respondent, household, or SSU identifiers; no join key; no raw BP; no diagnosis or medication source fields; and no target-construction intermediates. JSON manifest, summary, and validation reports contain aggregates and assertions only.

## Validation

Independent validation verifies checksum, exact schema and order, approved counts, binary target, age eligibility, HMAC formatting and nesting, positive finite weights, manifest assertions, and aggregate-summary reconciliation. Phase 4A approval does not authorize model training or splitting.
