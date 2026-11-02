from pathlib import Path

import cv2
import numpy as np
import pytest
import torch

import core.dataset as dataset_module
from core.bubble_model import BubbleCNN, bubble_to_tensor, load_bubble_model
from core.dataset import BubbleDataset


def test_bubble_cnn_output_shape():
    model = BubbleCNN(num_classes=3).eval()

    with torch.inference_mode():
        output = model(torch.zeros(4, 1, 44, 44))

    assert output.shape == (4, 3)


def test_bubble_preprocessing_matches_dataset_scaling():
    image = np.full((44, 44), 128, dtype=np.uint8)

    tensor = bubble_to_tensor(image)

    assert tensor.shape == (1, 44, 44)
    assert tensor.dtype == torch.float32
    assert tensor[0, 0, 0].item() == pytest.approx(128 / 255)


def test_bubble_preprocessing_resizes_color_images():
    image = np.full((20, 30, 3), 255, dtype=np.uint8)

    tensor = bubble_to_tensor(image)

    assert tensor.shape == (1, 44, 44)
    assert torch.all(tensor == 1)


def test_dataset_default_uses_shared_model_preprocessing(tmp_path: Path, monkeypatch):
    crop = tmp_path / "crop.png"
    manifest = tmp_path / "_manifest.csv"
    cv2.imwrite(str(crop), np.full((20, 30), 128, dtype=np.uint8))
    manifest.write_text(
        "sheet_id,split,class,path\n"
        "sheet_001,test,shaded,crop.png\n",
        encoding="utf-8",
    )
    expected = torch.full((1, 44, 44), 0.25)
    calls = []

    def fake_preprocessing(image: np.ndarray) -> torch.Tensor:
        calls.append(image.shape)
        return expected

    monkeypatch.setattr(dataset_module, "bubble_to_tensor", fake_preprocessing)

    tensor, label = BubbleDataset(manifest, split="test")[0]

    assert tensor is expected
    assert label == 0
    assert calls == [(20, 30)]


def test_checkpoint_loader_restores_model_and_metadata(tmp_path: Path):
    checkpoint = tmp_path / "model.pt"
    original = BubbleCNN(num_classes=3)
    torch.save(
        {
            "model": "BubbleCNN",
            "num_classes": 3,
            "classes": ["shaded", "empty", "erasure_smudge"],
            "state_dict": original.state_dict(),
            "best_epoch": 10,
            "seed": 42,
            "class_weights": [1.0, 2.0, 3.0],
        },
        checkpoint,
    )

    loaded = load_bubble_model(checkpoint)

    assert loaded.classes == ("shaded", "empty", "erasure_smudge")
    assert loaded.best_epoch == 10
    assert loaded.seed == 42
    assert loaded.class_weights == (1.0, 2.0, 3.0)
    assert loaded.model.training is False
    assert len(loaded.checkpoint_sha256) == 64


def test_checkpoint_loader_rejects_unknown_architecture(tmp_path: Path):
    checkpoint = tmp_path / "bad.pt"
    torch.save(
        {
            "model": "DifferentCNN",
            "num_classes": 3,
            "classes": ["shaded", "empty", "erasure_smudge"],
            "state_dict": {},
        },
        checkpoint,
    )

    with pytest.raises(ValueError, match="unsupported checkpoint model"):
        load_bubble_model(checkpoint)
