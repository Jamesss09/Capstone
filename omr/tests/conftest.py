"""Make the OMR package importable when pytest collects tests from tests/."""
from pathlib import Path
import sys


OMR_ROOT = Path(__file__).resolve().parents[1]
if str(OMR_ROOT) not in sys.path:
    sys.path.insert(0, str(OMR_ROOT))
