"""
SQLAlchemy ORM models.

BUG FIXES vs TypeScript backend (001_init.sql missing 30+ columns):
- All 60+ Kasari River Basin morphological fields are present
- Uses JSON columns for `land_use`, `stream_flow`, and `stream_order_table`
- Correct snake_case ↔ camelCase mapping handled explicitly at the API layer
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    func,
    Integer,
    JSON,
    String,
    Text,
    Index,
)
from sqlalchemy.orm import relationship, Mapped

from .db import Base


class Intervention(Base):
    __tablename__ = "interventions"

    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)  # Check Dam / Farm Pond / Plantation / Contour Trench
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    village = Column(String, nullable=False)
    construction_year = Column(Integer, nullable=False)
    condition = Column(String, nullable=False)  # Excellent / Good / Moderate / Poor
    confidence = Column(Float, nullable=False)
    photo = Column(Text, nullable=True)
    capture_date = Column(String, nullable=False)
    water_present = Column(Boolean, nullable=False, default=False)

    ndvi_before = Column(Float, nullable=False)
    ndvi_after = Column(Float, nullable=False)
    ndwi_before = Column(Float, nullable=False)
    ndwi_after = Column(Float, nullable=False)
    water_area_before = Column(Float, nullable=False)
    water_area_after = Column(Float, nullable=False)
    rainfall_change = Column(Float, nullable=False)

    impact_score = Column(Float, nullable=False, default=0.0)
    risk_level = Column(String, nullable=False, default="Moderate Impact")
    recommendation = Column(Text, nullable=False, default="")
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    morphological: Mapped[Optional["MorphologicalParams"]] = relationship(
        "MorphologicalParams",
        back_populates="intervention",
        uselist=False,
        cascade="all, delete-orphan",
    )
    hydrological: Mapped[Optional["HydrologicalParams"]] = relationship(
        "HydrologicalParams",
        back_populates="intervention",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ndvi_time_series: Mapped[list["NDVITimeSeriesPoint"]] = relationship(
        "NDVITimeSeriesPoint",
        back_populates="intervention",
        cascade="all, delete-orphan",
        order_by="NDVITimeSeriesPoint.year.asc()",
    )

    __table_args__ = (
        Index("idx_interventions_village", "village"),
        Index("idx_interventions_type", "type"),
        Index("idx_interventions_condition", "condition"),
        Index("idx_interventions_risk_level", "risk_level"),
        Index("idx_interventions_impact_score", "impact_score"),
        Index("idx_interventions_construction_year", "construction_year"),
        Index("idx_interventions_lat_lng", "latitude", "longitude"),
    )


class MorphologicalParams(Base):
    __tablename__ = "morphological_params"

    id = Column(Integer, primary_key=True, autoincrement=True)
    intervention_id = Column(
        String, ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    elevation = Column(Float, nullable=False, default=0)
    slope = Column(Float, nullable=False, default=0)
    aspect = Column(String, nullable=False, default="N")
    drainage_density = Column(Float, nullable=False, default=0)
    stream_order = Column(Integer, nullable=False, default=1)
    watershed_area = Column(Float, nullable=False, default=0)
    basin_length = Column(Float, nullable=False, default=0)
    basin_width = Column(Float, nullable=False, default=0)
    circularity_ratio = Column(Float, nullable=False, default=0)
    elongation_ratio = Column(Float, nullable=False, default=0)
    form_factor = Column(Float, nullable=False, default=0)
    ruggedness_number = Column(Float, nullable=False, default=0)
    relief_ratio = Column(Float, nullable=False, default=0)
    total_relief = Column(Float, nullable=False, default=0)
    mean_slope = Column(Float, nullable=False, default=0)
    texture_ratio = Column(Float, nullable=False, default=0)
    land_use = Column(JSON, nullable=False, default=dict)
    soil_type = Column(String, nullable=False, default="Vertisol")
    soil_depth = Column(Float, nullable=False, default=0)
    infiltration_rate = Column(Float, nullable=False, default=0)

    # ---- Kasari River Basin extras (MISSING in TS 001_init.sql — BUG FIX) ----
    basin_area = Column(Float, nullable=False, default=627.687)
    basin_perimeter = Column(Float, nullable=False, default=171.229)
    total_stream_number = Column(Integer, nullable=False, default=650)
    total_stream_length = Column(Float, nullable=False, default=638.0)
    stream_frequency = Column(Float, nullable=False, default=0)
    drainage_texture = Column(Float, nullable=False, default=0)
    compactness_coefficient = Column(Float, nullable=False, default=0)
    constant_channel_maintenance = Column(Float, nullable=False, default=0)
    infiltration_number = Column(Float, nullable=False, default=0)
    drainage_intensity = Column(Float, nullable=False, default=0)
    lemniscate_ratio = Column(Float, nullable=False, default=0)
    time_of_concentration = Column(Float, nullable=False, default=0)
    maximum_elevation = Column(Float, nullable=False, default=947.8)
    minimum_elevation = Column(Float, nullable=False, default=456.82)
    mean_elevation = Column(Float, nullable=False, default=584.41)
    mean_basin_slope = Column(Float, nullable=False, default=9.6)
    hypsometric_integral = Column(Float, nullable=False, default=0)
    relative_relief = Column(Float, nullable=False, default=0)
    dissection_index = Column(Float, nullable=False, default=0)
    melton_ruggedness_number = Column(Float, nullable=False, default=0)
    gradient_ratio = Column(Float, nullable=False, default=0)
    channel_gradient = Column(Float, nullable=False, default=0)
    length_of_overland_flow = Column(Float, nullable=False, default=0)
    mean_bifurcation_ratio = Column(Float, nullable=False, default=0)
    mean_stream_length_basin = Column(Float, nullable=False, default=0)
    stream_order_table = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    intervention: Mapped[Intervention] = relationship(
        "Intervention", back_populates="morphological"
    )


class HydrologicalParams(Base):
    __tablename__ = "hydrological_params"

    id = Column(Integer, primary_key=True, autoincrement=True)
    intervention_id = Column(
        String, ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    annual_rainfall = Column(Float, nullable=False, default=0)
    monsoon_rainfall = Column(Float, nullable=False, default=0)
    runoff_coefficient = Column(Float, nullable=False, default=0)
    annual_runoff = Column(Float, nullable=False, default=0)
    peak_discharge = Column(Float, nullable=False, default=0)
    base_flow = Column(Float, nullable=False, default=0)
    groundwater_level = Column(Float, nullable=False, default=0)
    groundwater_recharge = Column(Float, nullable=False, default=0)
    evapotranspiration = Column(Float, nullable=False, default=0)
    soil_moisture = Column(Float, nullable=False, default=0)
    water_yield = Column(Float, nullable=False, default=0)
    sediment_yield = Column(Float, nullable=False, default=0)
    flood_frequency = Column(Float, nullable=False, default=0)
    drought_index = Column(Float, nullable=False, default=0)
    stream_flow = Column(JSON, nullable=False, default=dict)
    reservoir_capacity = Column(Float, nullable=False, default=0)
    storage_efficiency = Column(Float, nullable=False, default=0)
    infiltration_loss = Column(Float, nullable=False, default=0)
    surface_runoff = Column(Float, nullable=False, default=0)
    sub_surface_flow = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    intervention: Mapped[Intervention] = relationship(
        "Intervention", back_populates="hydrological"
    )


class NDVITimeSeriesPoint(Base):
    __tablename__ = "ndvi_time_series"

    id = Column(Integer, primary_key=True, autoincrement=True)
    intervention_id = Column(
        String, ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False
    )
    year = Column(Integer, nullable=False)
    value = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    intervention: Mapped[Intervention] = relationship(
        "Intervention", back_populates="ndvi_time_series"
    )

    __table_args__ = (
        Index("idx_ndvi_ts_intervention_id", "intervention_id"),
        Index("idx_ndvi_ts_year", "year"),
        Index("uix_ndvi_ts_intervention_year", "intervention_id", "year", unique=True),
    )


class FieldObservation(Base):
    """
    Geotagged field imagery + AI detection results.
    Images are uploaded to POST /api/imagery/upload, GPS is pulled from
    EXIF, and detections are produced by a swappable `run_detector()`
    (threshold-based fallback by default; replaceable with fine-tuned
    YOLO weights later without touching this model).
    """
    __tablename__ = "field_observations"

    id = Column(String, primary_key=True)
    image_filename = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    captured_at = Column(DateTime, nullable=True)
    detected_class = Column(String, nullable=False)  # check_dam | farm_pond | plantation | vegetation | water_body | unclassified
    confidence = Column(Float, nullable=False)
    geojson_feature = Column(JSON, nullable=False)
    intervention_id = Column(
        String, ForeignKey("interventions.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_field_obs_detected_class", "detected_class"),
        Index("idx_field_obs_uploaded_at", "uploaded_at"),
        Index("idx_field_obs_lat_lng", "latitude", "longitude"),
        Index("idx_field_obs_intervention_id", "intervention_id"),
    )
