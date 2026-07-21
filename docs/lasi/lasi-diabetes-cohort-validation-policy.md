# LASI diabetes modelling-cohort validation policy

## Purpose and separation

Phase 3 independently validates the derived LASI Wave 1 undiagnosed-diabetes
modelling cohort. It does not read raw LASI files, rebuild the cohort, train a
model, or create predictions. The user runs it locally against the private
Parquet cohort and its manifest and summary using explicit command-line paths.

The validator writes exactly one aggregate report named
`lasi_model_cohort_validation.json`. Its output directory must be outside the
Git repository. The report contains no participant rows, anonymous group-ID
values, raw identifiers, private paths, or modified cohort data.

## Required validation

Validation covers the Parquet SHA-256 checksum, exact ordered schema, forbidden
columns, approved production row and target counts, target completeness and
coding, predictor ranges, positive finite survey weights, and HMAC formatting.
It also verifies household-to-SSU and SSU-to-state nesting using in-memory
grouping without printing or exporting group values. Production group totals
must equal 35,436 households and 2,438 SSUs.

The manifest must identify real LASI Wave 1 data and declare that it contains
no raw identifiers, target-defining variables, or synthetic training records.
Source references must be basenames only. Absolute Windows and Unix paths,
private salts, and group-ID values are rejected.

All aggregate summary fields are recomputed independently and compared with
the supplied summary: target counts, predictor missingness, sex distribution,
age bands, state counts, quality flags, and household and SSU counts.

## Failure behavior

Any required check failure sets `validation_passed` to false, records only a
generic aggregate error, and makes the production CLI exit nonzero. Exact
duplicate rows may be reported as an aggregate count, but are not interpreted
as duplicate participants because the raw participant identifier is correctly
absent.

There is no fallback dataset, synthetic production mode, raw LASI access,
participant-level export, or automatic Git commit. Tests use only clearly
synthetic fixtures created in temporary directories.
