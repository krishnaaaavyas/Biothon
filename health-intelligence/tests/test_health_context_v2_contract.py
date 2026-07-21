"""Synthetic contract checks shared with the TypeScript Health Engine V2."""

from app.schemas.health_context import (
    HEALTH_CONTEXT_SCHEMA_VERSION,
    HEALTH_MODULE_STATUSES,
    SAFETY_FLAG_TYPES,
    SCREENING_SIGNALS,
    HealthContext,
)


def _context(**assessment_overrides):
    assessment = {
        "age": 55,
        "gender": "female",
        "heightCm": 165,
        "weightKg": 70,
        "smoking": "never",
        "exercise": "moderate",
        **assessment_overrides,
    }
    return HealthContext.parse_obj({
        "userId": "synthetic-contract-user",
        "assessment": assessment,
        "labObservations": [{
            "code": "synthetic-test",
            "value": 1.0,
            "unit": "test-unit",
            "observedAt": "2026-01-01T00:00:00Z",
            "isVerified": True,
        }],
        "regionalContext": {},
    })


def test_canonical_schema_version_and_missing_value_behavior():
    context = _context()
    assert HEALTH_CONTEXT_SCHEMA_VERSION == "2.0.0"
    assert context.schemaVersion == "2.0.0"
    assert context.assessment.schemaVersion == "2.0.0"
    assert context.assessment.knownHypertension is None
    assert context.assessment.takingAntihypertensiveMedication is None
    assert context.assessment.familyHistoryHypertension is None
    assert context.assessment.systolicBP is None


def test_status_and_screening_signal_contract():
    assert set(HEALTH_MODULE_STATUSES) == {
        "completed", "model-unavailable", "outside-intended-population",
        "insufficient-information", "measurement-requires-verification",
        "conflicting-evidence", "failed", "insufficient-data", "unavailable",
    }
    assert set(SCREENING_SIGNALS) == {
        "elevated-screening-signal", "below-screening-threshold",
        "blood-pressure-measurement-recommended", "no-profile-screening-prompt",
        "not-evaluated",
    }
    assert set(SAFETY_FLAG_TYPES) == {"red-flag", "contraindication", "data-anomaly"}


def test_lab_verification_contract_is_not_promoted_to_clinician_verified():
    observation = _context().labObservations[0]
    assert observation.userConfirmed is True
    assert observation.verifiedByClinician is False
    assert observation.verificationStatus == "user-confirmed"
    assert observation.plausibleRangePassed is True
