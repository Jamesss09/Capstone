"""Code Nexus OMR API: full-sheet recognition and optional scoring."""
from __future__ import annotations

from functools import lru_cache
import json
import os
from pathlib import Path
from typing import Any

import cv2
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
import numpy as np
from starlette.concurrency import run_in_threadpool

from core.preprocess import TEMPLATE_JSON
from core.recognition import (
    DEFAULT_CHECKPOINT,
    DEFAULT_MODEL_CARD,
    DEFAULT_REFERENCE,
    RecognitionError,
    RecognitionService,
)
from core.scoring import ScoringError
from core.sheet_config import OPTION_COUNTS, SHEET_SECTIONS

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_ANSWER_KEY_BYTES = 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png"}

app = FastAPI(title="Code Nexus OMR Service", version="0.2.0")


def _environment_path(name: str, default: Path) -> Path:
    value = os.getenv(name)
    return Path(value) if value else default


def _environment_float(name: str) -> float | None:
    value = os.getenv(name)
    return float(value) if value is not None else None


@lru_cache(maxsize=1)
def get_recognition_service() -> RecognitionService:
    """Load verified model and template artifacts once per service process."""
    return RecognitionService(
        checkpoint_path=_environment_path("OMR_CHECKPOINT", DEFAULT_CHECKPOINT),
        model_card_path=_environment_path("OMR_MODEL_CARD", DEFAULT_MODEL_CARD),
        template_path=_environment_path("OMR_TEMPLATE", TEMPLATE_JSON),
        reference_path=_environment_path("OMR_REFERENCE", DEFAULT_REFERENCE),
        device=os.getenv("OMR_DEVICE", "cpu"),
        batch_size=int(os.getenv("OMR_BATCH_SIZE", "128")),
        low_confidence_threshold=_environment_float("OMR_LOW_CONFIDENCE_THRESHOLD"),
        erasure_threshold=_environment_float("OMR_ERASURE_THRESHOLD"),
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "code-nexus-omr",
        "model_loaded": get_recognition_service.cache_info().currsize == 1,
    }


@app.get("/sheet-config")
def sheet_config():
    """Return the expected section/option layout of the TMC answer sheet."""
    return {"sections": SHEET_SECTIONS, "option_counts": OPTION_COUNTS}


@app.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    answer_key: str | None = Form(default=None),
    answer_key_id: int | None = Form(default=None),
    service: RecognitionService = Depends(get_recognition_service),
) -> dict[str, Any]:
    """Recognize a JPEG/PNG sheet and score it when key JSON is supplied.

    ``answer_key`` is a multipart text field containing the serialized Laravel
    key with ``passing_score`` and all 100 ``items``. An ID alone is not enough:
    the Python service intentionally has no direct database access.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="file must be a JPEG or PNG image")
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=422, detail="uploaded image is empty")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="uploaded image exceeds 10 MB")

    key_payload: dict[str, Any] | None = None
    if answer_key is not None:
        if len(answer_key.encode("utf-8")) > MAX_ANSWER_KEY_BYTES:
            raise HTTPException(status_code=413, detail="answer_key exceeds 1 MB")
        try:
            parsed = json.loads(answer_key)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="answer_key is not valid JSON") from exc
        if not isinstance(parsed, dict):
            raise HTTPException(status_code=422, detail="answer_key must be a JSON object")
        key_payload = parsed
        payload_id = key_payload.get("answer_key_id", key_payload.get("id"))
        if answer_key_id is not None and payload_id not in (None, answer_key_id):
            raise HTTPException(
                status_code=422,
                detail="answer_key_id does not match the serialized answer_key",
            )
        if answer_key_id is not None and payload_id is None:
            key_payload["answer_key_id"] = answer_key_id
    elif answer_key_id is not None:
        raise HTTPException(
            status_code=422,
            detail="answer_key JSON is required for scoring; an ID alone cannot be resolved",
        )

    encoded = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=422, detail="uploaded file is not a readable image")
    if image.shape[0] * image.shape[1] > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=413, detail="decoded image exceeds 40 megapixels")

    try:
        report = await run_in_threadpool(
            service.recognize,
            image,
            key_payload,
        )
    except (RecognitionError, ScoringError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "filename": file.filename,
        "size_bytes": len(contents),
        **report,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5005)
