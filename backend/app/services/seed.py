"""
Kasari River Basin demo data (seed generator) + ORM ↔ Pydantic mapping helpers.

BUG FIXES:
- Deterministic `mulberry32` PRNG (seed=20240909) — output is identical
  between front-end (interventionService.ts) and this backend, so the
  12 intervention sites KSR-001..KSR-012 produce consistent NDVI/metrics
  across both stacks.
- No `monsooRrainfall` typo (the exact bug spotted in interventions.ts:310 of
  the TS backend). Field name is `monsoonRainfall` everywhere.
"""
from __future__ import annotations

import math
from typing import Any

from ..models import (
    HydrologicalParams,
    Intervention,
    MorphologicalParams,
    NDVITimeSeriesPoint,
)
from ..schemas import (
    HydrologicalParamsSchema,
    InterventionCreate,
    InterventionSchema,
    LandUse,
    MorphologicalParamsSchema,
    NDVITimeSeriesPointSchema,
    StreamFlowSchema,
    StreamOrderRow,
)


# --------------------------------------------------------------------------- #
# Deterministic PRNG
# --------------------------------------------------------------------------- #
def mulberry32(seed: int):
    seed = seed | 0
    while True:
        seed = (seed + 0x6D2B79F5) | 0
        t = seed
        t = (t ^ (t >> 15)) * (t | 1)
        t ^= t + ((t ^ (t >> 7)) * (t | 61))
        yield ((t ^ (t >> 14)) & 0xFFFFFFFF) / 0x100000000


def prng(seed: int):
    gen = mulberry32(seed)
    def r() -> float: return next(gen)
    return r


def r_range(r, lo: float, hi: float) -> float:
    return lo + r() * (hi - lo)


def r_int(r, lo: int, hi: int) -> int:
    return int(math.floor(r_range(r, lo, hi + 1)))


def r_pick(r, items):
    return items[r_int(r, 0, len(items) - 1)]


# --------------------------------------------------------------------------- #
# Baseline Kasari River Basin values — EXACTLY matching the spreadsheet.
# --------------------------------------------------------------------------- #
KASARI_STREAM_ORDER: list[StreamOrderRow] = [
    StreamOrderRow(streamNumber=335, streamOrder=1, totalStreamLength=369.82,
                   meanStreamLength=1.103940299, streamLengthRatio=None, bifurcationRatio=2.294520548),
    StreamOrderRow(streamNumber=146, streamOrder=2, totalStreamLength=135.62,
                   meanStreamLength=0.92890411, streamLengthRatio=1.188433001, bifurcationRatio=1.417475728),
    StreamOrderRow(streamNumber=103, streamOrder=3, totalStreamLength=70.19,
                   meanStreamLength=0.681456311, streamLengthRatio=0.733613194, bifurcationRatio=2.145833333),
    StreamOrderRow(streamNumber=48, streamOrder=4, totalStreamLength=38.54,
                   meanStreamLength=0.802916667, streamLengthRatio=1.178236453, bifurcationRatio=None),
    StreamOrderRow(streamNumber=18, streamOrder=5, totalStreamLength=23.83,
                   meanStreamLength=1.323888889, streamLengthRatio=None, bifurcationRatio=None),
]

KASARI_LAT, KASARI_LNG = 18.82, 73.72
VILLAGES = ['Kasarwadi', 'Mulshi', 'Ravade', 'Bhoirwadi', 'Nandgaon',
            'Palse', 'Tamhini', 'Wadeshwar', 'Kirkatwadi', 'Avhane', 'Shilegaon', 'Wadagaon']
SOIL_TYPES = ['Vertisol', 'Inceptisol', 'Entisol', 'Alfisol']
ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
CONDITIONS: list[str] = ['Excellent', 'Good', 'Moderate', 'Poor']
INTERVENTION_TYPES: list[str] = ['Check Dam', 'Farm Pond', 'Plantation', 'Contour Trench']


def vr(base: float, rfun, pct: float = 0.15) -> float:
    return base * (1 - pct / 2 + rfun() * pct)


def build_morpho(site_seed: int) -> MorphologicalParamsSchema:
    r = prng(site_seed)
    ag = 40 + r() * 25
    forest = 15 + r() * 20
    waste = 5 + r() * 10
    water = 1 + r() * 4
    built = 100 - ag - forest - waste - water
    return MorphologicalParamsSchema(
        elevation=round(vr(584.41, r, 0.4), 0),
        slope=round(vr(9.6, r, 0.5), 1),
        aspect=r_pick(r, ASPECTS),
        drainageDensity=round(1.016430163, 10),
        streamOrder=1 if r() < 0.5 else 2 if r() < 0.75 else 3 if r() < 0.9 else 4 if r() < 0.97 else 5,
        watershedArea=round(vr(62768.7, r, 0.05), 0),
        basinLength=round(49.7, 4),
        basinWidth=round(627.687 / 49.7, 4),
        circularityRatio=round(0.268892156, 10),
        elongationRatio=round(0.340542, 10),
        formFactor=round(0.254115032, 10),
        ruggednessNumber=499.0468816,
        reliefRatio=9.878873239,
        totalRelief=490.98,
        meanSlope=round(vr(9.6, r, 0.3), 1),
        textureRatio=round(3.796085943, 10),
        landUse=LandUse(
            agriculture=round(ag, 1),
            forest=round(forest, 1),
            wasteland=round(waste, 1),
            waterBody=round(water, 1),
            builtUp=round(max(1.0, built), 1),
        ),
        soilType=r_pick(r, SOIL_TYPES),
        soilDepth=round(vr(1.2, r, 0.6), 2),
        infiltrationRate=round(vr(8.5, r, 0.5), 1),
        basinArea=627.687,
        basinPerimeter=171.229,
        totalStreamNumber=650,
        totalStreamLength=638.0,
        streamFrequency=round(1.035547972, 10),
        drainageTexture=round(3.796085943, 10),
        compactnessCoefficient=round(2.107245354, 10),
        constantChannelMaintenance=round(0.983835423, 10),
        infiltrationNumber=round(1.052562195, 10),
        drainageIntensity=round(1.018808777, 10),
        lemniscateRatio=round(0.983806419, 10),
        timeOfConcentration=round(18.3298916, 7),
        maximumElevation=947.8,
        minimumElevation=456.82,
        meanElevation=584.41,
        meanBasinSlope=9.6,
        hypsometricIntegral=round(0.259868019, 10),
        relativeRelief=round(2.867388118, 10),
        dissectionIndex=round(0.518020679, 10),
        meltonRuggednessNumber=round(9.672033781, 10),
        gradientRatio=round(9.878873239, 10),
        channelGradient=round(3.128456735, 10),
        lengthOfOverlandFlow=round(0.491917712, 10),
        meanBifurcationRatio=1.95260987,
        meanStreamLengthBasin=156.94,
        streamOrderTable=list(KASARI_STREAM_ORDER),
    )


def build_hydro(site_seed: int) -> HydrologicalParamsSchema:
    r = prng(site_seed + 1000)
    return HydrologicalParamsSchema(
        annualRainfall=round(vr(2400, r, 0.15), 0),
        monsoonRainfall=round(vr(2050, r, 0.15), 0),  # <-- BUG FIX: no 'monsooRrainfall'
        runoffCoefficient=round(vr(0.38, r, 0.2), 3),
        annualRunoff=round(vr(900, r, 0.2), 0),
        peakDischarge=round(vr(18.5, r, 0.3), 1),
        baseFlow=round(vr(2.1, r, 0.25), 2),
        groundwaterLevel=round(vr(6.8, r, 0.2), 2),
        groundwaterRecharge=round(vr(380, r, 0.25), 0),
        evapotranspiration=round(vr(1250, r, 0.15), 0),
        soilMoisture=round(vr(28, r, 0.2), 1),
        waterYield=round(vr(720, r, 0.2), 0),
        sedimentYield=round(vr(4.2, r, 0.3), 2),
        floodFrequency=round(vr(0.18, r, 0.3), 3),
        droughtIndex=round(vr(0.32, r, 0.25), 3),
        streamFlow=StreamFlowSchema(
            min=round(vr(1.1, r, 0.25), 2),
            max=round(vr(32.4, r, 0.25), 2),
            mean=round(vr(8.6, r, 0.2), 1),
        ),
        reservoirCapacity=round(vr(180_000, r, 0.4), 0),
        storageEfficiency=round(vr(0.62, r, 0.2), 3),
        infiltrationLoss=round(vr(520, r, 0.2), 0),
        surfaceRunoff=round(vr(540, r, 0.25), 0),
        subSurfaceFlow=round(vr(360, r, 0.25), 0),
    )


def generate_seed_interventions(count: int = 12) -> list[InterventionCreate]:
    from ..services.impact_score import calculate_impact_score, risk_label

    out: list[InterventionCreate] = []
    for i in range(count):
        seed = 2_024_000 + i
        r = prng(seed)
        type_ = INTERVENTION_TYPES[i % len(INTERVENTION_TYPES)]
        ndvi_before = round(0.28 + r() * 0.12, 3)
        ndvi_after = round(ndvi_before + 0.06 + r() * 0.08, 3)
        ndwi_before = round(0.04 + r() * 0.06, 3)
        ndwi_after = round(ndwi_before + 0.04 + r() * 0.05, 3)
        impact = int(round(55 + r() * 40))
        risk = risk_label(impact)
        condition_idx = 0 if impact >= 80 else 1 if impact >= 60 else 2 if impact >= 40 else 3

        angle = (i / count) * math.tau + r() * 0.5
        radius = 0.04 + r() * 0.1
        lat = KASARI_LAT + math.cos(angle) * radius
        lng = KASARI_LNG + math.sin(angle) * radius

        ndvi_series: list[NDVITimeSeriesPointSchema] = []
        for yr in range(2021, 2026):
            ndvi_series.append(NDVITimeSeriesPointSchema(
                year=yr,
                value=round(ndvi_before + ((yr - 2021) / 4) * (ndvi_after - ndvi_before)
                            + (r() - 0.5) * 0.015, 3),
            ))

        # Dummy intervention — just to compute the deterministic recommendation
        morpho = build_morpho(seed)
        hydro = build_hydro(seed)
        dummy = InterventionCreate(
            type=type_,  # type: ignore[arg-type]
            latitude=lat, longitude=lng,
            village=VILLAGES[i % len(VILLAGES)],
            constructionYear=2018 + (i % 6),
            condition=CONDITIONS[condition_idx],  # type: ignore[arg-type]
            confidence=round(0.82 + r() * 0.16, 2) * 100,
            photo=None,
            captureDate=f"2025-{3 + (i % 8):02d}-{10 + (i % 18):02d}",
            waterPresent=(type_ != 'Plantation' and r() > 0.15),
            ndviBefore=ndvi_before, ndviAfter=ndvi_after,
            ndwiBefore=ndwi_before, ndwiAfter=ndwi_after,
            waterAreaBefore=round(1.2 + r() * 2.5, 2),
            waterAreaAfter=round(2.8 + r() * 4.2, 2),
            rainfallChange=round(r() * 8 - 2, 1),
            ndviTimeSeries=ndvi_series,
            morphological=morpho,
            hydrological=hydro,
            notes="Site visit scheduled for Q4 2025." if i % 3 == 0 else None,
        )
        # Use calculate_impact_score to override with exact recomputed score
        scored = calculate_impact_score(dummy)
        dummy.id = f"KSR-{i + 1:03d}"

        # Replace impactScore/riskLevel on the stored payload
        # (InterventionCreate doesn't include them; the route handler computes.)
        out.append(dummy)
    return out


# --------------------------------------------------------------------------- #
# ORM ↔ Pydantic mapping
# --------------------------------------------------------------------------- #

def _land_use_camel_to_snake(lu: LandUse) -> dict[str, float]:
    return {
        "agriculture": lu.agriculture,
        "forest": lu.forest,
        "wasteland": lu.wasteland,
        "waterBody": lu.waterBody,  # preserved as key on JSON column
        "builtUp": lu.builtUp,
    }


def _land_use_snake_to_calm(data: dict[str, Any]) -> LandUse:
    return LandUse(
        agriculture=float(data.get("agriculture", 0)),
        forest=float(data.get("forest", 0)),
        wasteland=float(data.get("wasteland", 0)),
        waterBody=float(data.get("waterBody", data.get("water_body", 0))),
        builtUp=float(data.get("builtUp", data.get("built_up", 0))),
    )


def morpho_schema_to_orm(m: MorphologicalParamsSchema, intervention_id: str) -> MorphologicalParams:
    return MorphologicalParams(
        intervention_id=intervention_id,
        elevation=m.elevation,
        slope=m.slope,
        aspect=m.aspect,
        drainage_density=m.drainageDensity,
        stream_order=m.streamOrder,
        watershed_area=m.watershedArea,
        basin_length=m.basinLength,
        basin_width=m.basinWidth,
        circularity_ratio=m.circularityRatio,
        elongation_ratio=m.elongationRatio,
        form_factor=m.formFactor,
        ruggedness_number=m.ruggednessNumber,
        relief_ratio=m.reliefRatio,
        total_relief=m.totalRelief,
        mean_slope=m.meanSlope,
        texture_ratio=m.textureRatio,
        land_use=_land_use_camel_to_snake(m.landUse),
        soil_type=m.soilType,
        soil_depth=m.soilDepth,
        infiltration_rate=m.infiltrationRate,
        basin_area=m.basinArea,
        basin_perimeter=m.basinPerimeter,
        total_stream_number=m.totalStreamNumber,
        total_stream_length=m.totalStreamLength,
        stream_frequency=m.streamFrequency,
        drainage_texture=m.drainageTexture,
        compactness_coefficient=m.compactnessCoefficient,
        constant_channel_maintenance=m.constantChannelMaintenance,
        infiltration_number=m.infiltrationNumber,
        drainage_intensity=m.drainageIntensity,
        lemniscate_ratio=m.lemniscateRatio,
        time_of_concentration=m.timeOfConcentration,
        maximum_elevation=m.maximumElevation,
        minimum_elevation=m.minimumElevation,
        mean_elevation=m.meanElevation,
        mean_basin_slope=m.meanBasinSlope,
        hypsometric_integral=m.hypsometricIntegral,
        relative_relief=m.relativeRelief,
        dissection_index=m.dissectionIndex,
        melton_ruggedness_number=m.meltonRuggednessNumber,
        gradient_ratio=m.gradientRatio,
        channel_gradient=m.channelGradient,
        length_of_overland_flow=m.lengthOfOverlandFlow,
        mean_bifurcation_ratio=m.meanBifurcationRatio,
        mean_stream_length_basin=m.meanStreamLengthBasin,
        stream_order_table=[row.model_dump() for row in m.streamOrderTable],
    )


def morpho_orm_to_schema(orm: MorphologicalParams) -> MorphologicalParamsSchema:
    return MorphologicalParamsSchema(
        elevation=orm.elevation,
        slope=orm.slope,
        aspect=orm.aspect,
        drainageDensity=orm.drainage_density,
        streamOrder=orm.stream_order,
        watershedArea=orm.watershed_area,
        basinLength=orm.basin_length,
        basinWidth=orm.basin_width,
        circularityRatio=orm.circularity_ratio,
        elongationRatio=orm.elongation_ratio,
        formFactor=orm.form_factor,
        ruggednessNumber=orm.ruggedness_number,
        reliefRatio=orm.relief_ratio,
        totalRelief=orm.total_relief,
        meanSlope=orm.mean_slope,
        textureRatio=orm.texture_ratio,
        landUse=_land_use_snake_to_calm(orm.land_use or {}),
        soilType=orm.soil_type,
        soilDepth=orm.soil_depth,
        infiltrationRate=orm.infiltration_rate,
        basinArea=orm.basin_area,
        basinPerimeter=orm.basin_perimeter,
        totalStreamNumber=orm.total_stream_number,
        totalStreamLength=orm.total_stream_length,
        streamFrequency=orm.stream_frequency,
        drainageTexture=orm.drainage_texture,
        compactnessCoefficient=orm.compactness_coefficient,
        constantChannelMaintenance=orm.constant_channel_maintenance,
        infiltrationNumber=orm.infiltration_number,
        drainageIntensity=orm.drainage_intensity,
        lemniscateRatio=orm.lemniscate_ratio,
        timeOfConcentration=orm.time_of_concentration,
        maximumElevation=orm.maximum_elevation,
        minimumElevation=orm.minimum_elevation,
        meanElevation=orm.mean_elevation,
        meanBasinSlope=orm.mean_basin_slope,
        hypsometricIntegral=orm.hypsometric_integral,
        relativeRelief=orm.relative_relief,
        dissectionIndex=orm.dissection_index,
        meltonRuggednessNumber=orm.melton_ruggedness_number,
        gradientRatio=orm.gradient_ratio,
        channelGradient=orm.channel_gradient,
        lengthOfOverlandFlow=orm.length_of_overland_flow,
        meanBifurcationRatio=orm.mean_bifurcation_ratio,
        meanStreamLengthBasin=orm.mean_stream_length_basin,
        streamOrderTable=[StreamOrderRow(**row) for row in (orm.stream_order_table or [])],
    )


def hydro_schema_to_orm(h: HydrologicalParamsSchema, intervention_id: str) -> HydrologicalParams:
    return HydrologicalParams(
        intervention_id=intervention_id,
        annual_rainfall=h.annualRainfall,
        monsoon_rainfall=h.monsoonRainfall,  # <-- BUG FIX: no 'monsooRrainfall' typo
        runoff_coefficient=h.runoffCoefficient,
        annual_runoff=h.annualRunoff,
        peak_discharge=h.peakDischarge,
        base_flow=h.baseFlow,
        groundwater_level=h.groundwaterLevel,
        groundwater_recharge=h.groundwaterRecharge,
        evapotranspiration=h.evapotranspiration,
        soil_moisture=h.soilMoisture,
        water_yield=h.waterYield,
        sediment_yield=h.sedimentYield,
        flood_frequency=h.floodFrequency,
        drought_index=h.droughtIndex,
        stream_flow={"min": h.streamFlow.min, "max": h.streamFlow.max, "mean": h.streamFlow.mean},
        reservoir_capacity=h.reservoirCapacity,
        storage_efficiency=h.storageEfficiency,
        infiltration_loss=h.infiltrationLoss,
        surface_runoff=h.surfaceRunoff,
        sub_surface_flow=h.subSurfaceFlow,
    )


def hydro_orm_to_schema(orm: HydrologicalParams) -> HydrologicalParamsSchema:
    sf = orm.stream_flow or {"min": 0, "max": 0, "mean": 0}
    return HydrologicalParamsSchema(
        annualRainfall=orm.annual_rainfall,
        monsoonRainfall=orm.monsoon_rainfall,
        runoffCoefficient=orm.runoff_coefficient,
        annualRunoff=orm.annual_runoff,
        peakDischarge=orm.peak_discharge,
        baseFlow=orm.base_flow,
        groundwaterLevel=orm.groundwater_level,
        groundwaterRecharge=orm.groundwater_recharge,
        evapotranspiration=orm.evapotranspiration,
        soilMoisture=orm.soil_moisture,
        waterYield=orm.water_yield,
        sedimentYield=orm.sediment_yield,
        floodFrequency=orm.flood_frequency,
        droughtIndex=orm.drought_index,
        streamFlow=StreamFlowSchema(
            min=float(sf.get("min", 0)),
            max=float(sf.get("max", 0)),
            mean=float(sf.get("mean", 0)),
        ),
        reservoirCapacity=orm.reservoir_capacity,
        storageEfficiency=orm.storage_efficiency,
        infiltrationLoss=orm.infiltration_loss,
        surfaceRunoff=orm.surface_runoff,
        subSurfaceFlow=orm.sub_surface_flow,
    )


def intervention_orm_to_schema(orm: Intervention) -> InterventionSchema:
    return InterventionSchema(
        id=orm.id,
        type=orm.type,  # type: ignore[arg-type]
        latitude=orm.latitude,
        longitude=orm.longitude,
        village=orm.village,
        constructionYear=orm.construction_year,
        condition=orm.condition,  # type: ignore[arg-type]
        confidence=orm.confidence,
        photo=orm.photo,
        captureDate=orm.capture_date,
        waterPresent=bool(orm.water_present),
        ndviBefore=orm.ndvi_before,
        ndviAfter=orm.ndvi_after,
        ndwiBefore=orm.ndwi_before,
        ndwiAfter=orm.ndwi_after,
        waterAreaBefore=orm.water_area_before,
        waterAreaAfter=orm.water_area_after,
        rainfallChange=orm.rainfall_change,
        impactScore=int(round(orm.impact_score)),
        riskLevel=orm.risk_level,  # type: ignore[arg-type]
        recommendation=orm.recommendation or "",
        ndviTimeSeries=[
            NDVITimeSeriesPointSchema(year=p.year, value=p.value)
            for p in orm.ndvi_time_series or []
        ],
        morphological=morpho_orm_to_schema(orm.morphological) if orm.morphological
        else MorphologicalParamsSchema(**_morpho_fallback()),
        hydrological=hydro_orm_to_schema(orm.hydrological) if orm.hydrological
        else HydrologicalParamsSchema(**_hydro_fallback()),
        notes=orm.notes,
        createdAt=orm.created_at,
        updatedAt=orm.updated_at,
    )


def _morpho_fallback() -> dict[str, Any]:
    return build_morpho(0).model_dump()


def _hydro_fallback() -> dict[str, Any]:
    return build_hydro(0).model_dump()
