"""Evaluate a bubble-classifier checkpoint against a manifest split.

Run from ``omr/``:

    python tools/evaluate_model.py \
        --checkpoint models/final_three_class/best.pt \
        --manifest dataset/crops/_manifest.csv \
        --model-card models/final_three_class/model_card.json \
        --split test \
        --device cpu \
        --expected-report models/final_three_class/test_report.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

import torch
from torch import nn
from torch.utils.data import DataLoader

# Direct execution sets sys.path[0] to omr/tools rather than omr/. Add the
# service root so the documented ``python tools/evaluate_model.py`` command
# resolves the sibling ``core`` package consistently.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.bubble_model import (
    file_sha256,
    load_bubble_model,
    resolve_device,
    verify_model_card_hashes,
)
from core.dataset import BubbleDataset


def _safe_div(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def classification_metrics(confusion: list[list[int]], classes: tuple[str, ...]) -> dict[str, Any]:
    """Compute dependency-free aggregate and per-class metrics."""
    size = len(classes)
    if len(confusion) != size or any(len(row) != size for row in confusion):
        raise ValueError("confusion matrix dimensions must match classes")

    total = sum(sum(row) for row in confusion)
    correct = sum(confusion[index][index] for index in range(size))
    per_class: dict[str, dict[str, float | int]] = {}

    for index, name in enumerate(classes):
        true_positive = confusion[index][index]
        support = sum(confusion[index])
        predicted = sum(confusion[row][index] for row in range(size))
        precision = _safe_div(true_positive, predicted)
        recall = _safe_div(true_positive, support)
        f1 = _safe_div(2 * precision * recall, precision + recall)
        per_class[name] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": support,
        }

    return {
        "accuracy": _safe_div(correct, total),
        "balanced_accuracy": sum(item["recall"] for item in per_class.values()) / size,
        "macro_f1": sum(item["f1"] for item in per_class.values()) / size,
        "confusion_matrix": confusion,
        "per_class": per_class,
    }


def require_reference_cpu(device_name: str) -> None:
    """Require an explicitly selected CPU for saved-report comparisons."""
    if device_name == "auto":
        raise ValueError("reference report verification requires --device cpu, not auto")
    try:
        device = torch.device(device_name)
    except (RuntimeError, TypeError) as exc:
        raise ValueError(f"invalid torch device {device_name!r}") from exc
    if device.type != "cpu":
        raise ValueError("reference report verification requires --device cpu")


def evaluate(
    checkpoint: Path,
    manifest: Path,
    split: str,
    model_card: Path,
    batch_size: int = 64,
    device_name: str = "cpu",
) -> dict[str, Any]:
    """Evaluate one manifest split and return a JSON-serializable report."""
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")

    verified_card = verify_model_card_hashes(model_card, checkpoint, manifest)

    device = resolve_device(device_name)
    loaded = load_bubble_model(checkpoint, device=device)
    dataset = BubbleDataset(manifest, split=split)
    if tuple(dataset.classes) != loaded.classes:
        raise ValueError(
            f"dataset classes {tuple(dataset.classes)!r} do not match checkpoint {loaded.classes!r}"
        )

    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    weights = None
    if loaded.class_weights is not None:
        weights = torch.tensor(loaded.class_weights, dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=weights)

    confusion = [[0 for _ in loaded.classes] for _ in loaded.classes]
    loss_sum = 0.0
    sample_count = 0
    loaded.model.eval()

    with torch.inference_mode():
        for images, targets in loader:
            images = images.to(device)
            targets = targets.to(device)
            logits = loaded.model(images)
            loss = criterion(logits, targets)
            predictions = logits.argmax(dim=1)

            current = targets.size(0)
            loss_sum += float(loss.item()) * current
            sample_count += current
            for truth, prediction in zip(targets.cpu().tolist(), predictions.cpu().tolist()):
                confusion[truth][prediction] += 1

    metrics = classification_metrics(confusion, loaded.classes)
    metrics["loss"] = loss_sum / sample_count
    counts = {
        name: metrics["per_class"][name]["support"]
        for name in loaded.classes
    }

    report = {
        "checkpoint": checkpoint.as_posix(),
        "checkpoint_sha256": loaded.checkpoint_sha256,
        "checkpoint_best_epoch": loaded.best_epoch,
        "checkpoint_seed": loaded.seed,
        "manifest": manifest.as_posix(),
        "manifest_sha256": file_sha256(manifest),
        "split": split,
        "batch_size": batch_size,
        "device": str(device),
        "classes": list(loaded.classes),
        "sheets": sorted(dataset.sheets()),
        "counts": counts,
        "metrics": metrics,
    }
    report["model_card"] = model_card.as_posix()
    report["model_card_sha256"] = file_sha256(model_card)
    report["model_id"] = verified_card.get("model_id")
    return report


def verify_expected(actual: dict[str, Any], expected_path: Path) -> None:
    """Fail if core predictions differ from a previously saved report."""
    require_reference_cpu(str(actual.get("device", "")))
    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    expected_metrics = expected["metrics"]
    actual_metrics = actual["metrics"]

    checks = {
        "classes": (actual["classes"], expected["classes"]),
        "sheets": (actual["sheets"], expected["sheets"]),
        "counts": (actual["counts"], expected["counts"]),
        "confusion_matrix": (
            actual_metrics["confusion_matrix"],
            expected_metrics["confusion_matrix"],
        ),
    }
    failures = [name for name, (left, right) in checks.items() if left != right]
    for name in ("loss", "accuracy", "balanced_accuracy", "macro_f1"):
        if abs(float(actual_metrics[name]) - float(expected_metrics[name])) > 1e-9:
            failures.append(name)
    if failures:
        raise RuntimeError(f"evaluation does not reproduce {expected_path}: {', '.join(failures)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument(
        "--model-card",
        type=Path,
        help="defaults to model_card.json beside the checkpoint",
    )
    parser.add_argument("--split", choices=("train", "val", "test"), default="test")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--device", default="cpu", help="cpu, auto, cuda, or another torch device")
    parser.add_argument("--expected-report", type=Path)
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_card = args.model_card or args.checkpoint.parent / "model_card.json"
    if args.expected_report:
        require_reference_cpu(args.device)
    report = evaluate(
        checkpoint=args.checkpoint,
        manifest=args.manifest,
        split=args.split,
        model_card=model_card,
        batch_size=args.batch_size,
        device_name=args.device,
    )
    if args.expected_report:
        verify_expected(report, args.expected_report)
        report["reproduces"] = args.expected_report.as_posix()

    rendered = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
