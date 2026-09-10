import { Router, Request, Response, NextFunction } from 'express';
import { query, getPool } from '../db';
import { calculateImpactScore } from '../services/impactScore';
import { generateRecommendation } from '../services/recommendation';
import {
  createInterventionSchema,
  updateInterventionSchema,
  type CreateInterventionInput,
  type UpdateInterventionInput,
} from '../schemas/intervention';
import type { Intervention, MorphologicalParams, HydrologicalParams, NDVITimeSeriesPoint } from '../types';

const router = Router();

function uuid(): string {
  return 'int_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

interface InterventionRow {
  id: string;
  type: Intervention['type'];
  latitude: number;
  longitude: number;
  village: string;
  construction_year: number;
  condition: Intervention['condition'];
  confidence: number;
  photo: string | null;
  capture_date: string;
  water_present: boolean;
  ndvi_before: number;
  ndvi_after: number;
  ndwi_before: number;
  ndwi_after: number;
  water_area_before: number;
  water_area_after: number;
  rainfall_change: number;
  impact_score: number;
  risk_level: Intervention['riskLevel'];
  recommendation: string;
  notes: string | null;
}

interface MorphologicalRow {
  elevation: number;
  slope: number;
  aspect: string;
  drainage_density: number;
  stream_order: number;
  watershed_area: number;
  basin_length: number;
  basin_width: number;
  circularity_ratio: number;
  elongation_ratio: number;
  form_factor: number;
  ruggedness_number: number;
  relief_ratio: number;
  total_relief: number;
  mean_slope: number;
  texture_ratio: number;
  land_use: {
    agriculture: number;
    forest: number;
    wasteland: number;
    waterBody: number;
    builtUp: number;
  };
  soil_type: string;
  soil_depth: number;
  infiltration_rate: number;
}

interface HydrologicalRow {
  annual_rainfall: number;
  monsoon_rainfall: number;
  runoff_coefficient: number;
  annual_runoff: number;
  peak_discharge: number;
  base_flow: number;
  groundwater_level: number;
  groundwater_recharge: number;
  evapotranspiration: number;
  soil_moisture: number;
  water_yield: number;
  sediment_yield: number;
  flood_frequency: number;
  drought_index: number;
  stream_flow: {
    min: number;
    max: number;
    mean: number;
  };
  reservoir_capacity: number;
  storage_efficiency: number;
  infiltration_loss: number;
  surface_runoff: number;
  sub_surface_flow: number;
}

interface NDVITimeSeriesRow {
  year: number;
  value: number;
}

function buildMorphological(row: MorphologicalRow): MorphologicalParams {
  return {
    elevation: row.elevation,
    slope: row.slope,
    aspect: row.aspect,
    drainageDensity: row.drainage_density,
    streamOrder: row.stream_order,
    watershedArea: row.watershed_area,
    basinLength: row.basin_length,
    basinWidth: row.basin_width,
    circularityRatio: row.circularity_ratio,
    elongationRatio: row.elongation_ratio,
    formFactor: row.form_factor,
    ruggednessNumber: row.ruggedness_number,
    reliefRatio: row.relief_ratio,
    totalRelief: row.total_relief,
    meanSlope: row.mean_slope,
    textureRatio: row.texture_ratio,
    landUse: row.land_use,
    soilType: row.soil_type,
    soilDepth: row.soil_depth,
    infiltrationRate: row.infiltration_rate,
  };
}

function buildHydrological(row: HydrologicalRow): HydrologicalParams {
  return {
    annualRainfall: row.annual_rainfall,
    monsoonRainfall: row.monsoon_rainfall,
    runoffCoefficient: row.runoff_coefficient,
    annualRunoff: row.annual_runoff,
    peakDischarge: row.peak_discharge,
    baseFlow: row.base_flow,
    groundwaterLevel: row.groundwater_level,
    groundwaterRecharge: row.groundwater_recharge,
    evapotranspiration: row.evapotranspiration,
    soilMoisture: row.soil_moisture,
    waterYield: row.water_yield,
    sedimentYield: row.sediment_yield,
    floodFrequency: row.flood_frequency,
    droughtIndex: row.drought_index,
    streamFlow: row.stream_flow,
    reservoirCapacity: row.reservoir_capacity,
    storageEfficiency: row.storage_efficiency,
    infiltrationLoss: row.infiltration_loss,
    surfaceRunoff: row.surface_runoff,
    subSurfaceFlow: row.sub_surface_flow,
  };
}

function buildIntervention(
  row: InterventionRow,
  morph: MorphologicalRow | null,
  hydro: HydrologicalRow | null,
  ndviTs: NDVITimeSeriesRow[]
): Intervention {
  return {
    id: row.id,
    type: row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    village: row.village,
    constructionYear: row.construction_year,
    condition: row.condition,
    confidence: row.confidence,
    photo: row.photo,
    captureDate: row.capture_date,
    waterPresent: row.water_present,
    ndviBefore: row.ndvi_before,
    ndviAfter: row.ndvi_after,
    ndwiBefore: row.ndwi_before,
    ndwiAfter: row.ndwi_after,
    waterAreaBefore: row.water_area_before,
    waterAreaAfter: row.water_area_after,
    rainfallChange: row.rainfall_change,
    impactScore: row.impact_score,
    riskLevel: row.risk_level,
    recommendation: row.recommendation,
    notes: row.notes ?? undefined,
    ndviTimeSeries: ndviTs.map((r) => ({ year: r.year, value: r.value } as NDVITimeSeriesPoint)),
    morphological: morph ? buildMorphological(morph) : ({} as MorphologicalParams),
    hydrological: hydro ? buildHydrological(hydro) : ({} as HydrologicalParams),
  };
}

async function fetchInterventionById(id: string): Promise<Intervention | null> {
  const [intResult, morphResult, hydroResult, ndviResult] = await Promise.all([
    query<InterventionRow>('SELECT * FROM interventions WHERE id = $1', [id]),
    query<MorphologicalRow>('SELECT * FROM morphological_params WHERE intervention_id = $1', [id]),
    query<HydrologicalRow>('SELECT * FROM hydrological_params WHERE intervention_id = $1', [id]),
    query<NDVITimeSeriesRow>('SELECT year, value FROM ndvi_time_series WHERE intervention_id = $1 ORDER BY year ASC', [id]),
  ]);

  if (intResult.rows.length === 0) return null;

  return buildIntervention(
    intResult.rows[0],
    morphResult.rows[0] ?? null,
    hydroResult.rows[0] ?? null,
    ndviResult.rows
  );
}

async function fetchAllInterventions(): Promise<Intervention[]> {
  const [intResult, morphResult, hydroResult, ndviResult] = await Promise.all([
    query<InterventionRow>('SELECT * FROM interventions ORDER BY created_at DESC'),
    query<MorphologicalRow & { intervention_id: string }>('SELECT * FROM morphological_params'),
    query<HydrologicalRow & { intervention_id: string }>('SELECT * FROM hydrological_params'),
    query<NDVITimeSeriesRow & { intervention_id: string }>(
      'SELECT intervention_id, year, value FROM ndvi_time_series ORDER BY intervention_id, year ASC'
    ),
  ]);

  const morphMap = new Map(morphResult.rows.map((r) => [r.intervention_id, r]));
  const hydroMap = new Map(hydroResult.rows.map((r) => [r.intervention_id, r]));
  const ndviMap = new Map<string, NDVITimeSeriesRow[]>();
  for (const r of ndviResult.rows) {
    const arr = ndviMap.get(r.intervention_id) ?? [];
    arr.push({ year: r.year, value: r.value });
    ndviMap.set(r.intervention_id, arr);
  }

  return intResult.rows.map((row) =>
    buildIntervention(
      row,
      morphMap.get(row.id) ?? null,
      hydroMap.get(row.id) ?? null,
      ndviMap.get(row.id) ?? []
    )
  );
}

async function insertMorphological(client: any, interventionId: string, m: MorphologicalParams): Promise<void> {
  await client.query(
    `INSERT INTO morphological_params (
      intervention_id, elevation, slope, aspect, drainage_density, stream_order,
      watershed_area, basin_length, basin_width, circularity_ratio, elongation_ratio,
      form_factor, ruggedness_number, relief_ratio, total_relief, mean_slope,
      texture_ratio, land_use, soil_type, soil_depth, infiltration_rate
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT (intervention_id) DO UPDATE SET
      elevation = EXCLUDED.elevation,
      slope = EXCLUDED.slope,
      aspect = EXCLUDED.aspect,
      drainage_density = EXCLUDED.drainage_density,
      stream_order = EXCLUDED.stream_order,
      watershed_area = EXCLUDED.watershed_area,
      basin_length = EXCLUDED.basin_length,
      basin_width = EXCLUDED.basin_width,
      circularity_ratio = EXCLUDED.circularity_ratio,
      elongation_ratio = EXCLUDED.elongation_ratio,
      form_factor = EXCLUDED.form_factor,
      ruggedness_number = EXCLUDED.ruggedness_number,
      relief_ratio = EXCLUDED.relief_ratio,
      total_relief = EXCLUDED.total_relief,
      mean_slope = EXCLUDED.mean_slope,
      texture_ratio = EXCLUDED.texture_ratio,
      land_use = EXCLUDED.land_use,
      soil_type = EXCLUDED.soil_type,
      soil_depth = EXCLUDED.soil_depth,
      infiltration_rate = EXCLUDED.infiltration_rate,
      updated_at = CURRENT_TIMESTAMP`,
    [
      interventionId,
      m.elevation, m.slope, m.aspect, m.drainageDensity, m.streamOrder,
      m.watershedArea, m.basinLength, m.basinWidth, m.circularityRatio, m.elongationRatio,
      m.formFactor, m.ruggednessNumber, m.reliefRatio, m.totalRelief, m.meanSlope,
      m.textureRatio, JSON.stringify(m.landUse), m.soilType, m.soilDepth, m.infiltrationRate,
    ]
  );
}

async function insertHydrological(client: any, interventionId: string, h: HydrologicalParams): Promise<void> {
  await client.query(
    `INSERT INTO hydrological_params (
      intervention_id, annual_rainfall, monsoon_rainfall, runoff_coefficient, annual_runoff,
      peak_discharge, base_flow, groundwater_level, groundwater_recharge, evapotranspiration,
      soil_moisture, water_yield, sediment_yield, flood_frequency, drought_index,
      stream_flow, reservoir_capacity, storage_efficiency, infiltration_loss,
      surface_runoff, sub_surface_flow
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT (intervention_id) DO UPDATE SET
      annual_rainfall = EXCLUDED.annual_rainfall,
      monsoon_rainfall = EXCLUDED.monsoon_rainfall,
      runoff_coefficient = EXCLUDED.runoff_coefficient,
      annual_runoff = EXCLUDED.annual_runoff,
      peak_discharge = EXCLUDED.peak_discharge,
      base_flow = EXCLUDED.base_flow,
      groundwater_level = EXCLUDED.groundwater_level,
      groundwater_recharge = EXCLUDED.groundwater_recharge,
      evapotranspiration = EXCLUDED.evapotranspiration,
      soil_moisture = EXCLUDED.soil_moisture,
      water_yield = EXCLUDED.water_yield,
      sediment_yield = EXCLUDED.sediment_yield,
      flood_frequency = EXCLUDED.flood_frequency,
      drought_index = EXCLUDED.drought_index,
      stream_flow = EXCLUDED.stream_flow,
      reservoir_capacity = EXCLUDED.reservoir_capacity,
      storage_efficiency = EXCLUDED.storage_efficiency,
      infiltration_loss = EXCLUDED.infiltration_loss,
      surface_runoff = EXCLUDED.surface_runoff,
      sub_surface_flow = EXCLUDED.sub_surface_flow,
      updated_at = CURRENT_TIMESTAMP`,
    [
      interventionId,
      h.annualRainfall, h.monsooRrainfall, h.runoffCoefficient, h.annualRunoff,
      h.peakDischarge, h.baseFlow, h.groundwaterLevel, h.groundwaterRecharge, h.evapotranspiration,
      h.soilMoisture, h.waterYield, h.sedimentYield, h.floodFrequency, h.droughtIndex,
      JSON.stringify(h.streamFlow), h.reservoirCapacity, h.storageEfficiency, h.infiltrationLoss,
      h.surfaceRunoff, h.subSurfaceFlow,
    ]
  );
}

async function replaceNdviTimeSeries(client: any, interventionId: string, ts: NDVITimeSeriesPoint[]): Promise<void> {
  await client.query('DELETE FROM ndvi_time_series WHERE intervention_id = $1', [interventionId]);
  for (const point of ts) {
    await client.query(
      'INSERT INTO ndvi_time_series (intervention_id, year, value) VALUES ($1, $2, $3)',
      [interventionId, point.year, point.value]
    );
  }
}

function computeDerivedFields(intervention: Omit<Intervention, 'impactScore' | 'riskLevel' | 'recommendation'> & {
  impactScore?: number;
  riskLevel?: Intervention['riskLevel'];
  recommendation?: string;
}): { impactScore: number; riskLevel: Intervention['riskLevel']; recommendation: string } {
  const baseInt = intervention as unknown as Intervention;
  const impact = calculateImpactScore(baseInt);
  const impactScore = impact.score;
  const riskLevel = impact.label as Intervention['riskLevel'];
  const intWithScore: Intervention = {
    ...baseInt,
    impactScore,
    riskLevel,
    recommendation: intervention.recommendation ?? '',
  };
  const recommendation = generateRecommendation(intWithScore);
  return { impactScore, riskLevel, recommendation };
}

async function handleValidationError(err: unknown, res: Response, next: NextFunction): Promise<void> {
  const e = err as any;
  if (e && e.issues) {
    res.status(400).json({ error: 'Validation failed', issues: e.issues });
    return;
  }
  next(err);
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interventions = await fetchAllInterventions();
    res.json({ data: interventions });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const intervention = await fetchInterventionById(id);
    if (!intervention) {
      res.status(404).json({ error: 'Intervention not found' });
      return;
    }
    res.json({ data: intervention });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const parsed = createInterventionSchema.parse(req.body) as CreateInterventionInput;
    const id = parsed.id ?? uuid();

    await client.query('BEGIN');

    const impactPlaceholders = computeDerivedFields({
      id,
      type: parsed.type,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      village: parsed.village,
      constructionYear: parsed.constructionYear,
      condition: parsed.condition,
      confidence: parsed.confidence,
      photo: parsed.photo ?? null,
      captureDate: parsed.captureDate,
      waterPresent: parsed.waterPresent,
      ndviBefore: parsed.ndviBefore,
      ndviAfter: parsed.ndviAfter,
      ndwiBefore: parsed.ndwiBefore,
      ndwiAfter: parsed.ndwiAfter,
      waterAreaBefore: parsed.waterAreaBefore,
      waterAreaAfter: parsed.waterAreaAfter,
      rainfallChange: parsed.rainfallChange,
      ndviTimeSeries: parsed.ndviTimeSeries,
      morphological: parsed.morphological,
      hydrological: parsed.hydrological,
      notes: parsed.notes,
    });

    await client.query(
      `INSERT INTO interventions (
        id, type, latitude, longitude, village, construction_year, condition, confidence,
        photo, capture_date, water_present, ndvi_before, ndvi_after, ndwi_before, ndwi_after,
        water_area_before, water_area_after, rainfall_change, impact_score, risk_level,
        recommendation, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        id,
        parsed.type,
        parsed.latitude,
        parsed.longitude,
        parsed.village,
        parsed.constructionYear,
        parsed.condition,
        parsed.confidence,
        parsed.photo ?? null,
        parsed.captureDate,
        parsed.waterPresent,
        parsed.ndviBefore,
        parsed.ndviAfter,
        parsed.ndwiBefore,
        parsed.ndwiAfter,
        parsed.waterAreaBefore,
        parsed.waterAreaAfter,
        parsed.rainfallChange,
        impactPlaceholders.impactScore,
        impactPlaceholders.riskLevel,
        impactPlaceholders.recommendation,
        parsed.notes ?? null,
      ]
    );

    await insertMorphological(client, id, parsed.morphological);
    await insertHydrological(client, id, parsed.hydrological);
    await replaceNdviTimeSeries(client, id, parsed.ndviTimeSeries);

    await client.query('COMMIT');

    const result = await fetchInterventionById(id);
    res.status(201).json({ data: result });
  } catch (err) {
    await client.query('ROLLBACK');
    handleValidationError(err, res, next);
  } finally {
    client.release();
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const existing = await fetchInterventionById(id);
    if (!existing) {
      res.status(404).json({ error: 'Intervention not found' });
      return;
    }

    const parsed = updateInterventionSchema.parse(req.body) as UpdateInterventionInput;

    const merged: Omit<Intervention, 'impactScore' | 'riskLevel' | 'recommendation'> = {
      id: existing.id,
      type: parsed.type ?? existing.type,
      latitude: parsed.latitude ?? existing.latitude,
      longitude: parsed.longitude ?? existing.longitude,
      village: parsed.village ?? existing.village,
      constructionYear: parsed.constructionYear ?? existing.constructionYear,
      condition: parsed.condition ?? existing.condition,
      confidence: parsed.confidence ?? existing.confidence,
      photo: parsed.photo !== undefined ? parsed.photo : existing.photo,
      captureDate: parsed.captureDate ?? existing.captureDate,
      waterPresent: parsed.waterPresent ?? existing.waterPresent,
      ndviBefore: parsed.ndviBefore ?? existing.ndviBefore,
      ndviAfter: parsed.ndviAfter ?? existing.ndviAfter,
      ndwiBefore: parsed.ndwiBefore ?? existing.ndwiBefore,
      ndwiAfter: parsed.ndwiAfter ?? existing.ndwiAfter,
      waterAreaBefore: parsed.waterAreaBefore ?? existing.waterAreaBefore,
      waterAreaAfter: parsed.waterAreaAfter ?? existing.waterAreaAfter,
      rainfallChange: parsed.rainfallChange ?? existing.rainfallChange,
      ndviTimeSeries: parsed.ndviTimeSeries ?? existing.ndviTimeSeries,
      morphological: parsed.morphological ?? existing.morphological,
      hydrological: parsed.hydrological ?? existing.hydrological,
      notes: parsed.notes !== undefined ? parsed.notes : existing.notes,
    };

    const derived = computeDerivedFields(merged);

    await client.query('BEGIN');

    await client.query(
      `UPDATE interventions SET
        type = $1, latitude = $2, longitude = $3, village = $4, construction_year = $5,
        condition = $6, confidence = $7, photo = $8, capture_date = $9, water_present = $10,
        ndvi_before = $11, ndvi_after = $12, ndwi_before = $13, ndwi_after = $14,
        water_area_before = $15, water_area_after = $16, rainfall_change = $17,
        impact_score = $18, risk_level = $19, recommendation = $20, notes = $21,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $22`,
      [
        merged.type,
        merged.latitude,
        merged.longitude,
        merged.village,
        merged.constructionYear,
        merged.condition,
        merged.confidence,
        merged.photo ?? null,
        merged.captureDate,
        merged.waterPresent,
        merged.ndviBefore,
        merged.ndviAfter,
        merged.ndwiBefore,
        merged.ndwiAfter,
        merged.waterAreaBefore,
        merged.waterAreaAfter,
        merged.rainfallChange,
        derived.impactScore,
        derived.riskLevel,
        derived.recommendation,
        merged.notes ?? null,
        id,
      ]
    );

    if (parsed.morphological) {
      await insertMorphological(client, id, parsed.morphological);
    }
    if (parsed.hydrological) {
      await insertHydrological(client, id, parsed.hydrological);
    }
    if (parsed.ndviTimeSeries) {
      await replaceNdviTimeSeries(client, id, parsed.ndviTimeSeries);
    }

    await client.query('COMMIT');

    const result = await fetchInterventionById(id);
    res.json({ data: result });
  } catch (err) {
    await client.query('ROLLBACK');
    handleValidationError(err, res, next);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT 1 FROM interventions WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Intervention not found' });
      return;
    }
    await query('DELETE FROM interventions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
