"""Bubble-classifier architecture, preprocessing, and checkpoint loading.

The production model consumes a 44x44 grayscale crop for one printed bubble and
returns logits for the checkpoint's ordered classes. Keep the architecture here
stable: changing module order or dimensions invalidates existing checkpoints.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
from pathlib import Path
from typing import Any, Sequence

import cv2
import numpy as np
import torch
from torch import nn

CROP_SIZE = 44
MODEL_NAME = "BubbleCNN"
SHA256_HEX_LENGTH = 64


class BubbleCNN(nn.Module):
    """Compact CNN used by the three-class TMC bubble classifier."""

    def __init__(self, num_classes: int) -> None:
        super().__init__()
        if num_classes < 2:
            raise ValueError("num_classes must be at least 2")

        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.Conv2d(16, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.Conv2d(32, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1)),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.2),
            nn.Linear(64, num_classes),
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(inputs))


@dataclass(frozen=True)
class LoadedBubbleModel:
    """A validated model plus the metadata required to interpret its logits."""

    model: BubbleCNN
    classes: tuple[str, ...]
    checkpoint_path: Path
    checkpoint_sha256: str
    best_epoch: int | None
    seed: int | None
    class_weights: tuple[float, ...] | None


def file_sha256(path: str | Path) -> str:
    """Return a lowercase SHA-256 digest without loading the whole file."""
    digest = sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _model_card_digest(value: Any, field: str) -> str:
    """Validate and normalize one SHA-256 value from a model card."""
    if not isinstance(value, str) or len(value) != SHA256_HEX_LENGTH:
        raise ValueError(f"model card field {field!r} must be a 64-character SHA-256 digest")
    try:
        int(value, 16)
    except ValueError as exc:
        raise ValueError(f"model card field {field!r} is not hexadecimal") from exc
    return value.lower()


def load_model_card(model_card_path: str | Path) -> dict[str, Any]:
    """Load a model card and require its artifact-provenance fields."""
    path = Path(model_card_path)
    try:
        card = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"could not load model card {path}: {exc}") from exc
    if not isinstance(card, dict):
        raise ValueError(f"model card root must be an object: {path}")
    if not isinstance(card.get("dataset"), dict):
        raise ValueError("model card field 'dataset' must be an object")
    _model_card_digest(card.get("checkpoint_sha256"), "checkpoint_sha256")
    _model_card_digest(card["dataset"].get("manifest_sha256"), "dataset.manifest_sha256")
    return card


def verify_checkpoint_model_card(
    model_card_path: str | Path,
    checkpoint_path: str | Path,
) -> dict[str, Any]:
    """Require checkpoint bytes and architecture to match the model card."""
    card = load_model_card(model_card_path)
    expected = _model_card_digest(card["checkpoint_sha256"], "checkpoint_sha256")
    actual = file_sha256(checkpoint_path)
    if actual != expected:
        raise RuntimeError(
            "checkpoint SHA-256 mismatch: "
            f"model card expects {expected}, got {actual}"
        )
    if card.get("architecture") != MODEL_NAME:
        raise ValueError(
            f"model card architecture must be {MODEL_NAME!r}, got {card.get('architecture')!r}"
        )
    return card


def verify_model_card_hashes(
    model_card_path: str | Path,
    checkpoint_path: str | Path,
    manifest_path: str | Path,
) -> dict[str, Any]:
    """Verify checkpoint and dataset manifest bytes against the model card."""
    card = verify_checkpoint_model_card(model_card_path, checkpoint_path)
    expected = _model_card_digest(
        card["dataset"]["manifest_sha256"], "dataset.manifest_sha256"
    )
    actual = file_sha256(manifest_path)
    if actual != expected:
        raise RuntimeError(
            "manifest SHA-256 mismatch: "
            f"model card expects {expected}, got {actual}"
        )
    return card


def bubble_to_tensor(image: np.ndarray) -> torch.Tensor:
    """Convert an OpenCV bubble crop to the model's 1x44x44 float tensor.

    Dataset crops are grayscale PNG files. Production extraction may hand this
    function a grayscale, BGR, or BGRA array; all paths deliberately converge on
    the same grayscale resize and [0, 1] scaling used for checkpoint evaluation.
    """
    if not isinstance(image, np.ndarray) or image.size == 0:
        raise ValueError("bubble crop must be a non-empty numpy array")

    if image.ndim == 2:
        gray = image
    elif image.ndim == 3 and image.shape[2] == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    elif image.ndim == 3 and image.shape[2] == 4:
        gray = cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    else:
        raise ValueError(f"unsupported bubble crop shape: {image.shape}")

    if gray.dtype != np.uint8:
        raise ValueError(f"bubble crop must use uint8 pixels, got {gray.dtype}")
    if gray.shape != (CROP_SIZE, CROP_SIZE):
        gray = cv2.resize(gray, (CROP_SIZE, CROP_SIZE), interpolation=cv2.INTER_AREA)

    contiguous = np.ascontiguousarray(gray)
    return torch.from_numpy(contiguous).float().div_(255.0).unsqueeze(0)


def resolve_device(requested: str = "auto") -> torch.device:
    """Resolve ``auto`` to CUDA when available, otherwise CPU."""
    if requested == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    device = torch.device(requested)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise ValueError("CUDA was requested but is not available")
    return device


def _required(checkpoint: dict[str, Any], key: str) -> Any:
    if key not in checkpoint:
        raise ValueError(f"checkpoint is missing required field {key!r}")
    return checkpoint[key]


def _validate_classes(value: Any, num_classes: int) -> tuple[str, ...]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise ValueError("checkpoint classes must be an ordered sequence")
    classes = tuple(str(item) for item in value)
    if len(classes) != num_classes or len(set(classes)) != len(classes):
        raise ValueError("checkpoint classes must be unique and match num_classes")
    return classes


def load_bubble_model(
    checkpoint_path: str | Path,
    device: str | torch.device = "cpu",
) -> LoadedBubbleModel:
    """Safely load and validate a ``BubbleCNN`` checkpoint for inference."""
    path = Path(checkpoint_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"model checkpoint not found: {path}")

    target = resolve_device(device) if isinstance(device, str) else device
    try:
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    except Exception as exc:
        raise ValueError(f"could not load checkpoint {path}: {exc}") from exc
    if not isinstance(checkpoint, dict):
        raise ValueError("checkpoint root must be a dictionary")
    if _required(checkpoint, "model") != MODEL_NAME:
        raise ValueError(f"unsupported checkpoint model: {checkpoint['model']!r}")

    num_classes = int(_required(checkpoint, "num_classes"))
    classes = _validate_classes(_required(checkpoint, "classes"), num_classes)
    state_dict = _required(checkpoint, "state_dict")
    if not isinstance(state_dict, dict):
        raise ValueError("checkpoint state_dict must be a dictionary")

    model = BubbleCNN(num_classes=num_classes)
    try:
        model.load_state_dict(state_dict, strict=True)
    except RuntimeError as exc:
        raise ValueError(f"checkpoint weights do not match {MODEL_NAME}: {exc}") from exc
    model.to(target).eval()

    raw_weights = checkpoint.get("class_weights")
    class_weights = None if raw_weights is None else tuple(float(weight) for weight in raw_weights)
    if class_weights is not None and len(class_weights) != num_classes:
        raise ValueError("checkpoint class_weights must match num_classes")

    return LoadedBubbleModel(
        model=model,
        classes=classes,
        checkpoint_path=path,
        checkpoint_sha256=file_sha256(path),
        best_epoch=int(checkpoint["best_epoch"]) if checkpoint.get("best_epoch") is not None else None,
        seed=int(checkpoint["seed"]) if checkpoint.get("seed") is not None else None,
        class_weights=class_weights,
    )
