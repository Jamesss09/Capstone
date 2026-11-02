"""Recognize and optionally score one answer-sheet image.

Run from ``omr/``::

    python tools/recognize_sheet.py --image dataset/raw_sheets/sheet_001.jpg

Supply ``--answer-key key.json`` for scoring and ``--debug-overlay`` to inspect
the registered crop positions colored by classifier output.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import cv2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.preprocess import TEMPLATE_JSON
from core.recognition import (
    DEFAULT_CHECKPOINT,
    DEFAULT_ERASURE_THRESHOLD,
    DEFAULT_LOW_CONFIDENCE_THRESHOLD,
    DEFAULT_MODEL_CARD,
    DEFAULT_REFERENCE,
    RecognitionService,
    write_debug_overlay,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--answer-key", type=Path, help="optional JSON answer key")
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--model-card", type=Path, default=DEFAULT_MODEL_CARD)
    parser.add_argument("--template", type=Path, default=TEMPLATE_JSON)
    parser.add_argument("--reference", type=Path, default=DEFAULT_REFERENCE)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument(
        "--low-confidence-threshold",
        type=float,
        help=f"override model-card default ({DEFAULT_LOW_CONFIDENCE_THRESHOLD})",
    )
    parser.add_argument(
        "--erasure-threshold",
        type=float,
        help=f"override model-card default ({DEFAULT_ERASURE_THRESHOLD})",
    )
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    parser.add_argument("--debug-overlay", type=Path, help="optional registered overlay PNG")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image = cv2.imread(str(args.image), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"could not read image: {args.image}")

    answer_key = None
    if args.answer_key is not None:
        try:
            answer_key = json.loads(args.answer_key.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"could not load answer key {args.answer_key}: {exc}") from exc

    service = RecognitionService(
        checkpoint_path=args.checkpoint,
        model_card_path=args.model_card,
        template_path=args.template,
        reference_path=args.reference,
        device=args.device,
        batch_size=args.batch_size,
        low_confidence_threshold=args.low_confidence_threshold,
        erasure_threshold=args.erasure_threshold,
    )
    run = service.process(image, answer_key=answer_key)
    run.report["source_image"] = args.image.as_posix()

    rendered = json.dumps(run.report, indent=2)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    if args.debug_overlay is not None:
        write_debug_overlay(run, args.debug_overlay)
    print(rendered)


if __name__ == "__main__":
    main()
