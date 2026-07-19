"""
main.py — HealthGuard AI Health-Intelligence FastAPI Service
=============================================================
At startup this service attempts to load a trained model artifact from:
    health-intelligence/models/diabetes_model.joblib

If the artifact loads successfully AND its metadata declares a recognised
lifecycle_status (RESEARCH_ONLY or VALIDATION_CANDIDATE), the evaluate
endpoint uses the model to compute a screening probability.

If loading fails for any reason (file absent, corrupted, unrecognised
lifecycle state, inference error), the endpoint falls back to the same
"model-unavailable" response as before — it never crashes and never guesses.

The response schema/shape is identical in both branches; only the values of
"status", "screeningProbability", and "reasonCodes" differ.
"""

import json
import logging
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

log = logging.getLogger(__name__)

app = FastAPI(title="HealthGuard AI - Health Intelligence Service", version="2.0.0")

# ---------------------------------------------------------------------------
# Accepted lifecycle states that permit model use in responses
# ---------------------------------------------------------------------------
_ACCEPTED_LIFECYCLE_STATES = {"RESEARCH_ONLY", "VALIDATION_CANDIDATE"}

# ---------------------------------------------------------------------------
# Model loading — attempted once at module import time, fails silently.
# Paths are resolved relative to this file so the service works regardless
# of the caller's working directory.
# ---------------------------------------------------------------------------
_APP_DIR    = Path(__file__).resolve().parent   # health-intelligence/app/
_HI_DIR     = _APP_DIR.parent                   # health-intelligence/
_MODEL_PATH    = _HI_DIR / "models" / "diabetes_model.joblib"
_METADATA_PATH = _HI_DIR / "models" / "diabetes_model_metadata.json"

_model = None
_model_metadata: dict = {}
_model_installed: bool = False

try:
    import joblib as _joblib

    _loaded = _joblib.load(str(_MODEL_PATH))
    with open(str(_METADATA_PATH), "r", encoding="utf-8") as _f:
        _loaded_meta = json.load(_f)

    _lifecycle = _loaded_meta.get("lifecycle_status", "")
    if _lifecycle not in _ACCEPTED_LIFECYCLE_STATES:
        raise ValueError(
            f"Rejected: lifecycle_status='{_lifecycle}' is not in "
            f"accepted states {_ACCEPTED_LIFECYCLE_STATES}."
        )

    _model = _loaded
    _model_metadata = _loaded_meta
    _model_installed = True
    log.info(
        "Model loaded. lifecycle=%s sample_size=%s",
        _lifecycle, _loaded_meta.get("sample_size"),
    )

except FileNotFoundError:
    log.info(
        "No model artifact at %s — service will return model-unavailable.", _MODEL_PATH
    )
except Exception as _load_exc:
    log.warning(
        "Model load failed (%s) — service will return model-unavailable.", _load_exc
    )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

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
    # BP and glucose fields are Optional — no fabricated defaults
    systolicBP: Optional[float] = None
    diastolicBP: Optional[float] = None
    heartRate: Optional[float] = None
    fastingBloodSugar: Optional[float] = None
    schemaVersion: str = "2.0.0"

class LabObservation(BaseModel):
    code: str
    value: float
    unit: str
    observedAt: str
    isVerified: bool = False
    verifiedBy: Optional[str] = None

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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def get_health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "service": "health-intelligence",
        "process": "running",
        "model_installed": _model_installed,
        "message": (
            "Research model loaded (RESEARCH_ONLY). Not for clinical use."
            if _model_installed
            else "Service process is running. No approved research model is installed."
        ),
    }

@app.get("/ready")
def get_ready():
    return {
        "status": "ok",
        "ready": False,
        "reason": "APPROVED_MODEL_NOT_INSTALLED",
        "reasonCode": "APPROVED_MODEL_NOT_INSTALLED",
    }

@app.get("/models")
def get_models():
    return {
        "active_models": {
            "diabetes": {
                "status": "loaded" if _model_installed else "unloaded",
                "lifecycle_status": _model_metadata.get("lifecycle_status", "none"),
            }
        }
    }

@app.post("/v1/modules/diabetes/evaluate")
def evaluate_diabetes(context: HealthContext):
    # ------------------------------------------------------------------
    # Model-available branch — compute probability from loaded artifact
    # ------------------------------------------------------------------
    if _model is not None and _model_installed:
        try:
            import numpy as np
            import pandas as pd

            a = context.assessment
            bmi = (
                a.weightKg / ((a.heightCm / 100.0) ** 2)
                if a.heightCm and a.weightKg
                else None
            )
            sex_numeric = 1.0 if a.gender.lower() in ("female", "f") else 0.0

            feature_row = {
                "age_years":   float(a.age),
                "bmi":         float(bmi) if bmi is not None else float("nan"),
                "waist_cm":    float("nan"),   # not captured in V2 assessment schema
                "systolic_bp": float(a.systolicBP) if a.systolicBP is not None else float("nan"),
                "diastolic_bp": float(a.diastolicBP) if a.diastolicBP is not None else float("nan"),
                "sex":         sex_numeric,
            }

            X_input = pd.DataFrame([feature_row])

            # Fill NaN features with medians stored in the training metadata.
            # waist_cm (not collected in V2) will always use the training median.
            training_medians = _model_metadata.get("training_medians", {})
            for col in X_input.columns:
                if X_input[col].isna().any() and col in training_medians:
                    X_input[col] = X_input[col].fillna(training_medians[col])

            prob = float(_model.predict_proba(X_input)[0][1])

            used    = [k for k, v in feature_row.items() if v == v]   # not NaN
            missing = [k for k, v in feature_row.items() if v != v]   # NaN

            return {
                "moduleId":             "diabetes-screening",
                "moduleVersion":        _model_metadata.get("training_date", "unassigned"),
                "status":               "complete",
                "resultType":           "screening-signal",
                "source":               "research-model",
                "evidenceSupport":      "research-only",
                "reasonCodes":          ["RESEARCH_ONLY_MODEL"],
                "screeningProbability": prob,
                "usedEvidence":         used,
                "missingEvidence":      missing,
                "limitations": [
                    "RESEARCH_ONLY: not validated for clinical use",
                    "Small sample — estimates may have high variance",
                    "No external validation cohort available",
                    "Regional sample — national representativeness not established",
                ],
                "nextSteps": [
                    "CONSULT_HEALTHCARE_PROVIDER",
                    "LABORATORY_CONFIRMATION_RECOMMENDED",
                ],
            }
        except Exception as exc:
            log.warning("Inference failed (%s) — returning model-unavailable.", exc)

    # ------------------------------------------------------------------
    # Model-unavailable fallback — identical shape as before, always safe
    # ------------------------------------------------------------------
    return {
        "moduleId":      "diabetes-screening",
        "moduleVersion": "unassigned",
        "status":        "model-unavailable",
        "resultType":    "screening-signal",
        "source":        "research-model",
        "evidenceSupport": "insufficient",
        "reasonCodes":   ["APPROVED_MODEL_NOT_INSTALLED"],
        "usedEvidence":  [],
        "missingEvidence": [],
        "limitations": [
            "NO_APPROVED_MODEL_ARTIFACT",
            "RESEARCH_PIPELINE_PENDING",
        ],
        "nextSteps": [
            "CONTINUE_WITH_NON_ML_EVIDENCE_MODULES"
        ],
    }
