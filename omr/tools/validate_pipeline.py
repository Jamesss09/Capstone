"""Validate truth-independent extraction and recognition on local labeled sheets.

Ground truth is consulted only after recognition to measure results. Extraction,
lattice refinement, and classification receive only each JPEG.
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
import json
from pathlib import Path
import sys
from typing import Any

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.bubble_model import file_sha256
from core.recognition import (
    DEFAULT_CHECKPOINT,
    DEFAULT_ERASURE_THRESHOLD,
    DEFAULT_LOW_CONFIDENCE_THRESHOLD,
    DEFAULT_MODEL_CARD,
    DEFAULT_REFERENCE,
    RecognitionService,
)
from core.preprocess import TEMPLATE_JSON

CLASSES = ("shaded", "empty", "erasure_smudge")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheets", type=Path, default=ROOT / "dataset" / "raw_sheets")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=ROOT / "dataset" / "crops" / "_manifest.csv",
    )
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
    parser.add_argument("--limit", type=int)
    parser.add_argument("--split", choices=("train", "val", "test"))
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def _manifest_index(manifest: Path) -> dict[str, dict[str, dict[str, str]]]:
    indexed: dict[str, dict[str, dict[str, str]]] = {}
    with manifest.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            indexed.setdefault(row["sheet_id"], {})[Path(row["path"]).name] = row
    return indexed


def _truth_state(row: dict[str, Any]) -> str:
    state = row.get("state", "blank")
    if state == "valid":
        return "answered"
    if state in {"blank", "multi", "erasure"}:
        return state
    raise ValueError(f"unknown truth state {state!r}")


def _recognized_state(item: dict[str, Any]) -> str:
    if "erasure" in item["flags"]:
        return "erasure"
    if "multi_shade" in item["flags"]:
        return "multi"
    return item["status"]


def _class_metrics(confusion: list[list[int]]) -> dict[str, Any]:
    total = sum(sum(row) for row in confusion)
    correct = sum(confusion[index][index] for index in range(len(CLASSES)))
    per_class = {}
    for index, name in enumerate(CLASSES):
        support = sum(confusion[index])
        predicted = sum(row[index] for row in confusion)
        true_positive = confusion[index][index]
        precision = true_positive / predicted if predicted else 0.0
        recall = true_positive / support if support else 0.0
        per_class[name] = {
            "precision": precision,
            "recall": recall,
            "support": support,
        }
    return {
        "accuracy": correct / total if total else 0.0,
        "confusion_matrix": confusion,
        "per_class": per_class,
    }


def main() -> None:
    args = parse_args()
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
    manifest = _manifest_index(args.manifest)
    image_paths = sorted(args.sheets.glob("*.jpg"))
    if args.split is not None:
        image_paths = [
            path
            for path in image_paths
            if path.stem in manifest
            and next(iter(manifest[path.stem].values()))["split"] == args.split
        ]
    if args.limit is not None:
        image_paths = image_paths[: args.limit]
    if not image_paths:
        raise SystemExit(f"no JPG sheets found in {args.sheets}")

    class_to_index = {name: index for index, name in enumerate(CLASSES)}
    confusion = [[0 for _ in CLASSES] for _ in CLASSES]
    crop_mismatches = 0
    missing_stored_crops = 0
    truth_state_counts: Counter[str] = Counter()
    recognized_state_counts: Counter[str] = Counter()
    state_correct = 0
    exact_item_correct = 0
    valid_answer_correct = 0
    valid_answer_total = 0
    split_totals: dict[str, Counter[str]] = {}
    per_sheet = []

    for image_path in image_paths:
        sheet_id = image_path.stem
        truth_path = image_path.with_suffix(".json")
        truth = json.loads(truth_path.read_text(encoding="utf-8"))
        image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
        if image is None:
            raise SystemExit(f"could not read {image_path}")

        run = service.process(image)
        truth_items = {
            (row["section"], int(row["item"])): row for row in truth["items"]
        }
        sheet_state_correct = 0
        sheet_exact_correct = 0
        sheet_valid_correct = 0
        sheet_valid_total = 0

        for item in run.report["items"]:
            expected = truth_items[(item["section"], item["item_number"])]
            expected_state = _truth_state(expected)
            actual_state = _recognized_state(item)
            truth_state_counts[expected_state] += 1
            recognized_state_counts[actual_state] += 1
            state_matches = actual_state == expected_state
            answer_matches = item["marked_answer"] == expected.get("marked")
            if state_matches:
                state_correct += 1
                sheet_state_correct += 1
            if expected_state == "answered":
                valid_answer_total += 1
                sheet_valid_total += 1
                if item["status"] == "answered" and answer_matches:
                    valid_answer_correct += 1
                    sheet_valid_correct += 1
            exact_matches = state_matches and (
                answer_matches if expected_state == "answered" else True
            )
            if exact_matches:
                exact_item_correct += 1
                sheet_exact_correct += 1

        stored = manifest.get(sheet_id, {})
        if not stored:
            raise SystemExit(f"manifest has no crops for {sheet_id}")
        split = next(iter(stored.values()))["split"]
        split_stats = split_totals.setdefault(split, Counter())
        split_stats.update(
            sheets=1,
            items=100,
            state_correct=sheet_state_correct,
            exact_correct=sheet_exact_correct,
            valid_correct=sheet_valid_correct,
            valid_total=sheet_valid_total,
        )
        sheet_crop_mismatches = 0
        sheet_missing_crops = 0
        for crop, prediction in zip(run.crops, run.predictions):
            filename = f"{sheet_id}_{crop.name}.png"
            manifest_row = stored.get(filename)
            if manifest_row is None:
                missing_stored_crops += 1
                sheet_missing_crops += 1
                continue
            saved = cv2.imread(
                str(args.manifest.parent / manifest_row["path"]),
                cv2.IMREAD_GRAYSCALE,
            )
            if saved is None or not np.array_equal(saved, crop.image):
                crop_mismatches += 1
                sheet_crop_mismatches += 1
            truth_class = manifest_row["class"]
            confusion[class_to_index[truth_class]][
                class_to_index[prediction.class_name]
            ] += 1

        per_sheet.append({
            "sheet_id": sheet_id,
            "split": split,
            "registration_method": run.report["registration"]["method"],
            "registration_inliers": run.report["registration"]["inliers"],
            "lattice_quality": run.report["lattice"]["quality"],
            "crop_mismatches": sheet_crop_mismatches,
            "missing_stored_crops": sheet_missing_crops,
            "state_accuracy": sheet_state_correct / 100,
            "exact_item_accuracy": sheet_exact_correct / 100,
            "valid_answer_accuracy": (
                sheet_valid_correct / sheet_valid_total if sheet_valid_total else 0.0
            ),
            "recognition_summary": run.report["summary"],
        })
        print(
            f"{sheet_id}: exact={sheet_exact_correct}/100 "
            f"valid={sheet_valid_correct}/{sheet_valid_total} "
            f"crop_mismatch={sheet_crop_mismatches} "
            f"registration={run.report['registration']['method']}"
        )

    total_items = len(image_paths) * 100
    total_crops = len(image_paths) * 410
    split_item_recognition = {
        split: {
            "sheets": stats["sheets"],
            "items": stats["items"],
            "state_accuracy": stats["state_correct"] / stats["items"],
            "exact_item_accuracy": stats["exact_correct"] / stats["items"],
            "valid_answer_accuracy": stats["valid_correct"] / stats["valid_total"],
            "valid_answer_correct": stats["valid_correct"],
            "valid_answer_total": stats["valid_total"],
        }
        for split, stats in sorted(split_totals.items())
    }
    report = {
        "checkpoint_sha256": service.loaded_model.checkpoint_sha256,
        "manifest_sha256": file_sha256(args.manifest),
        "template_id": service.template.get("template_id"),
        "template_sha256": service.template_sha256,
        "reference_sha256": service.reference_sha256,
        "low_confidence_threshold": service.low_confidence_threshold,
        "erasure_threshold": service.erasure_threshold,
        "sheets": len(image_paths),
        "items": total_items,
        "crops": total_crops,
        "crop_parity": {
            "matching": total_crops - crop_mismatches - missing_stored_crops,
            "mismatched": crop_mismatches,
            "missing": missing_stored_crops,
            "exact": crop_mismatches == 0 and missing_stored_crops == 0,
        },
        "bubble_classification": _class_metrics(confusion),
        "item_recognition": {
            "state_accuracy": state_correct / total_items,
            "exact_item_accuracy": exact_item_correct / total_items,
            "valid_answer_accuracy": valid_answer_correct / valid_answer_total,
            "valid_answer_correct": valid_answer_correct,
            "valid_answer_total": valid_answer_total,
            "truth_state_counts": dict(truth_state_counts),
            "recognized_state_counts": dict(recognized_state_counts),
        },
        "split_item_recognition": split_item_recognition,
        "per_sheet": per_sheet,
    }

    rendered = json.dumps(report, indent=2)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if not report["crop_parity"]["exact"]:
        raise SystemExit("truth-independent crops do not match the locked dataset crops")


if __name__ == "__main__":
    main()
