"""Calibrate the bubble lattice from the blank reference scan.

Fits, per section:

    x(i) = x0 + dx*i
    y(j) = y0 + dy*j + dy2*j*j

where ``i`` is the option index (A=0) and ``j`` the item index-1. The quadratic
term absorbs the mild vertical stretch of a printed/scanned sheet.

Usage (from omr/):
    python tools/calibrate_template.py --ref ../Answer_Key_Format.jpg \
        --out core/templates/tmc_v1.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

SECTIONS = [
    ("inductive", 10, 5, (185, 505), (590, 1240)),
    ("math", 30, 4, (205, 465), (1330, 3270)),
    ("english", 30, 4, (1200, 1470), (600, 2500)),
    ("science", 20, 4, (1820, 2090), (590, 1860)),
    ("aptitude", 10, 4, (1820, 2090), (1870, 2570)),
]

ROI_SIZE = 44


def _cluster(values: list[float], gap: float = 14.0) -> list[tuple[float, int]]:
    if not values:
        return []
    values = sorted(values)
    groups: list[list[float]] = [[values[0]]]
    for value in values[1:]:
        if value - groups[-1][-1] <= gap:
            groups[-1].append(value)
        else:
            groups.append([value])
    return [(float(np.mean(g)), len(g)) for g in groups]


def _fit_line(positions: list[float]) -> tuple[float, float, float]:
    idx = np.arange(len(positions), dtype=np.float64)
    coef = np.polyfit(idx, np.asarray(positions, dtype=np.float64), 1)
    step, origin = float(coef[0]), float(coef[1])
    rms = float(np.sqrt(np.mean((np.asarray(positions) - np.polyval(coef, idx)) ** 2)))
    return origin, step, rms


def _fit_lattice(positions: list[float]) -> tuple[float, float, float, float]:
    pos = np.asarray(positions, dtype=np.float64)
    idx = np.arange(len(pos), dtype=np.float64)
    degree = 2 if len(pos) >= 6 else 1
    keep = np.ones(len(pos), dtype=bool)
    coef = np.polyfit(idx, pos, degree)
    for _ in range(3):
        residual = np.abs(pos - np.polyval(coef, idx))
        new_keep = residual <= max(2.0, 3.0 * float(np.median(residual)))
        if new_keep.sum() < len(pos) - 3 or new_keep.sum() < degree + 2:
            break
        keep = new_keep
        coef = np.polyfit(idx[keep], pos[keep], degree)
    rms = float(np.sqrt(np.mean((pos - np.polyval(coef, idx)) ** 2)))
    if degree == 2:
        c2, c1, c0 = (float(v) for v in coef)
    else:
        c1, c0 = (float(v) for v in coef)
        c2 = 0.0
    return c0, c1, c2, rms


def _pick_run(clusters: list[tuple[float, int]], count: int, min_support: int = 1) -> list[float]:
    strong = [c for c in clusters if c[1] >= min_support]
    if len(strong) < count:
        strong = [c for c in clusters if c[1] >= 2]
    if len(strong) < count:
        raise ValueError(f"need {count} clusters, found {len(strong)}")
    best: tuple[float, list[float]] | None = None
    for start in range(len(strong) - count + 1):
        run = [c[0] for c in strong[start : start + count]]
        _, step, rms = _fit_line(run)
        if not 40.0 <= abs(step) <= 90.0:
            continue
        if best is None or rms < best[0]:
            best = (rms, run)
    if best is None:
        raise ValueError("no plausible lattice")
    return best[1]


def detect_circles(gray: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1, minDist=25,
        param1=80, param2=16, minRadius=14, maxRadius=22,
    )
    if circles is None:
        return np.empty((0, 3), dtype=np.float32)
    return np.round(circles[0]).astype(np.float32)


def center(section: dict, item: int, option: int) -> tuple[float, float]:
    x = section["x0"] + section["dx"] * option
    j = item - 1
    y = section["y0"] + section["dy"] * j + section.get("dy2", 0.0) * j * j
    return x, y


def calibrate(reference: Path) -> dict:
    img = cv2.imread(str(reference))
    if img is None:
        raise SystemExit(f"could not read {reference}")
    height, width = img.shape[:2]
    circles = detect_circles(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))

    sections, overlay = [], img.copy()
    for name, items, options, (x0b, x1b), (y0b, y1b) in SECTIONS:
        pts = circles[
            (circles[:, 0] > x0b) & (circles[:, 0] < x1b)
            & (circles[:, 1] > y0b) & (circles[:, 1] < y1b)
        ]
        if len(pts) < options + 2:
            raise SystemExit(f"{name}: only {len(pts)} circles")
        xs = _pick_run(_cluster(pts[:, 0].tolist()), options, min_support=3)
        ys = _pick_run(_cluster(pts[:, 1].tolist()), items, min_support=3)
        ox, dx, xrms = _fit_line(xs)
        oy, dy, dy2, yrms = _fit_lattice(ys)

        hits = 0
        for j in range(items):
            for i in range(options):
                cx = ox + i * dx
                cy = oy + dy * j + dy2 * j * j
                if np.hypot(pts[:, 0] - cx, pts[:, 1] - cy).min() <= 7.0:
                    hits += 1
                cv2.circle(overlay, (int(round(cx)), int(round(cy))), 21, (0, 0, 255), 1)
        coverage = hits / (items * options)

        sections.append({
            "name": name, "items": items, "options": options,
            "x0": round(ox, 2), "dx": round(dx, 2),
            "y0": round(oy, 2), "dy": round(dy, 4), "dy2": round(dy2, 5),
            "calibration": {"x_rms": round(xrms, 2), "y_rms": round(yrms, 2),
                            "coverage": round(coverage, 3)},
        })
        print(f"{name:10s} items={items:2d} opts={options} x0={ox:7.2f} dx={dx:6.2f} "
              f"y0={oy:7.2f} dy={dy:7.3f} dy2={dy2:+.5f} "
              f"xrms={xrms:.2f} yrms={yrms:.2f} coverage={coverage:.1%}")

    return {
        "template_id": "tmc-v1", "reference": reference.name,
        "size": [width, height], "roi_size": ROI_SIZE,
        "sections": sections, "_overlay": overlay,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ref", type=Path, default=Path("../Answer_Key_Format.jpg"))
    parser.add_argument("--out", type=Path, default=Path("core/templates/tmc_v1.json"))
    parser.add_argument("--overlay", type=Path, default=None)
    args = parser.parse_args()

    template = calibrate(args.ref)
    overlay = template.pop("_overlay")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(template, indent=2), encoding="utf-8")
    print(f"wrote {args.out}")
    overlay_path = args.overlay or args.out.with_name("calibration_overlay.png")
    cv2.imwrite(str(overlay_path), overlay)
    print(f"wrote {overlay_path}")


if __name__ == "__main__":
    main()
