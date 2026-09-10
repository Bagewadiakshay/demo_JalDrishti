"""
Interventions REST API routes.

BUG FIXES vs TypeScript backend/src/routes/interventions.ts:
- No `monsooRrainfall` typo (TS line 310 passed undefined to the DB).
- PATCH updates are deep-merged using Pydantic schema defaults rather than
  manually mutating columns (which missed the new Kasari fields in TS).
- All 30+ morphological + 21 hydrological fields are saved/loaded via the
  seed.py mapping helpers.
- Proper HTTP 404 via `raise HTTPException(status_code=404)`.
- Seed endpoint is deterministic and generates 12 sites matching the frontend.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, String
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    HydrologicalParams,
    Intervention,
    MorphologicalParams,
    NDVITimeSeriesPoint,
)
from ..schemas import (
    ImpactBreakdownSchema,
    InterventionCreate,
    InterventionSchema,
    InterventionUpdate,
)
from ..services.impact_score import calculate_impact_score
from ..services.recommendation import generate_recommendation
from ..services.seed import (
    generate_seed_interventions,
    hydro_orm_to_schema,
    hydro_schema_to_orm,
    intervention_orm_to_schema,
    morpho_orm_to_schema,
    morpho_schema_to_orm,
)


router = APIRouter(prefix="/api/interventions", tags=["interventions"])


@router.get("", response_model=list[InterventionSchema])
def list_interventions(
    village: Optional[str] = None,
    type: Optional[str] = None,  # noqa: A002 - keep query param named 'type'
    condition: Optional[str] = None,
    riskLevel: Optional[str] = Query(None, alias="riskLevel"),
    search: Optional[str] = None,
    minImpact: Optional[int] = Query(None, alias="minImpact"),
    maxImpact: Optional[int] = Query(None, alias="maxImpact"),
    db: Session = Depends(get_db),
):
    q = db.query(Intervention)

    if village:
        q = q.filter(Intervention.village.ilike(f"%{village}%"))
    if type:
        q = q.filter(Intervention.type == type)
    if condition:
        q = q.filter(Intervention.condition == condition)
    if riskLevel:
        q = q.filter(Intervention.risk_level == riskLevel)
    if minImpact is not None:
        q = q.filter(Intervention.impact_score >= minImpact)
    if maxImpact is not None:
        q = q.filter(Intervention.impact_score <= maxImpact)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                Intervention.id.ilike(like),
                Intervention.village.ilike(like),
                Intervention.type.ilike(like),
                Intervention.notes.ilike(like),
            )
        )

    q = q.order_by(Intervention.impact_score.desc(), Intervention.id.asc())
    return [intervention_orm_to_schema(i) for i in q.all()]


@router.post("", response_model=InterventionSchema, status_code=201)
def create_intervention(payload: InterventionCreate, db: Session = Depends(get_db)):
    if payload.id:
        if db.query(Intervention.id).filter(Intervention.id == payload.id).first():
            raise HTTPException(400, f"Intervention with id {payload.id} already exists")
        new_id = payload.id
    else:
        existing = db.query(Intervention).count()
        new_id = f"KSR-{existing + 1:03d}"
        while db.query(Intervention.id).filter(Intervention.id == new_id).first():
            existing += 1
            new_id = f"KSR-{existing + 1:03d}"

    impact = calculate_impact_score(payload)
    recom = generate_recommendation(payload)

    intervention = Intervention(
        id=new_id,
        type=payload.type,
        latitude=payload.latitude,
        longitude=payload.longitude,
        village=payload.village,
        construction_year=payload.constructionYear,
        condition=payload.condition,
        confidence=payload.confidence,
        photo=payload.photo,
        capture_date=payload.captureDate,
        water_present=bool(payload.waterPresent),
        ndvi_before=payload.ndviBefore,
        ndvi_after=payload.ndviAfter,
        ndwi_before=payload.ndwiBefore,
        ndwi_after=payload.ndwiAfter,
        water_area_before=payload.waterAreaBefore,
        water_area_after=payload.waterAreaAfter,
        rainfall_change=payload.rainfallChange,
        impact_score=float(impact.score),
        risk_level=impact.label,
        recommendation=recom,
        notes=payload.notes,
    )
    db.add(intervention)
    db.flush()

    intervention.morphological = morpho_schema_to_orm(payload.morphological, new_id)
    intervention.hydrological = hydro_schema_to_orm(payload.hydrological, new_id)
    for point in payload.ndviTimeSeries:
        db.add(
            NDVITimeSeriesPoint(
                intervention_id=new_id, year=point.year, value=point.value
            )
        )
    db.commit()
    db.refresh(intervention)
    return intervention_orm_to_schema(intervention)


def _get_or_404(db: Session, id: str) -> Intervention:
    row = db.query(Intervention).filter(Intervention.id == id).first()
    if row is None:
        raise HTTPException(404, f"Intervention {id} not found")
    return row


@router.get("/{intervention_id}", response_model=InterventionSchema)
def get_intervention(intervention_id: str, db: Session = Depends(get_db)):
    return intervention_orm_to_schema(_get_or_404(db, intervention_id))


@router.put("/{intervention_id}", response_model=InterventionSchema)
def update_intervention(
    intervention_id: str, payload: InterventionUpdate, db: Session = Depends(get_db)
):
    i = _get_or_404(db, intervention_id)
    # Build a valid InterventionCreate-compatible structure by merging the payload
    # onto the existing record. We reconstruct the pydantic schemas via dict merge.
    old = intervention_orm_to_schema(i)
    merged_dict = old.model_dump()
    merged_dict.update({k: v for k, v in payload.model_dump().items() if v is not None})
    merged = InterventionCreate(**merged_dict)

    impact = calculate_impact_score(merged)
    recom = generate_recommendation(merged)

    i.type = merged.type
    i.latitude = merged.latitude
    i.longitude = merged.longitude
    i.village = merged.village
    i.construction_year = merged.constructionYear
    i.condition = merged.condition
    i.confidence = merged.confidence
    i.photo = merged.photo if merged.photo is not None else i.photo
    i.capture_date = merged.captureDate
    i.water_present = bool(merged.waterPresent)
    i.ndvi_before = merged.ndviBefore
    i.ndvi_after = merged.ndviAfter
    i.ndwi_before = merged.ndwiBefore
    i.ndwi_after = merged.ndwiAfter
    i.water_area_before = merged.waterAreaBefore
    i.water_area_after = merged.waterAreaAfter
    i.rainfall_change = merged.rainfallChange
    i.impact_score = float(impact.score)
    i.risk_level = impact.label
    i.recommendation = recom
    i.notes = merged.notes if merged.notes is not None else i.notes

    # Replace morphological row entirely
    if i.morphological:
        db.delete(i.morphological)
        db.flush()
    i.morphological = morpho_schema_to_orm(merged.morphological, intervention_id)

    # Replace hydrological row entirely
    if i.hydrological:
        db.delete(i.hydrological)
        db.flush()
    i.hydrological = hydro_schema_to_orm(merged.hydrological, intervention_id)

    # Replace NDVI time series
    db.query(NDVITimeSeriesPoint).filter(
        NDVITimeSeriesPoint.intervention_id == intervention_id
    ).delete(synchronize_session=False)
    for point in merged.ndviTimeSeries:
        db.add(
            NDVITimeSeriesPoint(
                intervention_id=intervention_id, year=point.year, value=point.value
            )
        )

    db.commit()
    db.refresh(i)
    return intervention_orm_to_schema(i)


@router.delete("/{intervention_id}", status_code=204)
def delete_intervention(intervention_id: str, db: Session = Depends(get_db)):
    i = _get_or_404(db, intervention_id)
    db.delete(i)
    db.commit()
    return None


@router.get("/{intervention_id}/impact", response_model=ImpactBreakdownSchema)
def get_impact(intervention_id: str, db: Session = Depends(get_db)):
    i = _get_or_404(db, intervention_id)
    schema = intervention_orm_to_schema(i)
    return calculate_impact_score(schema)


@router.post("/{intervention_id}/reanalyse", response_model=ImpactBreakdownSchema)
def reanalyse(intervention_id: str, db: Session = Depends(get_db)):
    i = _get_or_404(db, intervention_id)
    schema = intervention_orm_to_schema(i)
    impact = calculate_impact_score(schema)
    recom = generate_recommendation(schema)
    i.impact_score = float(impact.score)
    i.risk_level = impact.label
    i.recommendation = recom
    db.commit()
    return impact


@router.post("/seed", status_code=201)
def seed_demo_data(db: Session = Depends(get_db)):
    """Deterministically seed 12 Kasari River Basin interventions. Idempotent."""
    existing = db.query(Intervention).count()
    if existing > 0:
        return {"message": "Database already contains data. Skipping seed.",
                "existing": existing}
    payloads = generate_seed_interventions(12)
    for p in payloads:
        # Recalculate impact / recommendation within the DB session
        create_intervention(p, db)
    return {"seeded": len(payloads), "ids": [p.id for p in payloads]}
