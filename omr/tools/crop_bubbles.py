"""Crop template ROIs from a registered sheet and label them from the JSON truth.

Layout
------
Crops are grouped by class, then by sheet::

    crops/preview/shaded/sheet_001/sheet_001_math_i01_B.png
    crops/train/shaded/sheet_002/sheet_002_math_i01_B.png

Every filename carries its sheet id, and each crop is also listed in a manifest
so you can group or filter by sheet::

    crops/preview/_manifest.csv   sheet_id,split,class,path
    crops/_manifest.csv           sheet_id,split,class,path

``path`` is relative to the manifest's folder and includes the sheet folder.
Training reads the manifest, not ``ImageFolder``, because ``ImageFolder`` does
not see images nested one level below the class folder.

Modes
-----
preview : write crops to ``crops/preview/<class>/<sheet_id>/``, refresh the
          preview manifest, and build a per-sheet contact sheet for QA.
label   : write crops to ``crops/<split>/<class>/<sheet_id>/`` and refresh the
          training manifest.

Class rules (per bubble):
    state == erasure without "erased"    -> marked letter erasure_smudge
    state == erasure with "erased": X    -> X erasure_smudge, marked shaded
    letter marked                        -> shaded
    otherwise                            -> empty

Multi-mark items stay ``state: multi`` in the truth with every marked
letter listed. Each filled bubble is still a ``shaded`` crop: a 44x44
crop cannot see the neighbouring bubble, so multi is decided at item
level by counting shaded bubbles.

Usage (from omr/):
    python tools/crop_bubbles.py preview \
        --image dataset/raw_sheets/sheet_001.jpg \
        --truth dataset/raw_sheets/sheet_001.json
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.preprocess import register_file
from tools.calibrate_template import center, detect_circles

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "core" / "templates" / "tmc_v1.json"
REFERENCE_PATH = ROOT.parent / "Answer_Key_Format.jpg"
OPTION_LETTERS = "ABCDE"
CLASSES = ("shaded", "empty", "erasure_smudge")
MANIFEST_FIELDS = ("sheet_id", "split", "class", "path")


def _polyfit_rows(rows: list[tuple[int, float, float, int]]) -> tuple[np.ndarray, np.ndarray]:
    """Fit dx(j) and dy(j) from per-row median offsets."""
    if not rows:
        return np.array([0.0]), np.array([0.0])
    j = np.array([r[0] for r in rows], dtype=np.float64)
    dx = np.array([r[1] for r in rows], dtype=np.float64)
    dy = np.array([r[2] for r in rows], dtype=np.float64)
    degree = 2 if len(rows) >= 6 else (1 if len(rows) >= 3 else 0)
    return np.polyfit(j, dx, degree), np.polyfit(j, dy, degree)


def refine_lattice(warped: np.ndarray, template: dict, max_shift: float = 28.0) -> dict:
    """Estimate a per-row (dx, dy) correction from the printed bubble rings.

    The page is already SIFT-registered, so residuals are small and smooth.
    Using the printed rings (not the shaded marks) keeps this independent of
    the answer truth, so it works identically at inference time.
    """
    circles = detect_circles(cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY))
    offsets = {}
    for section in template["sections"]:
        rows = []
        for item in range(1, section["items"] + 1):
            found = []
            for option in range(section["options"]):
                cx, cy = center(section, item, option)
                distance = np.hypot(circles[:, 0] - cx, circles[:, 1] - cy)
                nearest = int(np.argmin(distance))
                if distance[nearest] <= max_shift:
                    found.append(
                        (circles[nearest, 0] - cx, circles[nearest, 1] - cy)
                    )
            if found:
                median = np.median(np.array(found), axis=0)
                rows.append((item, float(median[0]), float(median[1]), len(found)))
        offsets[section["name"]] = _polyfit_rows(rows)
    return offsets


def refined_center(section: dict, item: int, option: int, offsets: dict) -> tuple[float, float]:
    cx, cy = center(section, item, option)
    if section["name"] in offsets:
        dx_coef, dy_coef = offsets[section["name"]]
        cx += float(np.polyval(dx_coef, item))
        cy += float(np.polyval(dy_coef, item))
    return cx, cy



def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def classify(truth_row: dict, letter: str) -> str:
    state = truth_row.get("state", "blank")
    marked_set = _letter_set(truth_row.get("marked"))

    if state == "erasure":
        erased = truth_row.get("erased")
        if erased is None:
            # smudge sits on the marked option itself (e.g. sheet_006)
            if letter in marked_set:
                return "erasure_smudge"
        else:
            # fill on the marked option, smudge on a different option
            if letter in _letter_set(erased):
                return "erasure_smudge"
    if letter in marked_set:
        return "shaded"
    return "empty"


def _letter_set(value: object) -> set[str]:
    """Return one or more answer letters from a truth-field value."""
    if isinstance(value, str):
        return {value}
    if isinstance(value, list):
        return {item for item in value if isinstance(item, str)}
    return set()


def crop_sheet(warped: np.ndarray, template: dict, truth: dict, offsets: dict) -> list[dict]:
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    size = template["roi_size"]
    half = size // 2
    lookups = {(row["section"], row["item"]): row for row in truth["items"]}

    records = []
    for section in template["sections"]:
        for item in range(1, section["items"] + 1):
            row = lookups.get((section["name"], item), {"marked": None, "state": "blank"})
            for option in range(section["options"]):
                letter = OPTION_LETTERS[option]
                cx, cy = refined_center(section, item, option, offsets)
                x0, y0 = int(round(cx)) - half, int(round(cy)) - half
                roi = gray[y0 : y0 + size, x0 : x0 + size]
                if roi.shape != (size, size):
                    continue
                label = classify(row, letter)
                records.append({
                    "image": roi, "label": label,
                    "name": f"{section['name']}_i{item:02d}_{letter}",
                    "section": section["name"], "item": item, "letter": letter,
                })
    return records


def _update_manifest(path: Path, rows: list[dict]) -> None:
    """Replace this sheet's rows, keep the rows of every other sheet."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sheets = {row["sheet_id"] for row in rows}
    kept = []
    if path.exists():
        with path.open(newline="", encoding="utf-8") as handle:
            kept = [
                row for row in csv.DictReader(handle)
                if row.get("sheet_id") not in sheets
            ]
    merged = sorted(
        kept + rows,
        key=lambda row: (row["sheet_id"], row["split"], row["class"], row["path"]),
    )
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS)
        writer.writeheader()
        writer.writerows(merged)


def _rows_for_sheet(path: Path, sheet_id: str) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return [row for row in csv.DictReader(handle) if row["sheet_id"] == sheet_id]


def write_crops(
    records: list[dict], out_dir: Path, sheet_id: str, split: str, manifest: Path
) -> dict[str, int]:
    """Write ``sheet_id``-prefixed crops and list them in ``manifest``."""
    counts = {name: 0 for name in CLASSES}
    old_rows = _rows_for_sheet(manifest, sheet_id)

    for name in CLASSES:
        for stale in (out_dir / name / sheet_id).glob(f"{sheet_id}_*.png"):
            stale.unlink()

    rows = []
    for record in records:
        label = record["label"]
        folder = out_dir / label / sheet_id
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{sheet_id}_{record['name']}.png"
        cv2.imwrite(str(path), record["image"])
        counts[label] += 1
        rows.append({
            "sheet_id": sheet_id, "split": split, "class": label,
            "path": path.relative_to(manifest.parent).as_posix(),
        })

    # Remove this sheet's crops that the new run did not produce (class or
    # split changed, or the truth was corrected).
    keep = {row["path"] for row in rows}
    for old in old_rows:
        if old["path"] not in keep:
            stale = manifest.parent / old["path"]
            if stale.exists():
                stale.unlink()

    _update_manifest(manifest, rows)
    return counts


def contact_sheet(records: list[dict], path: Path, per_class: int = 40, scale: int = 4) -> None:
    cells = []
    for name in CLASSES:
        bucket = [r for r in records if r["label"] == name][:per_class]
        cells.extend(bucket)
    if not cells:
        return

    cell_w = 44 * scale + 8
    cell_h = 44 * scale + 26
    columns = 10
    rows = (len(cells) + columns - 1) // columns
    sheet = np.full((rows * cell_h, columns * cell_w, 3), 255, dtype=np.uint8)

    for index, record in enumerate(cells):
        r, c = divmod(index, columns)
        big = cv2.resize(record["image"], (44 * scale, 44 * scale), interpolation=cv2.INTER_NEAREST)
        big = cv2.cvtColor(big, cv2.COLOR_GRAY2BGR)
        ox, oy = c * cell_w + 4, r * cell_h + 4
        sheet[oy : oy + big.shape[0], ox : ox + big.shape[1]] = big
        cv2.putText(sheet, record["label"][:9], (ox, oy + big.shape[0] + 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), sheet)


def overlay(warped: np.ndarray, template: dict, offsets: dict, path: Path) -> None:
    vis = warped.copy()
    for section in template["sections"]:
        for item in range(1, section["items"] + 1):
            for option in range(section["options"]):
                cx, cy = refined_center(section, item, option, offsets)
                cv2.circle(vis, (int(round(cx)), int(round(cy))), template["roi_size"] // 2,
                           (0, 0, 255), 1)
    cv2.imwrite(str(path), cv2.resize(vis, None, fx=0.5, fy=0.5))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)

    preview = sub.add_parser("preview")
    preview.add_argument("--image", type=Path, required=True)
    preview.add_argument("--truth", type=Path, required=True)
    preview.add_argument("--template", type=Path, default=TEMPLATE_PATH)
    preview.add_argument("--dataset", type=Path, default=ROOT / "dataset")
    preview.add_argument("--sheet-id", default=None)

    label = sub.add_parser("label")
    label.add_argument("--image", type=Path, required=True)
    label.add_argument("--truth", type=Path, required=True)
    label.add_argument("--template", type=Path, default=TEMPLATE_PATH)
    label.add_argument("--dataset", type=Path, default=ROOT / "dataset")
    label.add_argument("--split", choices=("train", "val", "test"), required=True)
    label.add_argument("--sheet-id", default=None)

    args = parser.parse_args()
    template = load_json(args.template)
    warped, info = register_file(args.image, REFERENCE_PATH)
    print(f"registration: {info['method']} matches={info['matches']} inliers={info['inliers']}")

    sheet_id = args.sheet_id or args.image.stem
    truth = load_json(args.truth)
    offsets = refine_lattice(warped, template)
    records = crop_sheet(warped, template, truth, offsets)
    print(f"{sheet_id}: {len(records)} crops")

    if args.mode == "preview":
        out_dir = args.dataset / "crops" / "preview"
        manifest = out_dir / "_manifest.csv"
        counts = write_crops(records, out_dir, sheet_id, "preview", manifest)
        print("classes:", counts)
        contact_sheet(records, out_dir / f"_contact_sheet_{sheet_id}.png")
        overlay(warped, template, offsets, out_dir / f"_overlay_{sheet_id}.png")
        print(f"wrote {out_dir}")
        print(f"  _manifest.csv                (sheet_id, split, class, path)")
        print(f"  _contact_sheet_{sheet_id}.png  (inspect this)")
        print(f"  _overlay_{sheet_id}.png        (ROI alignment)")
    else:
        out_dir = args.dataset / "crops" / args.split
        manifest = args.dataset / "crops" / "_manifest.csv"
        counts = write_crops(records, out_dir, sheet_id, args.split, manifest)
        print("classes:", counts)
        print(f"wrote {out_dir}")
        print(f"manifest: {manifest}")


if __name__ == "__main__":
    main()
