"""Shared API request schemas. Optional clinical context is never defaulted."""

import math
from typing import List, Literal, Optional

from pydantic import BaseModel, root_validator


class Assessment(BaseModel):
    age: int
    gender: str
    heightCm: float
    weightKg: float
    smoking: str
    exercise: str
    familyHistory: str = ""
    symptoms: str = ""
    alcohol: str = "never"
    sleepHours: float = 7.0
    systolicBP: Optional[float] = None
    diastolicBP: Optional[float] = None
    heartRate: Optional[float] = None
    fastingBloodSugar: Optional[float] = None
    knownHypertension: Optional[bool] = None
    takingAntihypertensiveMedication: Optional[bool] = None
    familyHistoryHypertension: Optional[bool] = None
    physicalActivityCategory: Optional[Literal["high", "moderate", "low"]] = None
    urgentSymptoms: Optional[bool] = None
    schemaVersion: str = "2.0.0"


class LabObservation(BaseModel):
    code: str
    value: Optional[float]
    unit: str
    observedAt: str
    isVerified: bool = False
    verifiedBy: Optional[str] = None
    source: Literal["ocr", "manual", "report", "unknown"] = "unknown"
    plausibleRangePassed: bool = False
    userConfirmed: bool = False
    unitConfirmed: bool = False
    verifiedByClinician: bool = False
    extractionConfidence: Optional[float] = None
    verificationStatus: Literal[
        "unreviewed", "user-confirmed", "clinician-verified"
    ] = "unreviewed"

    @root_validator(pre=False, skip_on_failure=True)
    def normalize_verification(cls, values):
        values["userConfirmed"] = bool(
            values.get("userConfirmed") or values.get("isVerified")
        )
        values["verifiedByClinician"] = bool(values.get("verifiedByClinician"))
        values["verificationStatus"] = (
            "clinician-verified" if values["verifiedByClinician"]
            else "user-confirmed" if values["userConfirmed"]
            else "unreviewed"
        )
        confidence = values.get("extractionConfidence")
        if confidence is not None and not 0 <= confidence <= 1:
            raise ValueError("extractionConfidence must be between 0 and 1")
        code = values.get("code", "").lower().strip().replace("-", "_").replace(" ", "_")
        value = values.get("value")
        trusted_ranges = {
            "fbs": (50.0, 400.0), "fasting_glucose": (50.0, 400.0),
            "fasting_blood_sugar": (50.0, 400.0), "fpg": (50.0, 400.0),
            "hba1c": (3.0, 18.0), "hb_a1c": (3.0, 18.0), "a1c": (3.0, 18.0),
        }
        bounds = trusted_ranges.get(code)
        values["plausibleRangePassed"] = bool(
            value is not None and math.isfinite(value) and
            ((bounds[0] <= value <= bounds[1]) if bounds else value >= 0)
        )
        return values


class RegionalContext(BaseModel):
    language: str = "en"
    preferredDietaryType: str = "vegetarian"
    stateOrRegionCode: str = "IN"
    customRegionalRules: List[str] = []
    schemaVersion: str = "2.0.0"


class HealthContext(BaseModel):
    userId: str
    assessment: Assessment
    labObservations: List[LabObservation] = []
    regionalContext: RegionalContext
    schemaVersion: str = "2.0.0"
