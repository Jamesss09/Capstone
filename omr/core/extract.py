"""Truth-independent extraction of every bubble in the TMC sheet template.

The captured page must first be registered into the canonical reference frame.
This module then refines the calibrated lattice from the printed bubble rings
and extracts one 44x44 grayscale crop for each template position. It never uses
answer labels or ground-truth JSON.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from core.preprocess import TEMPLATE_JSON
from core.sheet_config import SECTION_BY_ID

OPTION_LETTERS = "ABCDE"
EXPECTED_ITEM_COUNT = 100
EXPECTED_BUBBLE_COUNT = 410


class TemplateError(ValueError):
    """Raised when a sheet template is malformed or incompatible."""


class ExtractionError(ValueError):
    """Raised when a registered sheet cannot yield every expected crop."""


@dataclass(frozen=True)
class BubbleCrop:
    """One template-positioned bubble crop from a registered answer sheet."""

    section: str
    item_number: int
    option_index: int
    letter: str
    center_x: float
    center_y: float
    image: np.ndarray

    @property
    def name(self) -> str:
        return f"{self.section}_i{self.item_number:02d}_{self.letter}"


def load_template(path: str | Path = TEMPLATE_JSON) -> dict[str, Any]:
    """Load and validate the canonical 100-item, 410-bubble template."""
    template_path = Path(path)
    try:
        template = json.loads(template_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TemplateError(f"could not load template {template_path}: {exc}") from exc
    validate_template(template)
    return template


def validate_template(template: Any) -> None:
    """Require the calibrated template to match the canonical sheet config."""
    if not isinstance(template, dict):
        raise TemplateError("template root must be an object")

    size = template.get("size")
    if (
        not isinstance(size, list)
        or len(size) != 2
        or any(not isinstance(value, int) or value < 1 for value in size)
    ):
        raise TemplateError("template size must be [width, height] using positive integers")

    roi_size = template.get("roi_size")
    if not isinstance(roi_size, int) or roi_size < 2 or roi_size % 2:
        raise TemplateError("template roi_size must be a positive even integer")

    sections = template.get("sections")
    if not isinstance(sections, list):
        raise TemplateError("template sections must be an array")

    seen: set[str] = set()
    item_count = 0
    bubble_count = 0
    required_numbers = ("x0", "dx", "y0", "dy")
    for index, section in enumerate(sections):
        if not isinstance(section, dict):
            raise TemplateError(f"template section {index} must be an object")
        name = section.get("name")
        if name not in SECTION_BY_ID:
            raise TemplateError(f"template has unknown section {name!r}")
        if name in seen:
            raise TemplateError(f"template repeats section {name!r}")
        seen.add(name)

        canonical = SECTION_BY_ID[name]
        items = section.get("items")
        options = section.get("options")
        expected_items = canonical["end"] - canonical["start"] + 1
        if items != expected_items or options != canonical["options"]:
            raise TemplateError(
                f"template section {name!r} must have "
                f"{expected_items} items and {canonical['options']} options"
            )
        for field in required_numbers:
            if not isinstance(section.get(field), (int, float)):
                raise TemplateError(f"template section {name!r} is missing numeric {field!r}")
        if not isinstance(section.get("dy2", 0.0), (int, float)):
            raise TemplateError(f"template section {name!r} has invalid 'dy2'")
        item_count += items
        bubble_count += items * options

    missing = sorted(set(SECTION_BY_ID) - seen)
    if missing:
        raise TemplateError(f"template is missing sections: {', '.join(missing)}")
    if item_count != EXPECTED_ITEM_COUNT or bubble_count != EXPECTED_BUBBLE_COUNT:
        raise TemplateError(
            f"template must contain {EXPECTED_ITEM_COUNT} items and "
            f"{EXPECTED_BUBBLE_COUNT} bubbles"
        )


def template_center(section: dict[str, Any], item_number: int, option_index: int) -> tuple[float, float]:
    """Return the calibrated center for one section/item/option position."""
    x = float(section["x0"]) + float(section["dx"]) * option_index
    row = item_number - 1
    y = (
        float(section["y0"])
        + float(section["dy"]) * row
        + float(section.get("dy2", 0.0)) * row * row
    )
    return x, y


def detect_bubble_rings(gray: np.ndarray) -> np.ndarray:
    """Detect printed bubble rings for residual lattice alignment."""
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=25,
        param1=80,
        param2=16,
        minRadius=14,
        maxRadius=22,
    )
    if circles is None:
        return np.empty((0, 3), dtype=np.float32)
    return np.round(circles[0]).astype(np.float32)


def _polyfit_rows(rows: list[tuple[int, float, float, int]]) -> tuple[np.ndarray, np.ndarray]:
    """Fit smooth horizontal and vertical corrections from row medians."""
    if not rows:
        return np.array([0.0]), np.array([0.0])
    indices = np.array([row[0] for row in rows], dtype=np.float64)
    dx = np.array([row[1] for row in rows], dtype=np.float64)
    dy = np.array([row[2] for row in rows], dtype=np.float64)
    degree = 2 if len(rows) >= 6 else (1 if len(rows) >= 3 else 0)
    return np.polyfit(indices, dx, degree), np.polyfit(indices, dy, degree)


def _to_gray(image: np.ndarray) -> np.ndarray:
    if not isinstance(image, np.ndarray) or image.size == 0:
        raise ExtractionError("registered sheet must be a non-empty numpy array")
    if image.ndim == 2:
        gray = image
    elif image.ndim == 3 and image.shape[2] == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    elif image.ndim == 3 and image.shape[2] == 4:
        gray = cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    else:
        raise ExtractionError(f"unsupported registered sheet shape: {image.shape}")
    if gray.dtype != np.uint8:
        raise ExtractionError(f"registered sheet must use uint8 pixels, got {gray.dtype}")
    return gray


def refine_lattice(
    warped: np.ndarray,
    template: dict[str, Any],
    max_shift: float = 28.0,
) -> tuple[dict[str, tuple[np.ndarray, np.ndarray]], dict[str, Any]]:
    """Estimate smooth residual offsets from rings without consulting truth."""
    validate_template(template)
    if max_shift <= 0:
        raise ValueError("max_shift must be greater than zero")

    circles = detect_bubble_rings(_to_gray(warped))
    offsets: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    section_diagnostics: dict[str, dict[str, Any]] = {}
    total_matched_rows = 0
    total_ring_matches = 0

    for section in template["sections"]:
        rows: list[tuple[int, float, float, int]] = []
        for item_number in range(1, section["items"] + 1):
            found: list[tuple[float, float]] = []
            for option_index in range(section["options"]):
                if not len(circles):
                    break
                center_x, center_y = template_center(section, item_number, option_index)
                distances = np.hypot(circles[:, 0] - center_x, circles[:, 1] - center_y)
                nearest = int(np.argmin(distances))
                if distances[nearest] <= max_shift:
                    found.append(
                        (
                            float(circles[nearest, 0] - center_x),
                            float(circles[nearest, 1] - center_y),
                        )
                    )
            if found:
                median = np.median(np.asarray(found), axis=0)
                rows.append(
                    (item_number, float(median[0]), float(median[1]), len(found))
                )

        coefficients = _polyfit_rows(rows)
        offsets[section["name"]] = coefficients
        ring_matches = sum(row[3] for row in rows)
        total_matched_rows += len(rows)
        total_ring_matches += ring_matches
        section_diagnostics[section["name"]] = {
            "matched_rows": len(rows),
            "expected_rows": section["items"],
            "ring_matches": ring_matches,
            "expected_bubbles": section["items"] * section["options"],
            "dx_coefficients": [float(value) for value in coefficients[0]],
            "dy_coefficients": [float(value) for value in coefficients[1]],
        }

    row_coverage = total_matched_rows / EXPECTED_ITEM_COUNT
    ring_coverage = total_ring_matches / EXPECTED_BUBBLE_COUNT
    if row_coverage >= 0.8:
        quality = "good"
    elif row_coverage >= 0.25:
        quality = "degraded"
    else:
        quality = "poor"

    diagnostics = {
        "detected_circles": int(len(circles)),
        "matched_rows": total_matched_rows,
        "expected_rows": EXPECTED_ITEM_COUNT,
        "row_coverage": row_coverage,
        "ring_matches": total_ring_matches,
        "expected_bubbles": EXPECTED_BUBBLE_COUNT,
        "ring_coverage": ring_coverage,
        "quality": quality,
        "sections": section_diagnostics,
    }
    return offsets, diagnostics


def refined_center(
    section: dict[str, Any],
    item_number: int,
    option_index: int,
    offsets: dict[str, tuple[np.ndarray, np.ndarray]],
) -> tuple[float, float]:
    """Apply a section's fitted residual correction to a template center."""
    center_x, center_y = template_center(section, item_number, option_index)
    coefficients = offsets.get(section["name"])
    if coefficients is not None:
        dx_coefficients, dy_coefficients = coefficients
        center_x += float(np.polyval(dx_coefficients, item_number))
        center_y += float(np.polyval(dy_coefficients, item_number))
    return center_x, center_y


def extract_bubbles(
    warped: np.ndarray,
    template: dict[str, Any],
    offsets: dict[str, tuple[np.ndarray, np.ndarray]] | None = None,
) -> list[BubbleCrop]:
    """Extract every configured bubble, failing rather than silently skipping."""
    validate_template(template)
    gray = _to_gray(warped)
    expected_width, expected_height = template["size"]
    if gray.shape != (expected_height, expected_width):
        raise ExtractionError(
            "registered sheet dimensions do not match template: "
            f"expected {expected_width}x{expected_height}, "
            f"got {gray.shape[1]}x{gray.shape[0]}"
        )

    corrections = offsets or {}
    size = template["roi_size"]
    half = size // 2
    crops: list[BubbleCrop] = []
    for section in template["sections"]:
        for item_number in range(1, section["items"] + 1):
            for option_index in range(section["options"]):
                letter = OPTION_LETTERS[option_index]
                center_x, center_y = refined_center(
                    section, item_number, option_index, corrections
                )
                x0 = int(round(center_x)) - half
                y0 = int(round(center_y)) - half
                x1 = x0 + size
                y1 = y0 + size
                if x0 < 0 or y0 < 0 or x1 > gray.shape[1] or y1 > gray.shape[0]:
                    raise ExtractionError(
                        "bubble ROI is outside the registered page for "
                        f"{section['name']} item {item_number} option {letter}"
                    )
                roi = np.ascontiguousarray(gray[y0:y1, x0:x1]).copy()
                if roi.shape != (size, size):
                    raise ExtractionError(
                        f"incorrect crop shape {roi.shape} for "
                        f"{section['name']} item {item_number} option {letter}"
                    )
                crops.append(
                    BubbleCrop(
                        section=section["name"],
                        item_number=item_number,
                        option_index=option_index,
                        letter=letter,
                        center_x=center_x,
                        center_y=center_y,
                        image=roi,
                    )
                )

    if len(crops) != EXPECTED_BUBBLE_COUNT:
        raise ExtractionError(
            f"expected {EXPECTED_BUBBLE_COUNT} crops, extracted {len(crops)}"
        )
    return crops
