"""
Swappable object-detection inference for geotagged field imagery.

ARCHITECTURE NOTE:
Stock YOLOv8 (COCO weights) does NOT recognize check dams, farm ponds,
plantations, or vegetation out of the box. Rather than silently fail,
this module exposes a single public entry point `run_detector(image_path)`
that returns `list[Detection]`. Replace the default implementation with
`_run_yolo_detector()` once you have a fine-tuned model on labeled field
photos — the upload/GeoJSON/DB/map wiring below does not change.
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from typing import Literal

DetectionClass = Literal[
    "check_dam",
    "farm_pond",
    "plantation",
    "vegetation",
    "water_body",
    "unclassified",
]

DETECTION_CLASSES: tuple[DetectionClass, ...] = (
    "check_dam",
    "farm_pond",
    "plantation",
    "vegetation",
    "water_body",
    "unclassified",
)


@dataclass
class Detection:
    detected_class: DetectionClass
    confidence: float
    bbox: tuple[float, float, float, float] | None = None  # x1, y1, x2, y2 (0..1 normalized)
    extras: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Deterministic hash-based fallback (ships now — no training required)
# ---------------------------------------------------------------------------
def _hash_based_fallback(image_path: str) -> list[Detection]:
    """
    Produce 1-3 pseudo-detections deterministically derived from the
    file's name + byte size + first 4KB. This is intended ONLY for the
    hackathon demo so the pipeline runs end-to-end without a trained
    model or network access to download YOLO weights.

    For judged presentations: flag this output explicitly as demo data,
    not real detections. A NDVI/NDWI threshold against the matching
    Sentinel-2 tile is a more defensible fallback for vegetation/water
    classes if you have GPS — see `_ndvi_like_from_image()` stub below.
    """
    try:
        size = os.path.getsize(image_path)
    except OSError:
        size = 0
    try:
        with open(image_path, "rb") as fh:
            head = fh.read(4096)
    except OSError:
        head = b""
    name = os.path.basename(image_path)
    digest = hashlib.sha256(f"{name}|{size}|".encode() + head).digest()

    # Draw 1..3 detections from the digest
    n = 1 + (digest[0] % 3)
    detections: list[Detection] = []
    cursor = 1
    for i in range(n):
        if cursor + 2 > len(digest):
            break
        cls_idx = digest[cursor] % len(DETECTION_CLASSES)
        # Confidence: 0.55 .. 0.97
        conf = 0.55 + (digest[cursor + 1] / 255.0) * 0.42
        # Bbox (0..1): derived deterministically from bytes 3..10
        if cursor + 10 <= len(digest):
            x1 = digest[cursor + 2] / 255.0 * 0.6
            y1 = digest[cursor + 3] / 255.0 * 0.6
            w = 0.1 + (digest[cursor + 4] / 255.0) * 0.3
            h = 0.1 + (digest[cursor + 5] / 255.0) * 0.3
            bbox: tuple[float, float, float, float] | None = (x1, y1, min(x1 + w, 1.0), min(y1 + h, 1.0))
        else:
            bbox = None
        detections.append(
            Detection(
                detected_class=DETECTION_CLASSES[cls_idx],
                confidence=round(conf, 3),
                bbox=bbox,
            )
        )
        cursor += 7
    if not detections:
        detections.append(Detection(detected_class="unclassified", confidence=0.5, bbox=None))
    return detections


# ---------------------------------------------------------------------------
# YOLOv8 stub — drop in your trained weights here
# ---------------------------------------------------------------------------
def _run_yolo_detector(
    image_path: str,
    *,
    weights_path: str | None = None,
    conf_threshold: float = 0.4,
) -> list[Detection]:
    """
    Real YOLO inference — not wired by default (stock COCO classes are
    wrong for watershed features). To enable:

    1. `pip install ultralytics` (already commented in requirements.txt)
    2. Export your fine-tuned weights e.g. `runs/detect/train/weights/best.pt`
    3. Pass `weights_path` or set env var `YOLO_WEIGHTS_PATH`
    4. Swap the return line in `run_detector()` to call this instead.

    Expected model class indices → DetectionClass mapping is YOUR
    responsibility when you train; update the mapping dict below.
    """
    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dep
        raise RuntimeError(
            "ultralytics not installed. Install it or use the default "
            f"hash-based fallback. Original: {exc}"
        ) from exc

    model_weights = weights_path or os.environ.get("YOLO_WEIGHTS_PATH")
    if not model_weights:
        raise RuntimeError(
            "No YOLO weights provided. Set YOLO_WEIGHTS_PATH env var, or "
            "call with weights_path=..., or fall back to _hash_based_fallback()."
        )

    # TODO: customize this mapping to match your training dataset's class indices.
    # Example (yours will differ — this is a placeholder):
    yolo_idx_to_class: dict[int, DetectionClass] = {
        0: "check_dam",
        1: "farm_pond",
        2: "plantation",
        3: "vegetation",
        4: "water_body",
    }
    model = YOLO(model_weights)
    results = model.predict(image_path, conf=conf_threshold, verbose=False)
    detections: list[Detection] = []
    if not results:
        return detections
    result = results[0]
    h, w = result.orig_shape
    for box in getattr(result, "boxes", []) or []:
        cls = int(box.cls.item()) if hasattr(box, "cls") else -1
        conf = float(box.conf.item()) if hasattr(box, "conf") else 0.0
        xyxy = box.xyxy.squeeze().tolist() if hasattr(box, "xyxy") else None
        if xyxy and len(xyxy) == 4:
            bbox_norm: tuple[float, float, float, float] | None = (
                xyxy[0] / w, xyxy[1] / h, xyxy[2] / w, xyxy[3] / h
            )
        else:
            bbox_norm = None
        mapped = yolo_idx_to_class.get(cls, "unclassified")
        detections.append(
            Detection(detected_class=mapped, confidence=round(conf, 3), bbox=bbox_norm)
        )
    return detections


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def run_detector(image_path: str) -> list[Detection]:
    """
    Public entry point — call this from the upload route.

    Currently: returns deterministic hash-based demo detections so the
    rest of the pipeline is exercisable without a trained model.

    TODO (post-hackathon, once you have trained weights):
      return _run_yolo_detector(image_path)
    """
    return _hash_based_fallback(image_path)


__all__ = [
    "Detection",
    "DetectionClass",
    "DETECTION_CLASSES",
    "run_detector",
]
