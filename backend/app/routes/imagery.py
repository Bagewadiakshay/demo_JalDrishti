"""
Imagery upload pipeline: EXIF GPS extraction → detection → GeoJSON → DB.

Endpoint: POST /api/imagery/upload (multipart/form-data, field name "files")

Workflow per file:
  1. Save to a temp location (or keep in memory via SpooledTemporaryFile).
  2. Extract EXIF GPS lat/lng; if missing, record the file but flag it.
  3. Run swappable `run_detector(image_path) -> list[Detection]` via
     `backend/app/services/detector.py` (hash-based fallback by default;
     replace internal impl with YOLO once trained).
  4. For each detection, build a GeoJSON Feature (Point geometry using
     the image's GPS) and insert a FieldObservation row.
  5. Return the aggregated FeatureCollection + counts.
"""
from __future__ import annotations

import os
import tempfile
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import FieldObservation
from ..services.detector import DetectionClass, run_detector

# EXIF helpers — prefer Pillow (PIL), fall back to exifread if Pillow missing
try:  # pragma: no cover - depends on runtime env
    from PIL import Image  # type: ignore
    from PIL.ExifTags import TAGS, GPSTAGS  # type: ignore
    _HAS_PIL = True
except Exception:  # pragma: no cover
    _HAS_PIL = False

try:  # pragma: no cover - fallback dep
    import exifread  # type: ignore
    _HAS_EXIFREAD = True
except Exception:  # pragma: no cover
    _HAS_EXIFREAD = False


router = APIRouter(prefix="/api/imagery", tags=["imagery"])

VALID_MIMES = {"image/jpeg", "image/png", "image/jpg"}

# Kasari basin approximate bbox — for EXIF-GPS-missing fallback
# (matches frontend imageryService bbox so demo-mode coords are consistent)
KASARI_BBOX = {
    "minLat": 16.57,
    "maxLat": 16.81,
    "minLng": 74.07,
    "maxLng": 74.36,
}


# ---------------------------------------------------------------------------
# EXIF GPS extraction
# ---------------------------------------------------------------------------
def _rational_to_float(rational: Any) -> float:
    """Pillow EXIF GPS stores a lat/lng component as (numerator, denominator)."""
    try:
        if isinstance(rational, tuple) and len(rational) == 2:
            num, den = rational
            if den == 0:
                return 0.0
            return float(num) / float(den)
        return float(rational)
    except Exception:
        return 0.0


def _dms_to_deg(dms: tuple[Any, Any, Any], ref: str) -> float:
    deg = _rational_to_float(dms[0])
    minute = _rational_to_float(dms[1])
    sec = _rational_to_float(dms[2])
    val = deg + (minute / 60.0) + (sec / 3600.0)
    if ref in ("S", "W"):
        val = -val
    return val


def extract_exif_gps(image_path: str) -> tuple[float | None, float | None, datetime | None]:
    """
    Returns (latitude, longitude, captured_at_or_None).
    Lat/lng are both None if no GPS tag is present.
    """
    lat: float | None = None
    lng: float | None = None
    captured: datetime | None = None

    if _HAS_PIL:
        try:
            with Image.open(image_path) as img:
                exif = img._getexif() if hasattr(img, "_getexif") else None
                if exif:
                    # Capture datetime
                    for tag_id, value in exif.items():
                        tag = TAGS.get(tag_id, tag_id)
                        if tag in ("DateTimeOriginal", "DateTime") and isinstance(value, str):
                            try:
                                captured = datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
                            except ValueError:
                                captured = None
                    # GPSInfo sub-IFD
                    gps_info = None
                    for tag_id, value in exif.items():
                        if TAGS.get(tag_id) == "GPSInfo":
                            gps_info = value
                            break
                    if gps_info:
                        gps = {GPSTAGS.get(k, k): v for k, v in gps_info.items()}
                        lat_dms = gps.get("GPSLatitude")
                        lat_ref = gps.get("GPSLatitudeRef")
                        lng_dms = gps.get("GPSLongitude")
                        lng_ref = gps.get("GPSLongitudeRef")
                        if lat_dms and lat_ref and lng_dms and lng_ref:
                            try:
                                lat = round(_dms_to_deg(lat_dms, str(lat_ref)), 6)
                                lng = round(_dms_to_deg(lng_dms, str(lng_ref)), 6)
                            except Exception:
                                lat = lng = None
        except Exception:
            lat = lng = None

    # Fallback: exifread
    if (lat is None or lng is None) and _HAS_EXIFREAD:
        try:
            with open(image_path, "rb") as fh:
                tags = exifread.process_file(fh, details=False)
            # Lat
            lat_tag = tags.get("GPS GPSLatitude")
            lat_ref_tag = tags.get("GPS GPSLatitudeRef")
            lng_tag = tags.get("GPS GPSLongitude")
            lng_ref_tag = tags.get("GPS GPSLongitudeRef")
            if lat_tag and lat_ref_tag and lng_tag and lng_ref_tag:
                try:
                    lat_dms = (
                        float(lat_tag.values[0].num) / max(float(lat_tag.values[0].den), 1),
                        float(lat_tag.values[1].num) / max(float(lat_tag.values[1].den), 1),
                        float(lat_tag.values[2].num) / max(float(lat_tag.values[2].den), 1),
                    )
                    lng_dms = (
                        float(lng_tag.values[0].num) / max(float(lng_tag.values[0].den), 1),
                        float(lng_tag.values[1].num) / max(float(lng_tag.values[1].den), 1),
                        float(lng_tag.values[2].num) / max(float(lng_tag.values[2].den), 1),
                    )
                    lat = round(_dms_to_deg(lat_dms, str(lat_ref_tag.values)), 6)
                    lng = round(_dms_to_deg(lng_dms, str(lng_ref_tag.values)), 6)
                except Exception:
                    pass
            dt_tag = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
            if dt_tag and captured is None:
                try:
                    captured = datetime.strptime(str(dt_tag), "%Y:%m:%d %H:%M:%S")
                except ValueError:
                    captured = None
        except Exception:
            pass

    return lat, lng, captured


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@router.post("/upload")
def upload_imagery(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    feature_collection_features: list[dict[str, Any]] = []
    total_images = 0
    total_detections = 0
    issues: list[str] = []

    for upload in files:
        if upload.content_type and upload.content_type.lower() not in VALID_MIMES:
            issues.append(f"{upload.filename or 'unnamed'}: unsupported type {upload.content_type}")
            continue
        total_images += 1

        # Write to temp file so EXIF libs + detector can read from a path
        suffix = os.path.splitext(upload.filename or ".jpg")[1].lower() or ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp_path = tmp.name
        try:
            data = upload.file.read()
            tmp.write(data)
            tmp.close()

            lat, lng, captured = extract_exif_gps(tmp_path)
            if lat is None or lng is None:
                # EXIF-less file: flag + place deterministically inside the basin
                # so the GeoJSON round-trip is still well-formed. The user is
                # notified via the issues list that this is NOT real GPS.
                name_hash = uuid.uuid5(uuid.NAMESPACE_DNS, upload.filename or str(tmp_path)).int
                lat = round(
                    KASARI_BBOX["minLat"] + (name_hash % 1_000_000) / 1_000_000 *
                    (KASARI_BBOX["maxLat"] - KASARI_BBOX["minLat"]), 6
                )
                lng = round(
                    KASARI_BBOX["minLng"] + ((name_hash >> 16) % 1_000_000) / 1_000_000 *
                    (KASARI_BBOX["maxLng"] - KASARI_BBOX["minLng"]), 6
                )
                issues.append(
                    f"{upload.filename or 'unnamed'}: no EXIF GPS — assigned deterministic "
                    f"demo coordinates inside the basin ({lat}, {lng})."
                )

            detections = run_detector(tmp_path)
            if not detections:
                issues.append(f"{upload.filename or 'unnamed'}: detector returned 0 features — inserting unclassified row.")
                from ..services.detector import Detection
                detections = [Detection(detected_class="unclassified", confidence=0.5, bbox=None)]

            for det in detections:
                obs_id = str(uuid.uuid4())
                feature_props: dict[str, Any] = {
                    "class": det.detected_class,
                    "confidence": det.confidence,
                    "image_id": obs_id,
                    "captured_at": captured.isoformat() if captured else None,
                }
                if det.bbox:
                    feature_props["bbox_norm"] = det.bbox
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat],
                    },
                    "properties": feature_props,
                }
                row = FieldObservation(
                    id=obs_id,
                    image_filename=upload.filename,
                    latitude=lat,
                    longitude=lng,
                    captured_at=captured,
                    detected_class=str(det.detected_class),
                    confidence=det.confidence,
                    geojson_feature=feature,
                    intervention_id=None,
                )
                db.add(row)
                feature_collection_features.append({
                    "id": obs_id,
                    "image_filename": upload.filename,
                    "latitude": lat,
                    "longitude": lng,
                    "captured_at": captured.isoformat() if captured else None,
                    "detected_class": det.detected_class,  # type: ignore[typeddict-item]
                    "confidence": det.confidence,
                    "geojson_feature": feature,
                    "intervention_id": None,
                    "uploaded_at": datetime.utcnow().isoformat(),
                })
                total_detections += 1
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    db.commit()
    response: dict[str, Any] = {
        "featureCollection": {
            "type": "FeatureCollection",
            "features": feature_collection_features,
        },
        "imagesProcessed": total_images,
        "featuresDetected": total_detections,
    }
    if issues:
        response["warnings"] = issues
    return response
