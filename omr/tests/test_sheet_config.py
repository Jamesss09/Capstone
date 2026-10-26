import pytest

from app import sheet_config
from core.sheet_config import OPTION_COUNT, canonical_section


@pytest.mark.parametrize(
    ("section", "expected"),
    [
        ("inductive", 5),
        ("Inductive / Logical Test", 5),
        ("math", 4),
        ("Mathematics", 4),
        ("english", 4),
        ("science", 4),
        ("aptitude", 4),
    ],
)
def test_option_count_uses_the_section_identifier(section, expected):
    assert OPTION_COUNT(section) == expected


@pytest.mark.parametrize(
    ("alias", "expected"),
    [
        ("Inductive/Logical Test", "inductive"),
        ("Science and Technology", "science"),
        ("math", "math"),
    ],
)
def test_canonical_section_accepts_legacy_display_aliases(alias, expected):
    assert canonical_section(alias) == expected


def test_canonical_section_rejects_unknown_names():
    with pytest.raises(ValueError, match="unknown TMC section"):
        canonical_section("General Knowledge")


def test_sheet_config_endpoint_returns_a_serializable_option_map():
    payload = sheet_config()

    assert payload["option_counts"] == {
        "inductive": 5,
        "math": 4,
        "english": 4,
        "science": 4,
        "aptitude": 4,
    }
