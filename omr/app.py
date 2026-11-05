"""Code Nexus OMR API: full-sheet recognition and optional scoring."""
from __future__ import annotations

from contextlib import asynccontextmanager
from collections import OrderedDict
from concurrent.futures import Future
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
from threading import Lock
from time import perf_counter
from typing import Any, Callable

import cv2
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
import numpy as np
from starlette.concurrency import run_in_threadpool
import torch

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
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,100}$")


class RecognitionRequestConflict(ValueError):
    """Raised when one request ID is reused with different input data."""


class RecognitionRequestCache:
    """Share in-flight and recent recognition results across HTTP retries."""

    def __init__(self, max_entries: int = 32) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be at least 1")
        self.max_entries = max_entries
        self._lock = Lock()
        self._entries: OrderedDict[str, tuple[str, Future[dict[str, Any]]]] = (
            OrderedDict()
        )

    def execute(
        self,
        request_id: str,
        fingerprint: str,
        callback: Callable[..., dict[str, Any]],
        *args: Any,
    ) -> dict[str, Any]:
        owner = False
        with self._lock:
            entry = self._entries.get(request_id)
            if entry is None:
                future: Future[dict[str, Any]] = Future()
                self._entries[request_id] = (fingerprint, future)
                owner = True
            else:
                existing_fingerprint, future = entry
                if existing_fingerprint != fingerprint:
                    raise RecognitionRequestConflict(
                        "request_id was already used for different input data"
                    )
                self._entries.move_to_end(request_id)

        if not owner:
            return future.result()

        try:
            report = callback(*args)
        except BaseException as exc:
            future.set_exception(exc)
            with self._lock:
                current = self._entries.get(request_id)
                if current is not None and current[1] is future:
                    del self._entries[request_id]
            raise

        future.set_result(report)
        with self._lock:
            self._entries.move_to_end(request_id)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)
        return report


recognition_requests = RecognitionRequestCache()


def _environment_path(name: str, default: Path) -> Path:
    value = os.getenv(name)
    return Path(value) if value else default


def _environment_float(name: str) -> float | None:
    value = os.getenv(name)
    return float(value) if value is not None else None


def _environment_positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < 1:
        raise ValueError(f"{name} must be at least 1")
    return value


@lru_cache(maxsize=1)
def configure_runtime() -> dict[str, int]:
    """Apply benchmarked CPU thread counts once per service process."""
    opencv_threads = _environment_positive_int("OMR_OPENCV_THREADS", 8)
    torch_threads = _environment_positive_int("OMR_TORCH_THREADS", 4)
    cv2.setNumThreads(opencv_threads)
    torch.set_num_threads(torch_threads)
    return {
        "opencv_threads": cv2.getNumThreads(),
        "torch_threads": torch.get_num_threads(),
    }


@lru_cache(maxsize=1)
def get_recognition_service() -> RecognitionService:
    """Load verified model and template artifacts once per service process."""
    configure_runtime()
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


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Warm immutable model and registration artifacts before serving traffic."""
    started = perf_counter()
    configure_runtime()
    resolver = application.dependency_overrides.get(
        get_recognition_service,
        get_recognition_service,
    )
    service = await run_in_threadpool(resolver)
    warmup = getattr(service, "warmup", None)
    if callable(warmup):
        await run_in_threadpool(warmup)
    application.state.model_loaded = True
    application.state.warmup_ms = round((perf_counter() - started) * 1000, 2)
    yield


app = FastAPI(title="Code Nexus OMR Service", version="0.2.0", lifespan=lifespan)


@app.get("/health")
def health():
    runtime = configure_runtime()
    return {
        "status": "ok",
        "service": "code-nexus-omr",
        "model_loaded": bool(getattr(app.state, "model_loaded", False)),
        "warmup_ms": getattr(app.state, "warmup_ms", None),
        **runtime,
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
    request_id: str | None = Form(default=None),
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
    if request_id is not None and not REQUEST_ID_PATTERN.fullmatch(request_id):
        raise HTTPException(
            status_code=422,
            detail="request_id must contain 1-100 letters, numbers, dots, colons, underscores, or hyphens",
        )

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
        if request_id is None:
            report = await run_in_threadpool(
                service.recognize,
                image,
                key_payload,
            )
        else:
            fingerprint = hashlib.sha256()
            fingerprint.update(contents)
            fingerprint.update(b"\0")
            fingerprint.update((answer_key or "").encode("utf-8"))
            fingerprint.update(b"\0")
            fingerprint.update(str(answer_key_id or "").encode("ascii"))
            report = await run_in_threadpool(
                recognition_requests.execute,
                request_id,
                fingerprint.hexdigest(),
                service.recognize,
                image,
                key_payload,
            )
    except RecognitionRequestConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
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
