"""Canonical TMC answer-sheet sections and option counts.

The lowercase ``id`` is the identifier shared by the calibrated template,
Laravel answer-key records, and OMR output. ``name`` is display-only.
"""
from __future__ import annotations

import re


SHEET_SECTIONS = [
    {"id": "inductive", "name": "Inductive / Logical Test", "start": 1, "end": 10, "options": 5},
    {"id": "math", "name": "Mathematics", "start": 1, "end": 30, "options": 4},
    {"id": "english", "name": "English", "start": 1, "end": 30, "options": 4},
    {"id": "science", "name": "Science & Technology", "start": 1, "end": 20, "options": 4},
    {"id": "aptitude", "name": "Aptitude", "start": 1, "end": 10, "options": 4},
]

SECTION_BY_ID = {section["id"]: section for section in SHEET_SECTIONS}


def _section_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.strip().lower())


SECTION_ALIASES = {
    _section_key(alias): section_id
    for section_id, aliases in {
        "inductive": ("inductive", "Inductive / Logical Test", "Inductive/Logical Test", "Inductive Logical Test"),
        "math": ("math", "Mathematics"),
        "english": ("english", "English"),
        "science": ("science", "Science & Technology", "Science and Technology"),
        "aptitude": ("aptitude", "Aptitude"),
    }.items()
    for alias in aliases
}

OPTION_COUNTS = {section_id: section["options"] for section_id, section in SECTION_BY_ID.items()}


def canonical_section(value: str) -> str:
    """Return the canonical identifier for an id or supported display alias."""
    try:
        return SECTION_ALIASES[_section_key(value)]
    except KeyError as exc:
        raise ValueError(f"unknown TMC section: {value!r}") from exc


def OPTION_COUNT(section: str) -> int:
    """Return the permitted number of options for a canonical section or alias."""
    return OPTION_COUNTS[canonical_section(section)]
