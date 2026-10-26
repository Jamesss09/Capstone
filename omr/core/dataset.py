"""Manifest-backed dataset for bubble crops.

Crops live at ``<split>/<class>/<sheet_id>/<file>.png`` and are indexed by a
``_manifest.csv`` with ``sheet_id,split,class,path`` columns.

``torchvision.datasets.ImageFolder`` is deliberately not used: it only reads
files directly under the class folder, and it renumbers classes based on which
folders exist in each split. The manifest keeps class indices fixed and makes
the split a column, so whole sheets can be reassigned without copying files.
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Callable

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

CLASSES = ("shaded", "empty", "erasure_smudge")
CLASS_TO_IDX = {name: index for index, name in enumerate(CLASSES)}


class BubbleDataset(Dataset):
    """Load 44x44 grayscale bubble crops listed in a manifest.

    Parameters
    ----------
    manifest:
        Path to ``_manifest.csv``.
    split:
        ``train``, ``val``, ``test``, or ``preview``. ``None`` loads every row.
    root:
        Folder that manifest paths are relative to. Defaults to the manifest's
        own folder.
    transform:
        Optional callable ``numpy.ndarray -> torch.Tensor`` (HxW uint8 in,
        CHW float out). When omitted the image is scaled to ``[0, 1]`` and
        returned as a 1xHxW tensor.
    """

    def __init__(
        self,
        manifest: str | Path,
        split: str | None = None,
        root: str | Path | None = None,
        transform: Callable[[np.ndarray], torch.Tensor] | None = None,
    ) -> None:
        self.manifest = Path(manifest)
        self.root = Path(root) if root is not None else self.manifest.parent
        self.transform = transform
        self.classes = CLASSES
        self.class_to_idx = CLASS_TO_IDX

        with self.manifest.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        if split is not None:
            rows = [row for row in rows if row["split"] == split]

        if not rows:
            wanted = f"split {split!r}" if split is not None else "any rows"
            raise ValueError(f"no crops for {wanted} in {self.manifest}")

        unknown = sorted({row["class"] for row in rows} - set(CLASS_TO_IDX))
        if unknown:
            raise ValueError(f"unknown classes in {self.manifest}: {unknown}")

        self.samples: list[tuple[Path, int, str]] = [
            (self.root / row["path"], CLASS_TO_IDX[row["class"]], row["sheet_id"])
            for row in rows
        ]
        self.targets = [label for _, label, _ in self.samples]
        self.sheet_ids = [sheet for _, _, sheet in self.samples]

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        path, label, _sheet = self.samples[index]
        image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if image is None:
            raise FileNotFoundError(f"could not read {path}")
        if self.transform is not None:
            tensor = self.transform(image)
        else:
            tensor = torch.from_numpy(image).float().div_(255.0).unsqueeze(0)
        return tensor, label

    def sheets(self) -> set[str]:
        """Sheet ids present in this split, for leakage checks."""
        return set(self.sheet_ids)

    def class_counts(self) -> dict[str, int]:
        counts = {name: 0 for name in CLASSES}
        for label in self.targets:
            counts[CLASSES[label]] += 1
        return counts

    def __repr__(self) -> str:
        return (
            f"BubbleDataset(split_rows={len(self)}, sheets={len(self.sheets())}, "
            f"classes={self.class_counts()})"
        )
