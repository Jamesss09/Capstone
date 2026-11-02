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


def _validate_bgr(image: np.ndarray, name: str) -> None:
    if not isinstance(image, np.ndarray) or image.size == 0:
        raise ValueError(f"{name} must be a non-empty image")
    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError(f"{name} must be a BGR image")


class SheetRegistrar:
    """Register captures while caching the immutable reference descriptors."""

    def __init__(self, reference: np.ndarray, nfeatures: int = 8000) -> None:
        _validate_bgr(reference, "reference")
        if nfeatures < 1:
            raise ValueError("nfeatures must be at least 1")
        self.reference = reference
        self.height, self.width = reference.shape[:2]
        self.nfeatures = nfeatures
        gray_reference = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
        sift = cv2.SIFT_create(nfeatures=nfeatures)
        self.reference_keypoints, self.reference_descriptors = sift.detectAndCompute(
            gray_reference, None
        )
        if self.reference_descriptors is None or not self.reference_keypoints:
            raise ValueError("reference image has no usable SIFT features")

    def register(
        self, image: np.ndarray, min_inliers: int = 40
    ) -> tuple[np.ndarray, dict]:
        """Warp one capture into the cached reference frame."""
        _validate_bgr(image, "capture")
        if min_inliers < 4:
            raise ValueError("min_inliers must be at least 4")

        gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        sift = cv2.SIFT_create(nfeatures=self.nfeatures)
        image_keypoints, image_descriptors = sift.detectAndCompute(gray_image, None)

        info = {"method": "quad", "matches": 0, "inliers": 0, "inlier_ratio": 0.0}
        if image_descriptors is not None and image_keypoints:
            pairs = cv2.BFMatcher().knnMatch(
                self.reference_descriptors, image_descriptors, k=2
            )
            good = [
                pair[0]
                for pair in pairs
                if len(pair) == 2 and pair[0].distance < 0.75 * pair[1].distance
            ]
            info["matches"] = len(good)
            if len(good) >= min_inliers:
                source = np.float32(
                    [image_keypoints[match.trainIdx].pt for match in good]
                )
                destination = np.float32(
                    [self.reference_keypoints[match.queryIdx].pt for match in good]
                )
                matrix, mask = cv2.findHomography(source, destination, cv2.RANSAC, 4.0)
                inliers = int(mask.sum()) if mask is not None else 0
                info["inliers"] = inliers
                info["inlier_ratio"] = inliers / len(good)
                if matrix is not None and inliers >= min_inliers:
                    warped = cv2.warpPerspective(
                        image, matrix, (self.width, self.height)
                    )
                    info["method"] = "sift"
                    return warped, info

        return _quad_warp(image, self.width, self.height), info


def register(
    img: np.ndarray, reference: np.ndarray, min_inliers: int = 40
) -> tuple[np.ndarray, dict]:
    """Warp ``img`` into ``reference`` without retaining a descriptor cache."""
    return SheetRegistrar(reference).register(img, min_inliers=min_inliers)


def register_file(image_path: Path, reference_path: Path) -> tuple[np.ndarray, dict]:
    image = cv2.imread(str(image_path))
    reference = cv2.imread(str(reference_path))
    if image is None:
        raise SystemExit(f"could not read {image_path}")
    if reference is None:
        raise SystemExit(f"could not read {reference_path}")
    return register(image, reference)
