import json
from pathlib import Path

import pytest

from core.bubble_model import file_sha256
from tools.evaluate_model import (
    classification_metrics,
    require_reference_cpu,
    verify_expected,
    verify_model_card_hashes,
)


def test_classification_metrics_match_saved_test_confusion_matrix():
    metrics = classification_metrics(
        [[278, 0, 16], [0, 924, 4], [1, 0, 7]],
        ("shaded", "empty", "erasure_smudge"),
    )

    assert metrics["accuracy"] == pytest.approx(0.9829268292682927)
    assert metrics["balanced_accuracy"] == pytest.approx(0.9387559621549769)
    assert metrics["macro_f1"] == pytest.approx(0.7893905869729374)
    assert metrics["per_class"]["shaded"]["recall"] == pytest.approx(0.9455782312925171)
    assert metrics["per_class"]["erasure_smudge"]["precision"] == pytest.approx(
        0.25925925925925924
    )


def _write_model_card(path: Path, checkpoint: Path, manifest: Path) -> None:
    path.write_text(
        json.dumps(
            {
                "architecture": "BubbleCNN",
                "checkpoint_sha256": file_sha256(checkpoint),
                "dataset": {"manifest_sha256": file_sha256(manifest)},
            }
        ),
        encoding="utf-8",
    )


def test_model_card_hashes_accept_matching_artifacts(tmp_path: Path):
    checkpoint = tmp_path / "best.pt"
    manifest = tmp_path / "_manifest.csv"
    model_card = tmp_path / "model_card.json"
    checkpoint.write_bytes(b"checkpoint")
    manifest.write_bytes(b"manifest")
    _write_model_card(model_card, checkpoint, manifest)

    card = verify_model_card_hashes(model_card, checkpoint, manifest)

    assert card["checkpoint_sha256"] == file_sha256(checkpoint)


@pytest.mark.parametrize(
    ("artifact", "message"),
    (("checkpoint", "checkpoint SHA-256 mismatch"), ("manifest", "manifest SHA-256 mismatch")),
)
def test_model_card_hashes_reject_changed_artifacts(
    tmp_path: Path, artifact: str, message: str
):
    checkpoint = tmp_path / "best.pt"
    manifest = tmp_path / "_manifest.csv"
    model_card = tmp_path / "model_card.json"
    checkpoint.write_bytes(b"checkpoint")
    manifest.write_bytes(b"manifest")
    _write_model_card(model_card, checkpoint, manifest)
    if artifact == "checkpoint":
        checkpoint.write_bytes(b"changed checkpoint")
    else:
        manifest.write_bytes(b"changed manifest")

    with pytest.raises(RuntimeError, match=message):
        verify_model_card_hashes(model_card, checkpoint, manifest)


def test_reference_verification_accepts_explicit_cpu():
    require_reference_cpu("cpu")


@pytest.mark.parametrize("device_name", ("auto", "cuda"))
def test_reference_verification_rejects_unpinned_or_non_cpu_device(device_name: str):
    with pytest.raises(ValueError, match="requires --device cpu"):
        require_reference_cpu(device_name)


def test_saved_report_comparison_rejects_non_cpu_result(tmp_path: Path):
    with pytest.raises(ValueError, match="requires --device cpu"):
        verify_expected({"device": "cuda"}, tmp_path / "not-read.json")
