# LASI Hypertension Target-Policy Decision

## Status

`target_policy_approved: true`  
`approved_primary_policy: last_two_pairs_mean`

Manual review has approved `last_two_pairs_mean` as the primary target policy. The historical comparison manifest remains unchanged with `target_policy_approved: false` because it records the state when the comparison ran, before this approval.

## Shared eligibility and measurement rules

- Include respondents aged 45 or older only when `ht002 == 2` indicates no previous hypertension diagnosis.
- Exclude diagnosed and unknown diagnosis responses. A structurally missing `ht002c` does not exclude a respondent whose `ht002` is 2.
- A BP attempt is a pair: `bm006/bm007`, `bm010/bm011`, or `bm014/bm015`. Systolic and diastolic values are never combined across attempts.
- Values must be numeric, finite, and positive to form a pair. Extreme positive values are retained and reported through aggregate quality review rather than silently clipped or deleted.
- Every policy defines a positive target as representative systolic BP ≥140 or representative diastolic BP ≥90.
- Policy D currently uses explicit constants `bm001 == 1` for accepted consent and `bm022 == 1` for accepted compliance. Their exact codebook interpretation requires manual confirmation before approval.

## Compared policies

| Policy | Representative measurement | Additional requirements | Decision |
|---|---|---|---|
| A: `all_valid_pairs_mean` | Mean across the same valid paired attempts | At least two complete pairs | Pending |
| B: `last_two_pairs_mean` | Mean of pairs 2 and 3 | Both pairs complete and valid | **Approved primary policy** |
| C: `lasi_provided_last_two_average` | LASI-provided `bm017` and `bm018` | Both supplied averages valid | Pending |
| D: `strict_compliant_last_two` | Policy B | Accepted consent and full compliance | Pending |

## Decision principles

Target selection must be based on measurement validity, semantic fidelity, constructibility, agreement, and governance review. Model performance must not influence target selection.

## Approved primary definition

- Require complete valid pair 2 (`bm010`, `bm011`) and pair 3 (`bm014`, `bm015`).
- Representative systolic BP is the mean of `bm010` and `bm014`.
- Representative diastolic BP is the mean of `bm011` and `bm015`.
- The target is positive when representative systolic BP is at least 140 **or** representative diastolic BP is at least 90.
- Eligibility requires `dm005 >= 45` and `ht002` indicating no previous hypertension diagnosis.
- Missing `ht002c` does not exclude a respondent whose `ht002` indicates no previous diagnosis.
- The first reading (`bm006`, `bm007`) is excluded from the primary definition.
- LASI-provided averages (`bm017`, `bm018`) remain validation evidence rather than primary target sources.

## Manual-review rationale

- Policy B retained 43,022 of 43,135 eligible respondents.
- Its unweighted prevalence was 29.217610%, and its nationally weighted descriptive prevalence was 27.274503%.
- Policies B and C had 100% classification agreement across 43,022 comparable participants.
- Recomputed and supplied systolic and diastolic averages differed by less than 1 mmHg for every comparable record.
- Policy A had 96.411138% agreement with Policy B and produced higher prevalence, supporting exclusion of the first reading from the primary target.
- Policy D produced nearly unchanged prevalence and remains a quality sensitivity analysis.
- In this audit run, respondents had either zero or three complete valid BP pairs; no one-pair or two-pair patterns occurred. This is an observed audit pattern, not a universal LASI guarantee.

Sensitivity policies remain `all_valid_pairs_mean`, `lasi_provided_last_two_average`, and `strict_compliant_last_two`.

## Pending manual decisions

- Confirm the accepted `bm001` consent and `bm022` compliance codes against the approved LASI codebook.
- Confirm whether nonpositive values are documented special codes and whether any additional special codes must be excluded.
- Confirm future cohort-builder implementation imports the authoritative policy constant rather than redeclaring the policy.

## Final manual approval

- Approved policy: **`last_two_pairs_mean`**
- Approval basis: **manual review of the aggregate Phase 2 audit results**

Approval was a separate manual decision; running the comparison or validator alone never approves a target policy.
