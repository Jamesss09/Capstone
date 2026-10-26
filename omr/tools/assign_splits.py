"""Reassign whole sheets to train/val/test and update the training manifest.

A sheet always moves as a unit, so its crops can never end up in two splits.
Run without ``--apply`` to print the plan first.

Usage (from omr/):
    python tools/assign_splits.py --train sheet_001 sheet_002 --val sheet_009
    python tools/assign_splits.py --train sheet_001 sheet_002 --val sheet_009 --apply
"""
from __future__ import annotations

import argparse
import csv
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_FIELDS = ("sheet_id", "split", "class", "path")
SPLITS = ("train", "val", "test")


def load_manifest(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"manifest not found: {path}")
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_manifest(path: Path, rows: list[dict]) -> None:
    rows = sorted(
        rows,
        key=lambda row: (row["sheet_id"], row["split"], row["class"], row["path"]),
    )
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def parse_assignments(args: argparse.Namespace) -> dict[str, str]:
    assignments: dict[str, str] = {}
    for split in SPLITS:
        for sheet in getattr(args, split):
            if sheet in assignments:
                raise SystemExit(
                    f"{sheet} is listed in both {assignments[sheet]} and {split}"
                )
            assignments[sheet] = split
    return assignments


def prune_empty(crops_root: Path) -> None:
    for split in SPLITS:
        root = crops_root / split
        if not root.exists():
            continue
        for path in sorted(root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            if path.is_dir() and not any(path.iterdir()):
                path.rmdir()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=ROOT / "dataset")
    parser.add_argument(
        "--manifest", type=Path, default=None,
        help="default: <dataset>/crops/_manifest.csv",
    )
    parser.add_argument("--train", nargs="+", default=[], metavar="SHEET")
    parser.add_argument("--val", nargs="+", default=[], metavar="SHEET")
    parser.add_argument("--test", nargs="+", default=[], metavar="SHEET")
    parser.add_argument(
        "--apply", action="store_true",
        help="move the files and rewrite the manifest (default is a dry run)",
    )
    args = parser.parse_args()

    manifest = args.manifest or args.dataset / "crops" / "_manifest.csv"
    crops_root = manifest.parent
    rows = load_manifest(manifest)
    assignments = parse_assignments(args)
    if not assignments:
        raise SystemExit("assign at least one sheet with --train/--val/--test")

    known = {row["sheet_id"] for row in rows}
    unknown = sorted(set(assignments) - known)
    if unknown:
        raise SystemExit(f"sheets not in the manifest: {', '.join(unknown)}")

    by_sheet: dict[str, list[dict]] = {}
    for row in rows:
        by_sheet.setdefault(row["sheet_id"], []).append(row)

    plan = []
    for sheet, split in sorted(assignments.items()):
        targets = [
            (
                row,
                Path(split) / row["class"] / sheet / Path(row["path"]).name,
            )
            for row in by_sheet[sheet]
        ]
        plan.append((sheet, split, targets))

    for sheet, split, targets in plan:
        current = ", ".join(sorted({row["split"] for row, _ in targets}))
        print(f"{sheet}: {len(targets)} crops  {current} -> {split}")

    if not args.apply:
        print("\ndry run; pass --apply to move files and update the manifest")
        return

    for sheet, split, targets in plan:
        for row, target in targets:
            source = crops_root / row["path"]
            destination = crops_root / target
            if source != destination:
                if source.exists() and destination.exists():
                    raise SystemExit(f"refusing to overwrite {destination}")
                if source.exists():
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(source), str(destination))
                elif not destination.exists():
                    raise SystemExit(f"missing crop: {source}")
            row["split"] = split
            row["path"] = target.as_posix()

    write_manifest(manifest, rows)
    prune_empty(crops_root)
    print(f"\nupdated {manifest}")


if __name__ == "__main__":
    main()
