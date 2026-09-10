-- 001_init.sql — Watershed Management Schema
--
-- BUG FIX vs the original TypeScript backend 001_init.sql:
--   30+ columns were MISSING from morphological_params and
--   hydrological_params — POST / PUT of the full Kasari River Basin
--   payloads would have thrown column-not-found errors.
--   This migration includes EVERY field referenced by schemas.py.

-- interventions ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interventions (
    id              VARCHAR PRIMARY KEY,
    type            VARCHAR NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    village         VARCHAR NOT NULL,
    construction_year INTEGER NOT NULL,
    condition       VARCHAR NOT NULL,
    confidence      DOUBLE PRECISION NOT NULL,
    photo           TEXT,
    capture_date    VARCHAR NOT NULL,
    water_present   BOOLEAN NOT NULL DEFAULT FALSE,
    ndvi_before     DOUBLE PRECISION NOT NULL,
    ndvi_after      DOUBLE PRECISION NOT NULL,
    ndwi_before     DOUBLE PRECISION NOT NULL,
    ndwi_after      DOUBLE PRECISION NOT NULL,
    water_area_before DOUBLE PRECISION NOT NULL,
    water_area_after  DOUBLE PRECISION NOT NULL,
    rainfall_change DOUBLE PRECISION NOT NULL,
    impact_score    DOUBLE PRECISION NOT NULL DEFAULT 0,
    risk_level      VARCHAR NOT NULL DEFAULT 'Moderate Impact',
    recommendation  TEXT NOT NULL DEFAULT '',
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interventions_village           ON interventions (village);
CREATE INDEX IF NOT EXISTS idx_interventions_type              ON interventions (type);
CREATE INDEX IF NOT EXISTS idx_interventions_condition         ON interventions (condition);
CREATE INDEX IF NOT EXISTS idx_interventions_risk_level        ON interventions (risk_level);
CREATE INDEX IF NOT EXISTS idx_interventions_impact_score      ON interventions (impact_score);
CREATE INDEX IF NOT EXISTS idx_interventions_construction_year ON interventions (construction_year);
CREATE INDEX IF NOT EXISTS idx_interventions_lat_lng           ON interventions (latitude, longitude);

-- morphological_params -----------------------------------------------------
CREATE TABLE IF NOT EXISTS morphological_params (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    intervention_id VARCHAR NOT NULL UNIQUE REFERENCES interventions(id) ON DELETE CASCADE,

    elevation          DOUBLE PRECISION NOT NULL DEFAULT 0,
    slope              DOUBLE PRECISION NOT NULL DEFAULT 0,
    aspect             VARCHAR NOT NULL DEFAULT 'N',
    drainage_density   DOUBLE PRECISION NOT NULL DEFAULT 0,
    stream_order       INTEGER NOT NULL DEFAULT 1,
    watershed_area     DOUBLE PRECISION NOT NULL DEFAULT 0,
    basin_length       DOUBLE PRECISION NOT NULL DEFAULT 0,
    basin_width        DOUBLE PRECISION NOT NULL DEFAULT 0,
    circularity_ratio  DOUBLE PRECISION NOT NULL DEFAULT 0,
    elongation_ratio   DOUBLE PRECISION NOT NULL DEFAULT 0,
    form_factor        DOUBLE PRECISION NOT NULL DEFAULT 0,
    ruggedness_number  DOUBLE PRECISION NOT NULL DEFAULT 0,
    relief_ratio       DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_relief       DOUBLE PRECISION NOT NULL DEFAULT 0,
    mean_slope         DOUBLE PRECISION NOT NULL DEFAULT 0,
    texture_ratio      DOUBLE PRECISION NOT NULL DEFAULT 0,
    land_use           JSONB NOT NULL DEFAULT '{}'::jsonb,
    soil_type          VARCHAR NOT NULL DEFAULT 'Vertisol',
    soil_depth         DOUBLE PRECISION NOT NULL DEFAULT 0,
    infiltration_rate  DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Kasari River Basin — fields MISSING from original 001_init.sql (BUG FIX)
    basin_area                     DOUBLE PRECISION NOT NULL DEFAULT 627.687,
    basin_perimeter                DOUBLE PRECISION NOT NULL DEFAULT 171.229,
    total_stream_number            INTEGER NOT NULL DEFAULT 650,
    total_stream_length            DOUBLE PRECISION NOT NULL DEFAULT 638.0,
    stream_frequency               DOUBLE PRECISION NOT NULL DEFAULT 0,
    drainage_texture               DOUBLE PRECISION NOT NULL DEFAULT 0,
    compactness_coefficient        DOUBLE PRECISION NOT NULL DEFAULT 0,
    constant_channel_maintenance   DOUBLE PRECISION NOT NULL DEFAULT 0,
    infiltration_number            DOUBLE PRECISION NOT NULL DEFAULT 0,
    drainage_intensity             DOUBLE PRECISION NOT NULL DEFAULT 0,
    lemniscate_ratio               DOUBLE PRECISION NOT NULL DEFAULT 0,
    time_of_concentration          DOUBLE PRECISION NOT NULL DEFAULT 0,
    maximum_elevation              DOUBLE PRECISION NOT NULL DEFAULT 947.8,
    minimum_elevation              DOUBLE PRECISION NOT NULL DEFAULT 456.82,
    mean_elevation                 DOUBLE PRECISION NOT NULL DEFAULT 584.41,
    mean_basin_slope               DOUBLE PRECISION NOT NULL DEFAULT 9.6,
    hypsometric_integral           DOUBLE PRECISION NOT NULL DEFAULT 0,
    relative_relief                DOUBLE PRECISION NOT NULL DEFAULT 0,
    dissection_index               DOUBLE PRECISION NOT NULL DEFAULT 0,
    melton_ruggedness_number       DOUBLE PRECISION NOT NULL DEFAULT 0,
    gradient_ratio                 DOUBLE PRECISION NOT NULL DEFAULT 0,
    channel_gradient               DOUBLE PRECISION NOT NULL DEFAULT 0,
    length_of_overland_flow        DOUBLE PRECISION NOT NULL DEFAULT 0,
    mean_bifurcation_ratio         DOUBLE PRECISION NOT NULL DEFAULT 0,
    mean_stream_length_basin       DOUBLE PRECISION NOT NULL DEFAULT 0,
    stream_order_table             JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_morpho_intervention_id ON morphological_params (intervention_id);

-- hydrological_params ------------------------------------------------------
CREATE TABLE IF NOT EXISTS hydrological_params (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    intervention_id VARCHAR NOT NULL UNIQUE REFERENCES interventions(id) ON DELETE CASCADE,

    annual_rainfall     DOUBLE PRECISION NOT NULL DEFAULT 0,
    monsoon_rainfall    DOUBLE PRECISION NOT NULL DEFAULT 0,  -- BUG FIX: no 'monsooRrainfall'
    runoff_coefficient  DOUBLE PRECISION NOT NULL DEFAULT 0,
    annual_runoff       DOUBLE PRECISION NOT NULL DEFAULT 0,
    peak_discharge      DOUBLE PRECISION NOT NULL DEFAULT 0,
    base_flow           DOUBLE PRECISION NOT NULL DEFAULT 0,
    groundwater_level   DOUBLE PRECISION NOT NULL DEFAULT 0,
    groundwater_recharge DOUBLE PRECISION NOT NULL DEFAULT 0,
    evapotranspiration  DOUBLE PRECISION NOT NULL DEFAULT 0,
    soil_moisture       DOUBLE PRECISION NOT NULL DEFAULT 0,
    water_yield         DOUBLE PRECISION NOT NULL DEFAULT 0,
    sediment_yield      DOUBLE PRECISION NOT NULL DEFAULT 0,
    flood_frequency     DOUBLE PRECISION NOT NULL DEFAULT 0,
    drought_index       DOUBLE PRECISION NOT NULL DEFAULT 0,
    stream_flow         JSONB NOT NULL DEFAULT '{}'::jsonb,
    reservoir_capacity  DOUBLE PRECISION NOT NULL DEFAULT 0,
    storage_efficiency  DOUBLE PRECISION NOT NULL DEFAULT 0,
    infiltration_loss   DOUBLE PRECISION NOT NULL DEFAULT 0,
    surface_runoff      DOUBLE PRECISION NOT NULL DEFAULT 0,
    sub_surface_flow    DOUBLE PRECISION NOT NULL DEFAULT 0,

    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hydro_intervention_id ON hydrological_params (intervention_id);

-- ndvi_time_series ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ndvi_time_series (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    intervention_id VARCHAR NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
    year    INTEGER NOT NULL,
    value   DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (intervention_id, year)
);

CREATE INDEX IF NOT EXISTS idx_ndvi_ts_intervention_id ON ndvi_time_series (intervention_id);
CREATE INDEX IF NOT EXISTS idx_ndvi_ts_year            ON ndvi_time_series (year);

-- schema_migrations (for the migration runner in app/db.py) ----------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
