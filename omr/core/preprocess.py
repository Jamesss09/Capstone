"""Register a captured answer sheet to the canonical template.

Primary method: SIFT feature matching between the blank reference scan and the
capture, then a RANSAC homography. This is far more accurate than warping the
paper outline, because it aligns the *printed content* (borders, text, bubbles)
rather than the paper edge.

Fallback: Otsu page detection + four-point perspective warp.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

TEMPLATE_JSON = Path(__file__).resolve().parent / "templates" / "tmc_v1.json"


def _order_quad(pts: np.ndarray) -> np.ndarray:
    pts = np.asarray(pts, dtype=np.float32).reshape(4, 2)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array(
        [pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]],
        dtype=np.float32,
    )


def find_page_quad(img: np.ndarray) -> np.ndarray | None:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) < 0.10 * img.shape[0] * img.shape[1]:
        return None
    peri = cv2.arcLength(contour, True)
    for eps in (0.02, 0.03, 0.05, 0.08):
        approx = cv2.approxPolyDP(contour, eps * peri, True)
        if len(approx) == 4:
            return _order_quad(approx)
    return _order_quad(cv2.boxPoints(cv2.minAreaRect(contour)))


def _quad_warp(img: np.ndarray, width: int, height: int) -> np.ndarray:
    quad = find_page_quad(img)
    if quad is None:
        raise ValueError("could not locate the page")
    dst = np.array(
        [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32
    )
    matrix = cv2.getPerspectiveTransform(quad, dst)
    return cv2.warpPerspective(img, matrix, (width, height))


def register(
    img: np.ndarray, reference: np.ndarray, min_inliers: int = 40
) -> tuple[np.ndarray, dict]:
    """Warp ``img`` into the reference frame. Returns (warped, diagnostics)."""
    height, width = reference.shape[:2]
    gray_ref = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
    gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    sift = cv2.SIFT_create(nfeatures=8000)
    kp_ref, des_ref = sift.detectAndCompute(gray_ref, None)
    kp_img, des_img = sift.detectAndCompute(gray_img, None)

    info = {"method": "quad", "matches": 0, "inliers": 0}
    if des_ref is not None and des_img is not None and len(kp_ref) and len(kp_img):
        matcher = cv2.BFMatcher()
        pairs = matcher.knnMatch(des_ref, des_img, k=2)
        good = [a for a, b in pairs if a.distance < 0.75 * b.distance]
        if len(good) >= min_inliers:
            src = np.float32([kp_img[m.trainIdx].pt for m in good])   # capture
            dst = np.float32([kp_ref[m.queryIdx].pt for m in good])   # reference
            matrix, mask = cv2.findHomography(src, dst, cv2.RANSAC, 4.0)
            inliers = int(mask.sum()) if mask is not None else 0
            if matrix is not None and inliers >= min_inliers:
                warped = cv2.warpPerspective(img, matrix, (width, height))
                info.update(method="sift", matches=len(good), inliers=inliers)
                return warped, info

    warped = _quad_warp(img, width, height)
    return warped, info


def register_file(image_path: Path, reference_path: Path) -> tuple[np.ndarray, dict]:
    image = cv2.imread(str(image_path))
    reference = cv2.imread(str(reference_path))
    if image is None:
        raise SystemExit(f"could not read {image_path}")
    if reference is None:
        raise SystemExit(f"could not read {reference_path}")
    return register(image, reference)
