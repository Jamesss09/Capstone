"""Answer-key validation and deterministic examination scoring."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from core.sheet_config import OPTION_COUNTS, SHEET_SECTIONS, canonical_section

OPTION_LETTERS = "ABCDE"
VALID_RECOGNITION_STATUSES = {"answered", "blank", "invalid"}


class ScoringError(ValueError):
    """Raised when an answer key or recognized item set is invalid."""


def _decimal(value: Any, field: str) -> Decimal:
    if isinstance(value, bool):
        raise ScoringError(f"{field} must be numeric")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ScoringError(f"{field} must be numeric") from exc
    if not number.is_finite():
        raise ScoringError(f"{field} must be finite")
    return number


def expected_item_keys() -> list[tuple[str, int]]:
    """Return all 100 canonical section-local item keys in sheet order."""
    return [
        (section["id"], item_number)
        for section in SHEET_SECTIONS
        for item_number in range(section["start"], section["end"] + 1)
    ]


def normalize_answer_key(answer_key: Any) -> dict[str, Any]:
    """Validate and normalize a complete Laravel-compatible answer key."""
    if not isinstance(answer_key, dict):
        raise ScoringError("answer_key must be a JSON object")

    status = answer_key.get("status")
    if status is not None and str(status).strip().lower() != "active":
        raise ScoringError("answer_key status must be Active")

    passing_score = _decimal(answer_key.get("passing_score"), "passing_score")
    if passing_score < 0 or passing_score > 100:
        raise ScoringError("passing_score must be between 0 and 100")

    raw_items = answer_key.get("items")
    if not isinstance(raw_items, list):
        raise ScoringError("answer_key.items must be an array")

    normalized_items: dict[tuple[str, int], dict[str, Any]] = {}
    for index, raw in enumerate(raw_items):
        prefix = f"answer_key.items[{index}]"
        if not isinstance(raw, dict):
            raise ScoringError(f"{prefix} must be an object")
        try:
            section = canonical_section(str(raw.get("section", "")))
        except ValueError as exc:
            raise ScoringError(f"{prefix}.section is invalid") from exc

        item_number = raw.get("item_number", raw.get("item"))
        if isinstance(item_number, bool) or not isinstance(item_number, int):
            raise ScoringError(f"{prefix}.item_number must be an integer")
        section_config = next(item for item in SHEET_SECTIONS if item["id"] == section)
        if not section_config["start"] <= item_number <= section_config["end"]:
            raise ScoringError(
                f"{prefix}.item_number must be between "
                f"{section_config['start']} and {section_config['end']}"
            )

        answer = str(raw.get("correct_answer", "")).strip().upper()
        allowed = OPTION_LETTERS[: OPTION_COUNTS[section]]
        if answer not in allowed:
            raise ScoringError(
                f"{prefix}.correct_answer must be one of {', '.join(allowed)}"
            )

        points = _decimal(raw.get("points", 1), f"{prefix}.points")
        if points < 0:
            raise ScoringError(f"{prefix}.points must be zero or greater")

        key = (section, item_number)
        if key in normalized_items:
            raise ScoringError(
                f"answer_key repeats {section} item {item_number}"
            )
        normalized_items[key] = {
            "section": section,
            "item_number": item_number,
            "correct_answer": answer,
            "points": points,
        }

    expected = set(expected_item_keys())
    actual = set(normalized_items)
    missing = expected - actual
    extra = actual - expected
    if missing or extra:
        details = []
        if missing:
            details.append(f"missing {len(missing)} item(s)")
        if extra:
            details.append(f"contains {len(extra)} unexpected item(s)")
        raise ScoringError("answer_key must contain all 100 sheet items: " + ", ".join(details))

    total_points = sum((item["points"] for item in normalized_items.values()), Decimal("0"))
    if total_points <= 0:
        raise ScoringError("answer_key total points must be greater than zero")

    ordered = [normalized_items[key] for key in expected_item_keys()]
    return {
        "answer_key_id": answer_key.get("answer_key_id", answer_key.get("id")),
        "exam_title": answer_key.get("exam_title"),
        "passing_score": passing_score,
        "items": ordered,
        "total_points": total_points,
    }


def _index_recognized_items(items: Any) -> dict[tuple[str, int], dict[str, Any]]:
    if not isinstance(items, list):
        raise ScoringError("recognized items must be an array")
    indexed: dict[tuple[str, int], dict[str, Any]] = {}
    for index, item in enumerate(items):
        prefix = f"items[{index}]"
        if not isinstance(item, dict):
            raise ScoringError(f"{prefix} must be an object")
        try:
            section = canonical_section(str(item.get("section", "")))
        except ValueError as exc:
            raise ScoringError(f"{prefix}.section is invalid") from exc
        item_number = item.get("item_number")
        if isinstance(item_number, bool) or not isinstance(item_number, int):
            raise ScoringError(f"{prefix}.item_number must be an integer")
        key = (section, item_number)
        if key in indexed:
            raise ScoringError(f"recognized items repeat {section} item {item_number}")
        status = item.get("status")
        if status not in VALID_RECOGNITION_STATUSES:
            raise ScoringError(f"{prefix}.status is invalid")
        marked = item.get("marked_answer")
        if marked is not None:
            marked = str(marked).strip().upper()
            allowed = OPTION_LETTERS[: OPTION_COUNTS.get(section, 0)]
            if marked not in allowed:
                raise ScoringError(f"{prefix}.marked_answer is invalid for {section}")
        if status != "answered" and marked is not None:
            raise ScoringError(f"{prefix}.marked_answer must be null unless status is answered")
        indexed[key] = {**item, "section": section, "marked_answer": marked}

    expected = set(expected_item_keys())
    if set(indexed) != expected:
        missing = expected - set(indexed)
        extra = set(indexed) - expected
        raise ScoringError(
            "recognized items must contain all 100 sheet items "
            f"(missing={len(missing)}, unexpected={len(extra)})"
        )
    return indexed


def _json_number(value: Decimal) -> int | float:
    integral = value.to_integral_value()
    if value == integral:
        return int(integral)
    return float(value)


def score_items(recognized_items: Any, answer_key: Any) -> dict[str, Any]:
    """Compare 100 recognized items with a validated key and calculate score."""
    key = normalize_answer_key(answer_key)
    recognized = _index_recognized_items(recognized_items)
    key_items = {(item["section"], item["item_number"]): item for item in key["items"]}

    earned_points = Decimal("0")
    correct_count = 0
    outcomes = []
    for item_key in expected_item_keys():
        response = recognized[item_key]
        expected = key_items[item_key]
        is_correct = (
            response["status"] == "answered"
            and response["marked_answer"] == expected["correct_answer"]
        )
        awarded = expected["points"] if is_correct else Decimal("0")
        if is_correct:
            correct_count += 1
            earned_points += awarded
        outcomes.append({
            "section": item_key[0],
            "item_number": item_key[1],
            "marked_answer": response["marked_answer"],
            "recognition_status": response["status"],
            "flags": list(response.get("flags", [])),
            "is_correct": is_correct,
            "points_awarded": _json_number(awarded),
            "points_possible": _json_number(expected["points"]),
        })

    percentage = earned_points / key["total_points"] * Decimal("100")
    rounded_percentage = percentage.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    passing_score = key["passing_score"]
    total_items = len(outcomes)

    return {
        "answer_key_id": key["answer_key_id"],
        "exam_title": key["exam_title"],
        "score": float(rounded_percentage),
        "score_percentage": float(rounded_percentage),
        "earned_points": _json_number(earned_points),
        "total_points": _json_number(key["total_points"]),
        "passing_score": float(passing_score),
        "status": "Passed" if percentage >= passing_score else "Failed",
        "total_items": total_items,
        "correct_count": correct_count,
        "incorrect_count": total_items - correct_count,
        "answered_count": sum(item["status"] == "answered" for item in recognized.values()),
        "blank_count": sum(item["status"] == "blank" for item in recognized.values()),
        "invalid_count": sum(item["status"] == "invalid" for item in recognized.values()),
        "low_confidence_count": sum(
            "low_confidence" in item.get("flags", []) for item in recognized.values()
        ),
        "items": outcomes,
    }
