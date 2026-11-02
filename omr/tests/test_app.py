import json
import warnings

import cv2
from starlette.exceptions import StarletteDeprecationWarning

# FastAPI 0.141 emits this compatibility warning before TestClient is imported;
# it is external to the API behavior covered here and is scoped by message.
warnings.filterwarnings(
    "ignore",
    message=r"Using `httpx` with `starlette\.testclient` is deprecated.*",
    category=StarletteDeprecationWarning,
)
from fastapi.testclient import TestClient
import numpy as np
import pytest

from app import app, get_recognition_service


class StubRecognitionService:
    def __init__(self):
        self.calls = []

    def recognize(
        self,
        image,
        answer_key=None,
        low_confidence_threshold=None,
        erasure_threshold=None,
    ):
        self.calls.append((image, answer_key, low_confidence_threshold, erasure_threshold))
        return {
            "status": "scored" if answer_key is not None else "recognized",
            "bubble_count": 410,
            "item_count": 100,
            "items": [],
        }


@pytest.fixture
def api_client():
    service = StubRecognitionService()
    app.dependency_overrides[get_recognition_service] = lambda: service
    with TestClient(app) as client:
        yield client, service
    app.dependency_overrides.clear()


def png_bytes() -> bytes:
    success, encoded = cv2.imencode(".png", np.full((40, 40, 3), 255, dtype=np.uint8))
    assert success
    return encoded.tobytes()


def test_recognize_endpoint_decodes_image_and_returns_report(api_client):
    client, service = api_client

    response = client.post(
        "/recognize",
        files={"file": ("sheet.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "recognized"
    assert response.json()["bubble_count"] == 410
    assert len(service.calls) == 1
    assert service.calls[0][0].shape == (40, 40, 3)


def test_recognize_endpoint_passes_serialized_answer_key(api_client):
    client, service = api_client
    key = {"id": 7, "passing_score": 75, "items": []}

    response = client.post(
        "/recognize",
        files={"file": ("sheet.png", png_bytes(), "image/png")},
        data={"answer_key": json.dumps(key), "answer_key_id": "7"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "scored"
    assert service.calls[0][1] == key


def test_recognize_endpoint_rejects_id_without_key(api_client):
    client, service = api_client

    response = client.post(
        "/recognize",
        files={"file": ("sheet.png", png_bytes(), "image/png")},
        data={"answer_key_id": "7"},
    )

    assert response.status_code == 422
    assert "JSON is required" in response.json()["detail"]
    assert service.calls == []


def test_recognize_endpoint_rejects_non_image(api_client):
    client, service = api_client

    response = client.post(
        "/recognize",
        files={"file": ("sheet.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 415
    assert service.calls == []


def test_recognize_endpoint_rejects_oversized_answer_key(api_client):
    client, service = api_client

    response = client.post(
        "/recognize",
        files={"file": ("sheet.png", png_bytes(), "image/png")},
        data={"answer_key": "x" * (1024 * 1024 + 1)},
    )

    # Starlette's multipart parser may reject the part at 400 before the
    # endpoint's explicit 413 guard runs; both prevent model execution.
    assert response.status_code in {400, 413}
    assert service.calls == []
