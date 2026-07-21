# Hypertension Product Safety Contract — Phase 0

## 1. Purpose

This contract defines conservative routing and language boundaries for a
future multimodel hypertension assessment module. It is a conceptual product
contract for later backend and frontend implementation, not finalized API code
or a JSON schema.

The module is non-diagnostic. It must not prescribe medication, advise a user
to change treatment, or imply that profile-model output is equivalent to a BP
measurement or clinician assessment.

## 2. Mandatory routing precedence

The system must resolve routes in this order:

1. **Emergency safety override**
2. **Known hypertension or antihypertensive medication**
3. **Repeated confirmed BP evidence**
4. **Single confirmed BP evidence**
5. **LASI profile-screening model**
6. **General recommendation to obtain BP measurement**

An earlier route always takes precedence over a later route. The profile model
must never override confirmed BP evidence, known-hypertension status, treatment
status, or emergency safety logic.

## 3. Assessment routes

### A. Profile-screening route

This route is permitted only when all of the following hold:

- the user is within the validated age range;
- no usable confirmed BP evidence is available;
- the user reports no hypertension diagnosis;
- the user reports no antihypertensive medication;
- required profile inputs are sufficient; and
- the research model and its approved metadata are available.

Its output is a screening signal for prioritising BP measurement. It is not a
probability of diagnosis and must not be described as one. Users below the
validated age range must not receive a model probability or model-derived risk
tier.

### B. BP-evidence route

Measured BP is direct evidence and must never be sent into the profile model.
Repeated confirmed readings take precedence over a single confirmed reading.
Interpretation rules, repeat-measurement advice, and escalation language must
be deterministic, clinically reviewed, and separate from ML output.

Uploaded-report extraction requires deterministic validation of document
structure, analyte/measurement identity, units, plausible ranges, and parsing
confidence. Extracted readings require explicit user confirmation before
interpretation. Low-confidence or ambiguous extraction must result in an
awaiting-confirmation or insufficient-evidence state, never a clinical
conclusion.

### C. Known-hypertension/management route

A reported hypertension diagnosis or antihypertensive medication routes the
user away from undiagnosed screening. The product may provide conservative
management-oriented prompts—such as continuing clinician-directed monitoring
and seeking professional review—but must not score the undiagnosed target,
alter treatment, or infer disease control from symptoms.

## 4. Emergency and symptom safety

Emergency conditions bypass every ML model. Deterministic safety logic must
provide urgent guidance when approved emergency combinations are present.
Exact triggers require separate clinical approval and must not be invented by
the model.

Symptoms must not be used to rule out hypertension. Absence of headache,
dizziness, chest discomfort, or other symptoms is not evidence of normal BP.
Symptoms also must not be converted into a diagnosis by the profile model.

## 5. Permitted user-facing states

| State | Meaning and permitted action |
|---|---|
| `elevated-screening-signal` | Eligible profile result is above a manually approved screening threshold; recommend obtaining a validated BP measurement. |
| `below-screening-threshold` | Eligible profile result is below that threshold; explain that hypertension is not ruled out and routine BP measurement remains appropriate. |
| `outside-model-age-range` | User is outside the validated age scope; suppress model probability and recommend standard measurement-based assessment. |
| `insufficient-input` | Required routing or profile evidence is missing or invalid; do not score. |
| `bp-evidence-available` | Confirmed BP evidence exists and the deterministic BP route applies. |
| `awaiting-bp-confirmation` | Extracted or entered BP evidence requires user confirmation before interpretation. |
| `known-hypertension-management-route` | Diagnosis or medication status makes undiagnosed screening inappropriate. |
| `urgent-safety-guidance` | Approved emergency safety conditions take precedence over assessment. |
| `model-unavailable` | Model, metadata, threshold, or validation requirements failed; provide no model score and recommend BP measurement. |

These states are routing outcomes, not diagnoses.

## 6. Language contract

### Examples of safe wording

- **Profile screening:** “Your profile shows an elevated screening signal. This
  does not diagnose hypertension. A validated blood-pressure measurement is
  the appropriate next step.”
- **Below threshold:** “Your profile is below this research screening
  threshold, but hypertension cannot be ruled out without measuring your blood
  pressure.”
- **Confirmed evidence:** “You entered a confirmed blood-pressure reading. We
  will use that measurement-based route rather than the profile model.”
- **Awaiting confirmation:** “A possible blood-pressure reading was extracted
  from your report. Please confirm the values and units before interpretation.”
- **Known hypertension:** “Because you reported diagnosed hypertension or
  blood-pressure medication, the undiagnosed screening model is not
  appropriate. Continue clinician-directed monitoring and care.”
- **Outside range:** “This profile model has not been validated for your age
  range, so no model probability is shown.”
- **Unavailable:** “The screening model is unavailable. No score was produced;
  consider obtaining a validated blood-pressure measurement.”

### Prohibited wording

- “You have hypertension.”
- “You do not have hypertension.”
- “Your symptoms prove your blood pressure is normal.”
- “The AI reading is more reliable than your confirmed BP measurement.”
- “You can stop, start, or change your blood-pressure medicine.”
- “Your uploaded report confirms hypertension” before deterministic validation
  and user confirmation.
- “Your risk is low, so you do not need to measure your blood pressure.”
- Any diagnostic percentage or guarantee derived from the profile model.

## 7. Conceptual unified response contract

A later backend design should provide a consistent non-diagnostic response
concept containing fields such as:

| Conceptual field | Purpose |
|---|---|
| `disease` | Identifies the hypertension assessment domain. |
| `assessment_route` | Names profile screening, BP evidence, known-management, emergency, or fallback routing. |
| `target_name` | Uses `undiagnosed_elevated_bp_screening_target` only when applicable. |
| `diagnostic` | Always `false` for this module. |
| `eligibility` | Aggregate eligibility state and non-sensitive reason codes. |
| `profile_screening` | Optional screening status; omitted or unavailable outside the eligible profile route. |
| `bp_evidence` | Confirmation and deterministic evidence status, kept separate from profile features. |
| `safety_status` | Emergency, caution, or routine safety routing. |
| `recommended_action` | Conservative next action without diagnosis or treatment alteration. |

This table is a conceptual contract only. Field types, enumerations, versioning,
and transport representation require later backend review. It must not be
treated as finalized API schema.

## 8. Fail-safe requirements

- Missing or malformed routing evidence must not default to an eligible profile
  score.
- Model, metadata, or threshold failures return `model-unavailable` without an
  uncontextualized probability.
- Report extraction failure cannot fall through to a clinical conclusion.
- Confirmed BP values are never copied into profile-model features.
- No route may expose report text, participant records, or model-development
  identifiers.
- No final model or threshold is approved automatically.

## 9. Phase 0 safety exit checklist

- [x] Target name and non-diagnostic status approved.
- [x] Intended use and age scope approved.
- [x] Emergency-to-fallback route precedence approved.
- [x] Profile-model forbidden predictors approved.
- [x] Locked-test and aggregate-output policy approved.
- [x] Report extraction and confirmed BP kept separate from profile modelling.
- [x] Exact LASI BP-reading aggregation intentionally deferred.
- [x] No model training, threshold selection, API implementation, or deployment
  performed.
