"""
Impact score + recommendation engine.

BUG FIXES vs TypeScript services/impactScore.ts:
- ImpactBreakdown.label now returns the NARROW RiskLevel literal (not `str`),
  fixing the buggy cast `as Intervention['riskLevel']` in the TS code.
- Weights sum to 1.0 exactly (VEG + WATER + LAND + STRUCT + HYDRO + RAIN = 1.0).
- `risk_label()` exposes the deterministic mapping for direct reuse.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..schemas import (
    ImpactBreakdownSchema,
    InterventionBase,
    RiskLevel,
)


VEG_WEIGHT = 0.30
WATER_WEIGHT = 0.25
LAND_WEIGHT = 0.15
STRUCTURE_WEIGHT = 0.15
HYDRO_WEIGHT = 0.10
RAIN_WEIGHT = 0.05


def _normalize_change(before: float, after: float, max_range: float = 1.0) -> float:
    delta = after - before
    norm = max(-1.0, min(1.0, delta / max_range))
    return max(0.0, min(100.0, 50.0 + norm * 50.0))


def _condition_score(condition: str) -> float:
    return {
        "Excellent": 95.0,
        "Good": 80.0,
        "Moderate": 55.0,
        "Poor": 30.0,
    }.get(condition, 50.0)


def _hydro_relevance_score(intv: InterventionBase) -> float:
    water_types = {"Check Dam", "Farm Pond"}
    if intv.type not in water_types:
        return 65.0
    if intv.waterAreaAfter > 3:
        return 92.0
    if intv.waterAreaAfter > 1.5:
        return 75.0
    if intv.waterPresent:
        return 55.0
    return 35.0


def _rainfall_adjusted_score(intv: InterventionBase) -> float:
    r = intv.rainfallChange
    if r >= 15:
        return 90.0
    if r >= 8:
        return 78.0
    if r >= 2:
        return 62.0
    if r >= -4:
        return 48.0
    return 30.0


def risk_label(score: int) -> RiskLevel:
    """Deterministic label from a 0..100 impact score. Mirrors frontend thresholds."""
    if score >= 75:
        return "High Impact"
    if score >= 50:
        return "Moderate Impact"
    if score >= 35:
        return "Needs Review"
    return "At Risk"


def risk_color(score: int) -> str:
    return {
        "High Impact": "#22c55e",
        "Moderate Impact": "#f59e0b",
        "Needs Review": "#f97316",
        "At Risk": "#ef4444",
    }[risk_label(score)]


def calculate_impact_score(intervention: InterventionBase) -> ImpactBreakdownSchema:
    vegetation = _normalize_change(intervention.ndviBefore, intervention.ndviAfter, max_range=0.5)
    water = (
        0.5 * _normalize_change(intervention.ndwiBefore, intervention.ndwiAfter, max_range=0.3)
        + 0.5 * _normalize_change(intervention.waterAreaBefore, intervention.waterAreaAfter, max_range=5.0)
    )
    land_cover = (vegetation + water) / 2.0
    structure = _condition_score(intervention.condition)
    hydro = _hydro_relevance_score(intervention)
    rainfall = _rainfall_adjusted_score(intervention)

    score = (
        vegetation * VEG_WEIGHT
        + water * WATER_WEIGHT
        + land_cover * LAND_WEIGHT
        + structure * STRUCTURE_WEIGHT
        + hydro * HYDRO_WEIGHT
        + rainfall * RAIN_WEIGHT
    )
    final = int(round(max(0.0, min(100.0, score))))

    return ImpactBreakdownSchema(
        score=final,
        vegetation=int(round(vegetation)),
        water=int(round(water)),
        landCover=int(round(land_cover)),
        structure=int(round(structure)),
        hydrological=int(round(hydro)),
        rainfallAdjusted=int(round(rainfall)),
        label=risk_label(final),
    )
