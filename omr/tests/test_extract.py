from copy import deepcopy

import numpy as np
import pytest

import core.extract as extract_module
from core.extract import (
    EXPECTED_BUBBLE_COUNT,
    EXPECTED_ITEM_COUNT,
    ExtractionError,
    extract_bubbles,
    load_template,
    refine_lattice,
)


def test_extracts_all_410_template_bubbles_in_sheet_order():
    template = load_template()
    width, height = template["size"]
    registered = np.full((height, width), 255, dtype=np.uint8)

    crops = extract_bubbles(registered, template)

    assert len(crops) == EXPECTED_BUBBLE_COUNT
    assert len({(crop.section, crop.item_number) for crop in crops}) == EXPECTED_ITEM_COUNT
    assert crops[0].name == "inductive_i01_A"
    assert crops[49].name == "inductive_i10_E"
    assert crops[-1].name == "aptitude_i10_D"
    assert all(crop.image.shape == (44, 44) for crop in crops)


def test_extraction_rejects_out_of_bounds_roi():
    template = deepcopy(load_template())
    template["sections"][0]["x0"] = 1
    width, height = template["size"]
    registered = np.full((height, width, 3), 255, dtype=np.uint8)

    with pytest.raises(ExtractionError, match="outside the registered page"):
        extract_bubbles(registered, template)


def test_lattice_refinement_handles_no_detected_rings(monkeypatch):
    template = load_template()
    width, height = template["size"]
    registered = np.full((height, width), 255, dtype=np.uint8)
    monkeypatch.setattr(
        extract_module,
        "detect_bubble_rings",
        lambda _gray: np.empty((0, 3), dtype=np.float32),
    )

    offsets, diagnostics = refine_lattice(registered, template)

    assert diagnostics["quality"] == "poor"
    assert diagnostics["matched_rows"] == 0
    assert diagnostics["ring_matches"] == 0
    assert set(offsets) == {"inductive", "math", "english", "science", "aptitude"}
    assert all(float(dx[0]) == 0 and float(dy[0]) == 0 for dx, dy in offsets.values())
