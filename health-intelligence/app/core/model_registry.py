"""Strict, fail-closed registry for the approved hypertension artifact."""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .artifact_integrity import sha256_file


MODEL_VERSION = "lasi_hypertension_v1"
MODEL_FILENAME = f"{MODEL_VERSION}.joblib"
METADATA_FILENAME = f"{MODEL_VERSION}_metadata.json"
SHA256_FILENAME = f"{MODEL_VERSION}_sha256.json"
APPROVED_CONFIGURATION = "D_logistic_regression"
APPROVED_THRESHOLD = 0.23965717645991863
APPROVED_FEATURES = (
    "age",
    "height_cm",
    "weight_kg",
    "sex",
    "family_history_hypertension",
    "physical_activity_category",
    "smoking_category",
)

DIRECTORY_NOT_CONFIGURED = "HYPERTENSION_MODEL_DIRECTORY_NOT_CONFIGURED"
ARTIFACT_MISSING = "HYPERTENSION_MODEL_ARTIFACT_MISSING"
METADATA_INVALID = "HYPERTENSION_MODEL_METADATA_INVALID"
CHECKSUM_INVALID = "HYPERTENSION_MODEL_CHECKSUM_INVALID"
LOAD_FAILED = "HYPERTENSION_MODEL_LOAD_FAILED"

log = logging.getLogger(__name__)


@dataclass
class ModelState:
    name: str
    status: str = "unavailable"
    model: Optional[Any] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    reason: str = DIRECTORY_NOT_CONFIGURED

    @property
    def available(self) -> bool:
        return self.status == "loaded" and self.model is not None


def _require_equal(metadata: dict[str, Any], key: str, expected: Any) -> None:
    if metadata.get(key) != expected:
        raise ValueError(f"metadata mismatch: {key}")


def validate_hypertension_metadata(metadata: dict[str, Any]) -> None:
    if not isinstance(metadata, dict):
        raise ValueError("metadata must be an object")
    _require_equal(metadata, "model_version", MODEL_VERSION)
    _require_equal(metadata, "approval_status", "approved_with_restrictions")
    _require_equal(metadata, "configuration", APPROVED_CONFIGURATION)
    _require_equal(metadata, "features", list(APPROVED_FEATURES))
    _require_equal(metadata, "frozen_threshold", APPROVED_THRESHOLD)
    _require_equal(metadata, "no_exact_probability_display", True)
    _require_equal(metadata, "approved_for_screening_awareness", True)
    _require_equal(metadata, "approved_for_diagnosis", False)
    _require_equal(metadata, "approved_for_treatment_decisions", False)
    _require_equal(metadata, "artifact_filename", MODEL_FILENAME)


def load_hypertension_model(directory: Optional[Path] = None) -> ModelState:
    configured_text = (
        str(directory) if directory is not None
        else os.environ.get("HYPERTENSION_MODEL_DIR", "")
    )
    if not configured_text.strip():
        return ModelState(name="hypertension", reason=DIRECTORY_NOT_CONFIGURED)

    model_dir = Path(configured_text.strip()).expanduser()
    if not model_dir.is_dir():
        return ModelState(name="hypertension", reason=ARTIFACT_MISSING)

    model_path = model_dir / MODEL_FILENAME
    metadata_path = model_dir / METADATA_FILENAME
    checksum_path = model_dir / SHA256_FILENAME
    if not model_path.is_file():
        return ModelState(name="hypertension", reason=ARTIFACT_MISSING)
    if not checksum_path.is_file():
        return ModelState(name="hypertension", reason=CHECKSUM_INVALID)
    if not metadata_path.is_file():
        return ModelState(name="hypertension", reason=METADATA_INVALID)

    # Validate the checksum record and artifact bytes before deserialization.
    try:
        checksum = json.loads(checksum_path.read_text(encoding="utf-8"))
        _require_equal(checksum, "model_version", MODEL_VERSION)
        _require_equal(checksum, "artifact_filename", MODEL_FILENAME)
        expected_digest = checksum.get("sha256")
        if not isinstance(expected_digest, str) or not re.fullmatch(
            r"[0-9a-f]{64}", expected_digest
        ):
            raise ValueError("checksum record is invalid")
        actual_digest = sha256_file(model_path)
        if actual_digest != expected_digest:
            raise ValueError("artifact checksum mismatch")
    except Exception:
        return ModelState(name="hypertension", reason=CHECKSUM_INVALID)

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        validate_hypertension_metadata(metadata)
    except Exception:
        return ModelState(name="hypertension", reason=METADATA_INVALID)
    if metadata.get("artifact_sha256") != actual_digest:
        return ModelState(name="hypertension", reason=CHECKSUM_INVALID)

    try:
        import joblib

        model = joblib.load(model_path)
        if not callable(getattr(model, "predict_proba", None)):
            raise ValueError("artifact does not support probability inference")
        fitted_feature_order = getattr(model, "feature_names_in_", None)
        if fitted_feature_order is None or list(fitted_feature_order) != list(APPROVED_FEATURES):
            raise ValueError("artifact fitted feature order mismatch")
    except Exception:
        return ModelState(name="hypertension", reason=LOAD_FAILED)

    return ModelState(
        name="hypertension",
        status="loaded",
        model=model,
        metadata=metadata,
        reason="AVAILABLE",
    )


hypertension_model_state = load_hypertension_model()
log.info("hypertension model %s: %s", hypertension_model_state.status, hypertension_model_state.reason)
