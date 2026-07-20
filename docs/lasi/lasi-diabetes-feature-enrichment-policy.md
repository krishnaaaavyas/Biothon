# LASI diabetes feature-enrichment metadata policy

## Purpose

Phase 3B.1A identifies metadata-supported LASI Individual variables that might
map to user-collectable HealthGuard questions about diabetes family history,
physical activity, or relevant screening symptoms. This is a discovery audit,
not approval to add a feature. Existing approved age, height, and weight
mappings remain unchanged.

The audit accepts exactly `3_LASI_W1_Individual_v4.dta`, supplied through an
explicit path outside the Git repository. It reads Stata metadata only. It must
not read participant rows, compute real-data frequencies, inspect participant
values, or access restricted LASI locations on behalf of the user.

## Search and recommendation policy

Candidate variable names and labels must explicitly match one of these domains:

- Diabetes family history involving an explicitly biological relative or a
  family-history question. Household membership alone is not treated as proof
  of biological relationship.
- Vigorous, moderate, or light activity; walking; exercise; activity frequency
  or duration; sedentary behavior; or inactivity.
- Potential screening symptoms such as polyuria, polydipsia, unexplained weight
  loss, fatigue, blurred vision, recurrent infections, slow-healing wounds, or
  numbness and tingling.

Unsupported concepts are not invented. Family-history and physical-activity
matches may be marked `suitable_candidate`, but this means suitable for manual
review only. Symptoms are `exploratory_only` because they are nonspecific and
require clinical and content review.

Metadata related to HbA1c, glucose or blood-sugar measurements, the
respondent's diagnosed or self-reported diabetes, diabetes medication, insulin,
treatment, target labels, or raw identifiers is rejected before output
construction. An explicit biological-family-history question is not rejected
merely because its wording says that a relative was diagnosed with diabetes or
high blood sugar.

## Required review before feature approval

Every reported candidate still requires all of the following before modelling:

- Confirmation of the exact LASI question text, respondent, recall period, and
  skip logic.
- Confirmation that the coding and value labels can be transformed without
  guessing or collapsing distinct meanings.
- Aggregate missingness and response-distribution review using a separately
  approved privacy-safe audit.
- Target-leakage, post-diagnosis, confounding, and user-collectability review.
- Confirmation that the proposed HealthGuard question preserves the source
  concept rather than inferring biological relationship from household status.

No candidate is added to the cohort builder or model from this report alone.

## Output and privacy

The sole output is
`lasi_diabetes_enrichment_variable_candidates.json`, written to an explicit
directory outside Git. Each candidate contains only its variable name, label,
source basename, storage type, available value-label/codebook metadata,
semantic domain, possible HealthGuard question mapping, leakage concern, and
recommendation.

The report contains no participant records, participant values, real-data
frequencies, identifiers, absolute paths, or source-file copies. It is not
committed automatically. Any candidate requires separate semantic, coding,
missingness, leakage, usability, and governance review before modelling.

Raw LASI files and generated audit output must remain outside the repository.