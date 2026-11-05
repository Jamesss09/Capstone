"""Production sheet recognition pipeline using template crops and BubbleCNN."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any, Sequence

import cv2
import numpy as np
import torch

from core.bubble_model import (
    LoadedBubbleModel,
    bubble_to_tensor,
    file_sha256,
    load_bubble_model,
    verify_checkpoint_model_card,
)
from core.extract import (
    BubbleCrop,
    EXPECTED_BUBBLE_COUNT,
    EXPECTED_ITEM_COUNT,
    extract_bubbles,
    load_template,
    refine_lattice,
)
from core.preprocess import SheetRegistrar, TEMPLATE_JSON
from core.scoring import normalize_answer_key, score_items

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHECKPOINT = ROOT / "models" / "final_three_class" / "best.pt"
DEFAULT_MODEL_CARD = ROOT / "models" / "final_three_class" / "model_card.json"
DEFAULT_REFERENCE = TEMPLATE_JSON.parent / "Answer_Key_Format.jpg"
DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.80
DEFAULT_ERASURE_THRESHOLD = 0.80
REQUIRED_CLASSES = ("shaded", "empty", "erasure_smudge")
CAPTURE_QUALITY_LONG_SIDE = 1200
MIN_BRIGHT_PIXEL_PERCENTILE = 120.0
MIN_FOCUS_SCORE = 100.0
MIN_LATTICE_ROW_COVERAGE = 0.80
MIN_LATTICE_RING_COVERAGE = 0.70


class RecognitionError(ValueError):
    """Raised when an image cannot be recognized safely."""


@dataclass(frozen=True)
class BubblePrediction:
    """Classifier output tied to its physical template position."""

    crop: BubbleCrop
    class_name: str
    confidence: float
    probabilities: dict[str, float]

    def as_dict(self) -> dict[str, Any]:
        return {
            "option": self.crop.letter,
            "classification": self.class_name,
            "confidence": self.confidence,
            "probabilities": self.probabilities,
            "center": [self.crop.center_x, self.crop.center_y],
        }


@dataclass(frozen=True)
class RecognitionRun:
    """Serializable report plus data used only for optional debug rendering."""

    report: dict[str, Any]
    warped: np.ndarray
    crops: tuple[BubbleCrop, ...]
    predictions: tuple[BubblePrediction, ...]


def select_bubble_class(
    probabilities: dict[str, float],
    erasure_threshold: float = DEFAULT_ERASURE_THRESHOLD,
) -> tuple[str, float]:
    """Apply the validation-calibrated production decision policy."""
    if not 0 <= erasure_threshold <= 1:
        raise ValueError("erasure_threshold must be between 0 and 1")
    missing = set(REQUIRED_CLASSES) - set(probabilities)
    if missing:
        raise ValueError(f"probabilities are missing classes: {sorted(missing)}")
    if probabilities["erasure_smudge"] >= erasure_threshold:
        class_name = "erasure_smudge"
    elif probabilities["shaded"] >= probabilities["empty"]:
        class_name = "shaded"
    else:
        class_name = "empty"
    return class_name, float(probabilities[class_name])


def classify_bubbles(
    crops: Sequence[BubbleCrop],
    loaded: LoadedBubbleModel,
    batch_size: int = 128,
    erasure_threshold: float = DEFAULT_ERASURE_THRESHOLD,
) -> list[BubblePrediction]:
    """Classify crops using the validation-calibrated erasure threshold."""
    if not crops:
        raise RecognitionError("no bubble crops were provided")
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")
    if not 0 <= erasure_threshold <= 1:
        raise ValueError("erasure_threshold must be between 0 and 1")

    try:
        device = next(loaded.model.parameters()).device
    except StopIteration as exc:
        raise RecognitionError("bubble model has no parameters") from exc

    predictions: list[BubblePrediction] = []
    loaded.model.eval()
    with torch.inference_mode():
        for start in range(0, len(crops), batch_size):
            current = crops[start : start + batch_size]
            tensors = torch.stack([bubble_to_tensor(crop.image) for crop in current]).to(device)
            probabilities = torch.softmax(loaded.model(tensors), dim=1).cpu()
            for crop, row in zip(current, probabilities.tolist()):
                class_probabilities = {
                    name: float(row[index]) for index, name in enumerate(loaded.classes)
                }
                class_name, confidence = select_bubble_class(
                    class_probabilities, erasure_threshold
                )
                predictions.append(
                    BubblePrediction(
                        crop=crop,
                        class_name=class_name,
                        confidence=confidence,
                        probabilities=class_probabilities,
                    )
                )
    return predictions


def decide_items(
    predictions: Sequence[BubblePrediction],
    low_confidence_threshold: float = DEFAULT_LOW_CONFIDENCE_THRESHOLD,
) -> list[dict[str, Any]]:
    """Convert per-bubble classes into answers and invalid-state flags."""
    if not 0 <= low_confidence_threshold <= 1:
        raise ValueError("low_confidence_threshold must be between 0 and 1")

    grouped: dict[tuple[str, int], list[BubblePrediction]] = {}
    for prediction in predictions:
        key = (prediction.crop.section, prediction.crop.item_number)
        grouped.setdefault(key, []).append(prediction)

    items: list[dict[str, Any]] = []
    for (section, item_number), bubbles in grouped.items():
        bubbles = sorted(bubbles, key=lambda item: item.crop.option_index)
        letters = [bubble.crop.letter for bubble in bubbles]
        if len(letters) != len(set(letters)):
            raise RecognitionError(f"duplicate bubble options for {section} item {item_number}")

        shaded = [bubble for bubble in bubbles if bubble.class_name == "shaded"]
        smudges = [bubble for bubble in bubbles if bubble.class_name == "erasure_smudge"]
        flags: list[str] = []
        marked_answer: str | None = None

        if smudges:
            status = "invalid"
            flags.append("erasure")
            confidence = max(bubble.confidence for bubble in smudges)
        elif len(shaded) > 1:
            status = "invalid"
            flags.append("multi_shade")
            confidence = min(bubble.confidence for bubble in shaded)
        elif len(shaded) == 1:
            status = "answered"
            marked_answer = shaded[0].crop.letter
            confidence = shaded[0].confidence
            if confidence < low_confidence_threshold:
                flags.append("low_confidence")
        else:
            status = "blank"
            confidence = min(bubble.confidence for bubble in bubbles)

        items.append({
            "section": section,
            "item_number": item_number,
            "status": status,
            "marked_answer": marked_answer,
            "flags": flags,
            "confidence": confidence,
            "bubbles": [bubble.as_dict() for bubble in bubbles],
        })
    return items


def summarize_items(items: Sequence[dict[str, Any]]) -> dict[str, int]:
    """Return mobile-friendly counts for recognized item states and flags."""
    return {
        "answered": sum(item["status"] == "answered" for item in items),
        "blank": sum(item["status"] == "blank" for item in items),
        "invalid": sum(item["status"] == "invalid" for item in items),
        "multi_shade": sum("multi_shade" in item["flags"] for item in items),
        "erasure": sum("erasure" in item["flags"] for item in items),
        "low_confidence": sum("low_confidence" in item["flags"] for item in items),
    }


def analyze_capture_quality(image: np.ndarray) -> dict[str, float]:
    """Measure lighting and focus at a stable size before costly registration."""
    if not isinstance(image, np.ndarray) or image.size == 0:
        raise RecognitionError("uploaded image is empty")
    if image.ndim == 2:
        gray = image
    elif image.ndim == 3 and image.shape[2] == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    elif image.ndim == 3 and image.shape[2] == 4:
        gray = cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    else:
        raise RecognitionError(f"unsupported uploaded image shape: {image.shape}")

    long_side = max(gray.shape)
    if long_side > CAPTURE_QUALITY_LONG_SIDE:
        scale = CAPTURE_QUALITY_LONG_SIDE / long_side
        gray = cv2.resize(
            gray,
            None,
            fx=scale,
            fy=scale,
            interpolation=cv2.INTER_AREA,
        )

    bright_percentile = float(np.percentile(gray, 90))
    focus_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return {
        "bright_pixel_percentile": round(bright_percentile, 2),
        "focus_score": round(focus_score, 2),
    }


def validate_capture_image_quality(quality: dict[str, float]) -> None:
    """Reject captures whose lighting or focus cannot support safe recognition."""
    if quality["bright_pixel_percentile"] < MIN_BRIGHT_PIXEL_PERCENTILE:
        raise RecognitionError(
            "capture quality is too low: image is too dark; use brighter, even lighting and recapture"
        )
    if quality["focus_score"] < MIN_FOCUS_SCORE:
        raise RecognitionError(
            "capture quality is too low: image is too blurry; hold the phone steady and recapture"
        )


def capture_quality_warnings(
    registration: dict[str, Any], lattice: dict[str, Any]
) -> list[str]:
    """Reject registration or lattice alignment that cannot support safe scoring."""
    if registration.get("method") != "sift":
        raise RecognitionError(
            "capture quality is too low: printed content could not be aligned reliably; "
            "keep the entire page visible, hold the phone parallel, and recapture"
        )

    row_coverage = float(lattice.get("row_coverage", 0.0))
    ring_coverage = float(lattice.get("ring_coverage", 0.0))
    if (
        lattice.get("quality") != "good"
        or row_coverage < MIN_LATTICE_ROW_COVERAGE
        or ring_coverage < MIN_LATTICE_RING_COVERAGE
    ):
        raise RecognitionError(
            "capture quality is too low: printed bubble rows could not be aligned reliably; "
            "flatten the sheet, improve lighting, and recapture"
        )
    return []


def verify_pipeline_artifacts(
    model_card: dict[str, Any],
    template_path: str | Path,
    reference_path: str | Path,
) -> tuple[str, str]:
    """Verify template and reference bytes against production provenance."""
    pipeline_artifacts = model_card.get("pipeline_artifacts")
    if not isinstance(pipeline_artifacts, dict):
        raise ValueError("model card is missing pipeline_artifacts")
    expected_template_hash = pipeline_artifacts.get("template_sha256")
    expected_reference_hash = pipeline_artifacts.get("reference_sha256")
    template_hash = file_sha256(template_path)
    reference_hash = file_sha256(reference_path)
    if template_hash != expected_template_hash:
        raise RuntimeError(
            "template SHA-256 mismatch: "
            f"model card expects {expected_template_hash}, got {template_hash}"
        )
    if reference_hash != expected_reference_hash:
        raise RuntimeError(
            "reference SHA-256 mismatch: "
            f"model card expects {expected_reference_hash}, got {reference_hash}"
        )
    return template_hash, reference_hash


class RecognitionService:
    """Load immutable artifacts once and recognize multiple uploaded sheets."""

    def __init__(
        self,
        checkpoint_path: str | Path = DEFAULT_CHECKPOINT,
        model_card_path: str | Path = DEFAULT_MODEL_CARD,
        template_path: str | Path = TEMPLATE_JSON,
        reference_path: str | Path = DEFAULT_REFERENCE,
        device: str = "cpu",
        batch_size: int = 128,
        low_confidence_threshold: float | None = None,
        erasure_threshold: float | None = None,
    ) -> None:
        if batch_size < 1:
            raise ValueError("batch_size must be at least 1")

        self.checkpoint_path = Path(checkpoint_path).resolve()
        self.model_card_path = Path(model_card_path).resolve()
        self.template_path = Path(template_path).resolve()
        self.reference_path = Path(reference_path).resolve()
        self.batch_size = batch_size

        self.model_card = verify_checkpoint_model_card(
            self.model_card_path, self.checkpoint_path
        )
        production_decision = self.model_card.get("production_decision")
        if not isinstance(production_decision, dict):
            raise ValueError("model card is missing production_decision")
        try:
            card_low_confidence = float(
                production_decision.get("low_confidence_threshold")
            )
            card_erasure = float(
                production_decision.get("erasure_probability_threshold")
            )
        except (TypeError, ValueError) as exc:
            raise ValueError("model card production thresholds must be numeric") from exc
        self.low_confidence_threshold = (
            card_low_confidence
            if low_confidence_threshold is None
            else low_confidence_threshold
        )
        self.erasure_threshold = (
            card_erasure if erasure_threshold is None else erasure_threshold
        )
        if not 0 <= self.low_confidence_threshold <= 1:
            raise ValueError("low_confidence_threshold must be between 0 and 1")
        if not 0 <= self.erasure_threshold <= 1:
            raise ValueError("erasure_threshold must be between 0 and 1")
        self.template_sha256, self.reference_sha256 = verify_pipeline_artifacts(
            self.model_card, self.template_path, self.reference_path
        )
        self.loaded_model = load_bubble_model(self.checkpoint_path, device=device)
        if self.loaded_model.classes != REQUIRED_CLASSES:
            raise ValueError(
                f"production model classes must be {REQUIRED_CLASSES!r}, "
                f"got {self.loaded_model.classes!r}"
            )
        if tuple(self.model_card.get("classes", [])) != self.loaded_model.classes:
            raise ValueError("model card classes do not match checkpoint classes")

        self.template = load_template(self.template_path)
        self.reference = cv2.imread(str(self.reference_path), cv2.IMREAD_COLOR)
        if self.reference is None:
            raise FileNotFoundError(f"reference image not found: {self.reference_path}")
        expected_width, expected_height = self.template["size"]
        if self.reference.shape[:2] != (expected_height, expected_width):
            raise ValueError(
                "reference dimensions do not match template: "
                f"expected {expected_width}x{expected_height}, "
                f"got {self.reference.shape[1]}x{self.reference.shape[0]}"
            )
        self.registrar = SheetRegistrar(self.reference)

    def warmup(self) -> None:
        """Prime registration, extraction, and inference using the verified reference."""
        self.recognize(self.reference)

    def process(
        self,
        image: np.ndarray,
        answer_key: dict[str, Any] | None = None,
        low_confidence_threshold: float | None = None,
        erasure_threshold: float | None = None,
    ) -> RecognitionRun:
        """Run registration, extraction, classification, validation, and scoring."""
        threshold = (
            self.low_confidence_threshold
            if low_confidence_threshold is None
            else low_confidence_threshold
        )
        if not 0 <= threshold <= 1:
            raise ValueError("low_confidence_threshold must be between 0 and 1")
        erasure_cutoff = (
            self.erasure_threshold if erasure_threshold is None else erasure_threshold
        )
        if not 0 <= erasure_cutoff <= 1:
            raise ValueError("erasure_threshold must be between 0 and 1")
        if not isinstance(image, np.ndarray) or image.size == 0:
            raise RecognitionError("uploaded image is empty")
        if answer_key is not None:
            # Reject malformed, incomplete, inactive, or out-of-range keys
            # before spending several seconds on registration and inference.
            normalize_answer_key(answer_key)

        capture_quality = analyze_capture_quality(image)
        validate_capture_image_quality(capture_quality)

        started = perf_counter()
        try:
            warped, registration = self.registrar.register(image)
        except (ValueError, cv2.error) as exc:
            raise RecognitionError(f"sheet registration failed: {exc}") from exc
        registered_at = perf_counter()

        try:
            offsets, lattice = refine_lattice(warped, self.template)
            crops = extract_bubbles(warped, self.template, offsets)
        except (ValueError, cv2.error) as exc:
            raise RecognitionError(f"bubble extraction failed: {exc}") from exc
        extracted_at = perf_counter()

        warnings = capture_quality_warnings(registration, lattice)

        predictions = classify_bubbles(
            crops,
            self.loaded_model,
            self.batch_size,
            erasure_threshold=erasure_cutoff,
        )
        items = decide_items(predictions, threshold)
        classified_at = perf_counter()
        if len(crops) != EXPECTED_BUBBLE_COUNT or len(items) != EXPECTED_ITEM_COUNT:
            raise RecognitionError(
                f"incomplete recognition: {len(crops)} bubbles and {len(items)} items"
            )

        report: dict[str, Any] = {
            "status": "scored" if answer_key is not None else "recognized",
            "template_id": self.template.get("template_id"),
            "model": {
                "model_id": self.model_card.get("model_id"),
                "checkpoint_sha256": self.loaded_model.checkpoint_sha256,
                "template_sha256": self.template_sha256,
                "reference_sha256": self.reference_sha256,
                "classes": list(self.loaded_model.classes),
                "device": str(next(self.loaded_model.model.parameters()).device),
            },
            "capture_quality": capture_quality,
            "registration": registration,
            "lattice": lattice,
            "warnings": warnings,
            "low_confidence_threshold": threshold,
            "erasure_threshold": erasure_cutoff,
            "bubble_count": len(crops),
            "item_count": len(items),
            "summary": summarize_items(items),
            "items": items,
        }
        if answer_key is not None:
            report["scoring"] = score_items(items, answer_key)
        completed_at = perf_counter()
        report["timing_ms"] = {
            "registration": round((registered_at - started) * 1000, 2),
            "extraction": round((extracted_at - registered_at) * 1000, 2),
            "classification": round((classified_at - extracted_at) * 1000, 2),
            "scoring": round((completed_at - classified_at) * 1000, 2),
            "total": round((completed_at - started) * 1000, 2),
        }
        return RecognitionRun(
            report=report,
            warped=warped,
            crops=tuple(crops),
            predictions=tuple(predictions),
        )

    def recognize(
        self,
        image: np.ndarray,
        answer_key: dict[str, Any] | None = None,
        low_confidence_threshold: float | None = None,
        erasure_threshold: float | None = None,
    ) -> dict[str, Any]:
        """Return only the JSON-serializable report for API use."""
        return self.process(
            image,
            answer_key,
            low_confidence_threshold,
            erasure_threshold,
        ).report


def write_debug_overlay(run: RecognitionRun, path: str | Path) -> None:
    """Write a registered-sheet overlay colored by predicted bubble class."""
    colors = {
        "empty": (0, 170, 0),
        "shaded": (255, 0, 0),
        "erasure_smudge": (0, 140, 255),
    }
    overlay = run.warped.copy()
    for prediction in run.predictions:
        center = (
            int(round(prediction.crop.center_x)),
            int(round(prediction.crop.center_y)),
        )
        cv2.circle(overlay, center, 22, colors[prediction.class_name], 2)
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), overlay):
        raise OSError(f"could not write debug overlay: {output}")
