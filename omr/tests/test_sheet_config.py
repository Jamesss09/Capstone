import pytest
from core.sheet_config import OPTION_COUNT


def test_inductive_section_uses_five_options():
    for item in range(1, 11):
        assert OPTION_COUNT(item) == 5, f"item {item} should be A-E"


def test_other_sections_use_four_options():
    assert OPTION_COUNT(11) == 4
    assert OPTION_COUNT(30) == 4
    assert OPTION_COUNT(31) == 4
    assert OPTION_COUNT(60) == 4
    assert OPTION_COUNT(61) == 4
    assert OPTION_COUNT(90) == 4
    assert OPTION_COUNT(91) == 4
    assert OPTION_COUNT(100) == 4