from pathlib import Path

import numpy as np
import pytest

from core.bubble_model import file_sha256
from core.extract import BubbleCrop
from core.recognition import (
    BubblePrediction,
    RecognitionError,
    capture_quality_warnings,
    decide_items,
    select_bubble_class,
    summarize_items,
    verify_pipeline_artifacts,
)


def prediction(
    section: str,
    item: int,
    option: int,
    class_name: str,
    confidence: float = 0.99,
) -> BubblePrediction:
    letters = "ABCDE"
    crop = BubbleCrop(
        section=section,
        item_number=item,
        option_index=option,
        letter=letters[option],
        center_x=100 + option * 60,
        center_y=100 + item * 60,
        image=np.zeros((44, 44), dtype=np.uint8),
    )
    probabilities = {"shaded": 0.005, "empty": 0.005, "erasure_smudge": 0.005}
    probabilities[class_name] = confidence
    return BubblePrediction(crop, class_name, confidence, probabilities)


def item_predictions(item: int, classes: list[tuple[str, float]]) -> list[BubblePrediction]:
    return [
        prediction("math", item, option, class_name, confidence)
        for option, (class_name, confidence) in enumerate(classes)
    ]


def test_item_decisions_cover_answer_blank_multi_erasure_and_low_confidence():
    predictions = []
    predictions += item_predictions(
        1,
        [("empty", 0.99), ("shaded", 0.97), ("empty", 0.99), ("empty", 0.99)],
    )
    predictions += item_predictions(2, [("empty", 0.99)] * 4)
    predictions += item_predictions(
        3,
        [("shaded", 0.95), ("empty", 0.99), ("shaded", 0.92), ("empty", 0.99)],
    )
    predictions += item_predictions(
        4,
        [("empty", 0.99), ("erasure_smudge", 0.91), ("shaded", 0.98), ("empty", 0.99)],
    )
    predictions += item_predictions(
        5,
        [("empty", 0.99), ("empty", 0.99), ("empty", 0.99), ("shaded", 0.70)],
    )

    items = decide_items(predictions, low_confidence_threshold=0.80)

    assert items[0]["status"] == "answered"
    assert items[0]["marked_answer"] == "B"
    assert items[0]["flags"] == []
    assert items[1]["status"] == "blank"
    assert items[1]["marked_answer"] is None
    assert items[2]["status"] == "invalid"
    assert items[2]["flags"] == ["multi_shade"]
    assert items[3]["status"] == "invalid"
    assert items[3]["flags"] == ["erasure"]
    assert items[4]["status"] == "answered"
    assert items[4]["marked_answer"] == "D"
    assert items[4]["flags"] == ["low_confidence"]

    assert summarize_items(items) == {
        "answered": 2,
        "blank": 1,
        "invalid": 2,
        "multi_shade": 1,
        "erasure": 1,
        "low_confidence": 1,
    }


def test_erasure_takes_priority_over_multiple_shades():
    predictions = item_predictions(
        1,
        [
            ("shaded", 0.99),
            ("shaded", 0.99),
            ("erasure_smudge", 0.99),
            ("empty", 0.99),
        ],
    )

    item = decide_items(predictions)[0]

    assert item["status"] == "invalid"
    assert item["marked_answer"] is None
    assert item["flags"] == ["erasure"]


def test_production_policy_requires_erasure_probability_threshold():
    below_threshold = {
        "shaded": 0.35,
        "empty": 0.05,
        "erasure_smudge": 0.60,
    }
    above_threshold = {
        "shaded": 0.10,
        "empty": 0.05,
        "erasure_smudge": 0.85,
    }

    assert select_bubble_class(below_threshold, 0.80) == ("shaded", 0.35)
    assert select_bubble_class(above_threshold, 0.80) == ("erasure_smudge", 0.85)


def test_capture_quality_rejects_poor_lattice_and_flags_degraded_fallback():
    with pytest.raises(RecognitionError, match="quality is too low"):
        capture_quality_warnings({"method": "sift"}, {"quality": "poor"})

    assert capture_quality_warnings(
        {"method": "quad"}, {"quality": "degraded"}
    ) == ["registration_fallback", "lattice_degraded"]


def test_pipeline_artifact_hashes_detect_changed_reference(tmp_path: Path):
    template = tmp_path / "template.json"
    reference = tmp_path / "reference.jpg"
    template.write_bytes(b"template")
    reference.write_bytes(b"reference")
    card = {
        "pipeline_artifacts": {
            "template_sha256": file_sha256(template),
            "reference_sha256": file_sha256(reference),
        }
    }

    assert verify_pipeline_artifacts(card, template, reference) == (
        file_sha256(template),
        file_sha256(reference),
    )
    reference.write_bytes(b"changed reference")

    with pytest.raises(RuntimeError, match="reference SHA-256 mismatch"):
        verify_pipeline_artifacts(card, template, reference)
