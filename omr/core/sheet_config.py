"""TMC answer sheet layout: per-section item ranges and option counts.

Sheet has 100 items in 5 sections. Only the Inductive/Logical section uses
5 options (A-E); all other sections use 4 options (A-D).
"""

SHEET_SECTIONS = [
    {"name": "Inductive / Logical Test", "start": 1, "end": 10, "options": 5},   # A-E
    {"name": "Mathematics", "start": 1, "end": 30, "options": 4},                 # A-D
    {"name": "English", "start": 1, "end": 30, "options": 4},                     # A-D
    {"name": "Science & Technology", "start": 1, "end": 20, "options": 4},        # A-D
    {"name": "Aptitude", "start": 1, "end": 10, "options": 4},                    # A-D
]


def OPTION_COUNT(item_number: int) -> int:
    """Return the number of answer options for a given item number."""
    # Sections restart item numbering at 1; the sheet columns map by position.
    if 1 <= item_number <= 10:
        return 5  # Inductive / Logical Test -> A-E
    return 4  # A-D everywhere else