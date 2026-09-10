import type {
  Intervention,
  AiAnalysisResult,
  SatelliteMetrics,
  ImpactBreakdown,
  MorphologicalParams,
  HydrologicalParams,
  GeoJSONCollection,
  SummaryStats,
  StreamOrderRow,
  LandUse,
  NDVITimeSeriesPoint,
  RunoffParameters,
} from '../types';
import watershedData from '../data/watershed.json';
import drainageData from '../data/drainage.json';

// Toggle API integration:
//   true  → hit FastAPI backend (http://localhost:8000 or VITE_API_BASE_URL)
//   false → use seeded deterministic demo data from this file.
const USE_API = false;
const API_BASE = (import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, init);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text || path}`);
  }
  if (resp.status === 204) return undefined as unknown as T;
  return (await resp.json()) as T;
}

// ---------------------------------------------------------------
// Deterministic PRNG + Kasari River Basin demo data generator
// (Identical seed 20240909 so frontend local fallback matches the
// FastAPI backend/services/seed.py generator.)
// ---------------------------------------------------------------
function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INTERVENTION_TYPES: Intervention['type'][] = ['Check Dam', 'Farm Pond', 'Plantation', 'Contour Trench'];
const VILLAGES = [
  'Wadegaon', 'Pabal', 'Kanhersar', 'Kasari',
  'Kivale', 'Bhajgaon', 'Nandivali', 'Rajapur',
  'Gajapur', 'Shahapur', 'Padali', 'Karvir',
];
const SOIL_TYPES = ['Vertisol', 'Inceptisol', 'Entisol', 'Alfisol'];
const ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const CONDITIONS: Intervention['condition'][] = ['Excellent', 'Good', 'Moderate', 'Poor'];

// Kasari River Basin — exact morphometric values from source spreadsheet
const KASARI_STREAM_ORDER_TABLE: StreamOrderRow[] = [
  { order: 1, streamNumber: 335, streamLengthKm: 369.82, meanStreamLength: 1.103940299, bifurcationRatio: 2.294520548 },
  { order: 2, streamNumber: 146, streamLengthKm: 135.62, meanStreamLength: 0.92890411,  streamLengthRatio: 1.188433001, bifurcationRatio: 1.417475728 },
  { order: 3, streamNumber: 103, streamLengthKm: 70.19,  meanStreamLength: 0.681456311, streamLengthRatio: 0.733613194, bifurcationRatio: 2.145833333 },
  { order: 4, streamNumber: 48,  streamLengthKm: 38.54,  meanStreamLength: 0.802916667, streamLengthRatio: 1.178236453 },
  { order: 5, streamNumber: 18,  streamLengthKm: 23.83,  meanStreamLength: 1.323888889 },
];

const KASARI_BASELINE_AREAL = {
  basinAreaKm2: 627.687,
  basinPerimeterKm: 171.229,
  basinLengthKm: 49.7,
  drainageDensity: 1.016430163,
  streamFrequency: 1.035547972,
  drainageTexture: 3.796085943,
  textureRatio: 3.796085943,
  formFactor: 0.254115032,
  circularityRatio: 0.268892156,
  elongationRatio: 0.340542,
  compactnessCoefficient: 2.107245354,
  constantChannelMaintenance: 0.983835423,
  infiltrationNumber: 1.052562195,
  drainageIntensity: 1.018808777,
  lemniscateRatio: 0.983806419,
  meanStreamLengthBasin: 156.94,
  timeOfConcentrationHrs: 18.3298916,
} as const;

const KASARI_BASELINE_TERRAIN = {
  maximumElevationM: 947.8,
  minimumElevationM: 456.82,
  meanElevationM: 584.41,
  meanBasinSlope: 9.6,
  hypsometricIntegral: 0.259868019,
} as const;

const KASARI_BASELINE_RELIEF = {
  basinReliefM: 490.98,
  reliefRatio: 9.878873239,
  relativeRelief: 2.867388118,
  ruggednessNumber: 499.0468816,
  dissectionIndex: 0.518020679,
  meltonRuggednessNumber: 9.672033781,
  gradientRatio: 9.878873239,
  channelGradient: 3.128456735,
  lengthOfOverlandFlow: 0.491917712,
} as const;

const KASARI_SCS_RUNOFF: RunoffParameters = {
  curveNumber: 79,
  potentialMaxRetentionMm: 25400 / 79 - 254,
  initialAbstractionMm: 13.110,
  rainfallDepthMm: 50,
  effectiveRainfallMm: 50 - 13.110,
  directRunoffMm: Math.pow(50 - 13.110, 2) / ((50 - 13.110) + (25400 / 79 - 254)),
  runoffCoefficient: Math.pow(50 - 13.110, 2) / ((50 - 13.110) + (25400 / 79 - 254)) / 50,
  imperviousAreaPct: 0.460,
  baseflowCumecs: 0.5,
  timeOfConcentrationHrs: KASARI_BASELINE_AREAL.timeOfConcentrationHrs,
};

function r_range(r: () => number, lo: number, hi: number) { return lo + r() * (hi - lo); }
function r_int(r: () => number, lo: number, hi: number) { return Math.floor(r_range(r, lo, hi + 1)); }
function r_pick<T>(r: () => number, arr: T[]): T { return arr[r_int(r, 0, arr.length - 1)]; }
function vr(base: number, r: () => number, pct = 0.15) { return base * (1 - pct / 2 + r() * pct); }

function buildLandUse(r: () => number): LandUse {
  const ag = 40 + r() * 25;
  const forest = 15 + r() * 20;
  const waste = 5 + r() * 10;
  const water = 1 + r() * 4;
  const built = Math.max(1, 100 - ag - forest - waste - water);
  return {
    agriculture: +ag.toFixed(1),
    forest: +forest.toFixed(1),
    wasteland: +waste.toFixed(1),
    waterBody: +water.toFixed(1),
    builtUp: +built.toFixed(1),
  };
}

function makeMorphological(siteSeed: number, exactBaseline = false): MorphologicalParams {
  const r = mulberry32(siteSeed);
  const v = exactBaseline
    ? (base: number) => base
    : (base: number, pct = 0.1) => +vr(base, r, pct).toFixed(String(base).split('.')[1]?.length ?? 2);

  return {
    linear: {
      streamOrderTable: KASARI_STREAM_ORDER_TABLE,
      totalStreamNumber: 650,
      totalStreamLength: 638,
      meanBifurcationRatio: 1.95260987,
    },
    areal: {
      basinAreaKm2: KASARI_BASELINE_AREAL.basinAreaKm2,
      basinPerimeterKm: KASARI_BASELINE_AREAL.basinPerimeterKm,
      basinLengthKm: KASARI_BASELINE_AREAL.basinLengthKm,
      drainageDensity: +v(KASARI_BASELINE_AREAL.drainageDensity, 0.1),
      streamFrequency: +v(KASARI_BASELINE_AREAL.streamFrequency, 0.1),
      drainageTexture: +v(KASARI_BASELINE_AREAL.drainageTexture, 0.1),
      textureRatio: +v(KASARI_BASELINE_AREAL.textureRatio, 0.1),
      formFactor: +v(KASARI_BASELINE_AREAL.formFactor, 0.1),
      circularityRatio: +v(KASARI_BASELINE_AREAL.circularityRatio, 0.1),
      elongationRatio: +v(KASARI_BASELINE_AREAL.elongationRatio, 0.1),
      compactnessCoefficient: +v(KASARI_BASELINE_AREAL.compactnessCoefficient, 0.1),
      constantChannelMaintenance: +v(KASARI_BASELINE_AREAL.constantChannelMaintenance, 0.1),
      infiltrationNumber: +v(KASARI_BASELINE_AREAL.infiltrationNumber, 0.15),
      drainageIntensity: +v(KASARI_BASELINE_AREAL.drainageIntensity, 0.15),
      lemniscateRatio: +v(KASARI_BASELINE_AREAL.lemniscateRatio, 0.1),
      meanStreamLengthBasin: KASARI_BASELINE_AREAL.meanStreamLengthBasin,
      timeOfConcentrationHrs: +v(KASARI_BASELINE_AREAL.timeOfConcentrationHrs, 0.1),
    },
    terrain: {
      maximumElevationM: KASARI_BASELINE_TERRAIN.maximumElevationM,
      minimumElevationM: KASARI_BASELINE_TERRAIN.minimumElevationM,
      meanElevationM: +v(KASARI_BASELINE_TERRAIN.meanElevationM, 0.1),
      meanBasinSlope: +v(KASARI_BASELINE_TERRAIN.meanBasinSlope, 0.2),
      aspect: r_pick(r, ASPECTS),
      hypsometricIntegral: +v(KASARI_BASELINE_TERRAIN.hypsometricIntegral, 0.05),
    },
    relief: {
      basinReliefM: KASARI_BASELINE_RELIEF.basinReliefM,
      reliefRatio: +v(KASARI_BASELINE_RELIEF.reliefRatio, 0.2),
      relativeRelief: +v(KASARI_BASELINE_RELIEF.relativeRelief, 0.2),
      ruggednessNumber: +v(KASARI_BASELINE_RELIEF.ruggednessNumber, 0.2),
      dissectionIndex: +v(KASARI_BASELINE_RELIEF.dissectionIndex, 0.2),
      meltonRuggednessNumber: +v(KASARI_BASELINE_RELIEF.meltonRuggednessNumber, 0.2),
      gradientRatio: +v(KASARI_BASELINE_RELIEF.gradientRatio, 0.2),
      channelGradient: +v(KASARI_BASELINE_RELIEF.channelGradient, 0.25),
      lengthOfOverlandFlow: +v(KASARI_BASELINE_RELIEF.lengthOfOverlandFlow, 0.2),
    },
    landUse: buildLandUse(r),
    soilType: r_pick(r, SOIL_TYPES),
    soilDepth: +vr(1.2, r, 0.6).toFixed(2),
    infiltrationRate: +vr(8.5, r, 0.5).toFixed(1),
  };
}

function makeHydrological(siteSeed: number): HydrologicalParams {
  const r = mulberry32(siteSeed + 1000);
  return {
    annualRainfall: +vr(2400, r, 0.15).toFixed(0),
    monsoonRainfall: +vr(2050, r, 0.15).toFixed(0),
    runoffCoefficient: +vr(KASARI_SCS_RUNOFF.runoffCoefficient, r, 0.2).toFixed(3),
    annualRunoff: +vr(900, r, 0.2).toFixed(0),
    peakDischarge: +vr(18.5, r, 0.3).toFixed(1),
    baseFlow: +vr(KASARI_SCS_RUNOFF.baseflowCumecs, r, 0.25).toFixed(2),
    groundwaterLevel: +vr(6.8, r, 0.2).toFixed(2),
    groundwaterRecharge: +vr(380, r, 0.25).toFixed(0),
    evapotranspiration: +vr(1250, r, 0.15).toFixed(0),
    soilMoisture: +vr(28, r, 0.2).toFixed(1),
    waterYield: +vr(720, r, 0.2).toFixed(0),
    sedimentYield: +vr(4.2, r, 0.3).toFixed(2),
    floodFrequency: +vr(0.18, r, 0.3).toFixed(3),
    droughtIndex: +vr(0.32, r, 0.25).toFixed(3),
    streamFlow: {
      min: +vr(1.1, r, 0.25).toFixed(2),
      max: +vr(32.4, r, 0.25).toFixed(2),
      mean: +vr(8.6, r, 0.2).toFixed(1),
    },
    reservoirCapacity: +vr(180000, r, 0.4).toFixed(0),
    storageEfficiency: +vr(0.62, r, 0.2).toFixed(3),
    infiltrationLoss: +vr(520, r, 0.2).toFixed(0),
    surfaceRunoff: +vr(540, r, 0.25).toFixed(0),
    subSurfaceFlow: +vr(360, r, 0.25).toFixed(0),
    runoff: { ...KASARI_SCS_RUNOFF },
  };
}

function generateInterventions(): Intervention[] {
  const count = 12;
  const results: Intervention[] = [];
  // Kolhapur district fallback centroid (16.6917°N, 74.2333°E) — approximate Kasari basin center
  // DEMO PLACEHOLDER — pending field-verified real coordinates against the GIS basin polygon
  const basinCenter: [number, number] = [16.6917, 74.2333];

  for (let i = 0; i < count; i++) {
    const seed = 2024000 + i;
    const r = mulberry32(seed);
    const type = INTERVENTION_TYPES[i % INTERVENTION_TYPES.length];
    const ndviBefore = +(0.28 + r() * 0.12).toFixed(3);
    const ndviAfter = +(ndviBefore + 0.06 + r() * 0.08).toFixed(3);
    const ndwiBefore = +(0.04 + r() * 0.06).toFixed(3);
    const ndwiAfter = +(ndwiBefore + 0.04 + r() * 0.05).toFixed(3);
    const impact = Math.round(55 + r() * 40);
    const risk: Intervention['riskLevel'] =
      impact >= 75 ? 'High Impact' : impact >= 50 ? 'Moderate Impact' : impact >= 35 ? 'Needs Review' : 'At Risk';
    const conditionIdx = impact >= 80 ? 0 : impact >= 60 ? 1 : impact >= 40 ? 2 : 3;

    // DEMO PLACEHOLDER — random radius scatter around centroid, not field-verified locations
    const angle = (i / count) * Math.PI * 2 + r() * 0.5;
    const radius = 0.04 + r() * 0.1;
    const lat = basinCenter[0] + Math.cos(angle) * radius;
    const lng = basinCenter[1] + Math.sin(angle) * radius;

    const ndviTimeSeries: NDVITimeSeriesPoint[] = [];
    for (let yr = 2021; yr <= 2025; yr++) {
      ndviTimeSeries.push({
        year: yr,
        value: +(ndviBefore + ((yr - 2021) / 4) * (ndviAfter - ndviBefore) + (r() - 0.5) * 0.015).toFixed(3),
      });
    }

    results.push({
      id: `KSR-${String(i + 1).padStart(3, '0')}`,
      type,
      latitude: +lat.toFixed(5),
      longitude: +lng.toFixed(5),
      village: VILLAGES[i % VILLAGES.length],
      constructionYear: 2018 + (i % 6),
      condition: CONDITIONS[conditionIdx],
      confidence: +(0.82 + r() * 0.16).toFixed(2) * 100,
      photo: null,
      captureDate: `2025-${String(3 + (i % 8)).padStart(2, '0')}-${String(10 + (i % 18)).padStart(2, '0')}`,
      waterPresent: type !== 'Plantation' ? r() > 0.15 : false,
      ndviBefore,
      ndviAfter,
      ndwiBefore,
      ndwiAfter,
      waterAreaBefore: +(1.2 + r() * 2.5).toFixed(2),
      waterAreaAfter: +(2.8 + r() * 4.2).toFixed(2),
      rainfallChange: +(r() * 8 - 2).toFixed(1),
      impactScore: impact,
      riskLevel: risk,
      recommendation:
        type === 'Check Dam'
          ? 'Regular desilting and spillway maintenance recommended before monsoon.'
          : type === 'Farm Pond'
          ? 'Lining repair and bund strengthening suggested for improved storage.'
          : type === 'Plantation'
          ? 'Continue protective irrigation; mixed species planting recommended in buffer zone.'
          : 'Monitor erosion rates; supplementary contour bunding advised on steeper slopes.',
      ndviTimeSeries,
      morphological: makeMorphological(seed),
      hydrological: makeHydrological(seed),
      notes: i % 3 === 0 ? 'Site visit scheduled for Q4 2025.' : undefined,
    });
  }
  return results;
}

const CACHED_INTERVENTIONS: Intervention[] = generateInterventions();

// ---------------------------------------------------------------
// Service exports
// ---------------------------------------------------------------
export const interventionService = {
  async getInterventions(): Promise<Intervention[]> {
    if (USE_API) {
      try {
        return await apiJson<Intervention[]>('/api/interventions');
      } catch (e) {
        console.warn('[interventionService] API down, falling back to local seed');
      }
    }
    return CACHED_INTERVENTIONS;
  },

  async getInterventionById(id: string): Promise<Intervention | null> {
    if (USE_API) {
      try {
        return await apiJson<Intervention>(`/api/interventions/${id}`);
      } catch (e) {
        console.warn('[interventionService] API down, falling back to local seed');
      }
    }
    return CACHED_INTERVENTIONS.find((i: Intervention) => i.id === id) ?? null;
  },

  async getSummaryStats(): Promise<SummaryStats> {
    if (USE_API) {
      try {
        const s = await apiJson<SummaryStats & { byRiskLevel?: Record<string, number>; byType?: Record<string, number> }>(
          '/api/summary'
        );
        return {
          totalWatersheds: s.totalWatersheds ?? 1,
          totalInterventions: s.totalInterventions ?? 0,
          highImpact: s.highImpact ?? 0,
          moderateImpact: s.moderateImpact ?? 0,
          atRisk: s.atRisk ?? 0,
          needsReview: s.needsReview ?? 0,
          avgImpactScore: typeof s.avgImpactScore === 'number' ? s.avgImpactScore : 0,
        };
      } catch (e) {
        console.warn('[interventionService] /api/summary failed');
      }
    }
    const data = CACHED_INTERVENTIONS;
    const avg = data.reduce((a: number, b: Intervention) => a + b.impactScore, 0) / (data.length || 1);
    return {
      totalWatersheds: 1,
      totalInterventions: data.length,
      highImpact: data.filter((i: Intervention) => i.impactScore >= 75).length,
      moderateImpact: data.filter((i: Intervention) => i.impactScore >= 50 && i.impactScore < 75).length,
      atRisk: data.filter((i: Intervention) => i.impactScore < 35).length,
      needsReview: data.filter((i: Intervention) => i.impactScore >= 35 && i.impactScore < 50).length,
      avgImpactScore: Math.round(avg),
    };
  },

  async getBaselineMorphology(): Promise<MorphologicalParams> {
    return makeMorphological(7777777, true);
  },

  // TODO: Connect to YOLO / Vision Transformer inference API
  async analyzeImage(interventionId: string): Promise<AiAnalysisResult> {
    const r = mulberry32(interventionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
    const i = CACHED_INTERVENTIONS.find((x) => x.id === interventionId);
    return {
      detectedObject: i?.type ?? 'Check Dam',
      condition: i?.condition ?? 'Good',
      waterPresence: i?.waterPresent ? 'Water Detected' : 'Dry',
      confidence: +(0.85 + r() * 0.12).toFixed(2),
      isDemo: true,
    };
  },

  // TODO: Connect satellite metrics to Sentinel-2 / SRISHTI-DRISHTI pipeline
  async getSatelliteMetrics(id: string): Promise<SatelliteMetrics | null> {
    const i = CACHED_INTERVENTIONS.find((x) => x.id === id);
    if (!i) return null;
    return {
      ndvi: { before: i.ndviBefore, after: i.ndviAfter, change: +(i.ndviAfter - i.ndviBefore).toFixed(3) },
      ndwi: { before: i.ndwiBefore, after: i.ndwiAfter, change: +(i.ndwiAfter - i.ndwiBefore).toFixed(3) },
      waterArea: { before: i.waterAreaBefore, after: i.waterAreaAfter, change: +(i.waterAreaAfter - i.waterAreaBefore).toFixed(2) },
      rainfallChange: i.rainfallChange,
    };
  },

  async getImpactBreakdown(id: string): Promise<ImpactBreakdown | null> {
    if (USE_API) {
      try {
        return await apiJson<ImpactBreakdown>(`/api/interventions/${id}/impact`);
      } catch (e) {
        console.warn('[interventionService] /impact failed, falling back to local');
      }
    }
    const i = CACHED_INTERVENTIONS.find((x) => x.id === id);
    if (!i) return null;
    const r = mulberry32(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 5);
    const veg = 60 + r() * 35;
    const water = 55 + r() * 40;
    const land = 50 + r() * 40;
    const struc = 62 + r() * 35;
    const hydro = 58 + r() * 38;
    const score = +((veg + water + land + struc + hydro) / 5).toFixed(0);
    const label: ImpactBreakdown['label'] =
      score >= 75 ? 'High Impact' : score >= 50 ? 'Moderate Impact' : score >= 35 ? 'Needs Review' : 'At Risk';
    return {
      score,
      vegetation: +veg.toFixed(1),
      water: +water.toFixed(1),
      landCover: +land.toFixed(1),
      structure: +struc.toFixed(1),
      hydrological: +hydro.toFixed(1),
      rainfallAdjusted: +(score + i.rainfallChange * 1.2).toFixed(1),
      label,
    };
  },

  async getRecommendation(intervention: Intervention): Promise<string> {
    return intervention.recommendation;
  },

  async seedDemoData(): Promise<{ seeded?: number; ids?: string[]; existing?: number } | null> {
    if (USE_API) {
      try {
        return await apiJson('/api/interventions/seed', { method: 'POST' });
      } catch (e) {
        console.warn('[interventionService] seed failed:', e);
      }
    }
    return null;
  },
};

export const kasariRunoffBaseline: RunoffParameters = KASARI_SCS_RUNOFF;
export const kasariStreamOrderTable: StreamOrderRow[] = KASARI_STREAM_ORDER_TABLE;
export const KASARI_VILLAGES = VILLAGES;

// TODO: Replace sample watershed GeoJSON with PostGIS / GeoServer WFS data
export const spatialService = {
  async getWatershedBoundary(): Promise<GeoJSONCollection> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(watershedData as GeoJSONCollection), 200);
    });
  },

  // TODO: Integrate DEM-derived slope / flow accumulation layers
  async getDrainageNetwork(): Promise<GeoJSONCollection> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(drainageData as GeoJSONCollection), 200);
    });
  },

  async getNDVIGrid() {
    return {
      type: 'Grid',
      resolution: '10m (Sentinel-2 equivalent)',
      description: 'NDVI grid values',
    };
  },
};
