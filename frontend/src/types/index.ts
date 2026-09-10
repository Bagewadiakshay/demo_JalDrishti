export interface StreamOrderRow {
  order: number;
  streamNumber: number;
  streamLengthKm: number;
  meanStreamLength: number;
  streamLengthRatio?: number;
  bifurcationRatio?: number;
}

export interface LandUse {
  agriculture: number;
  forest: number;
  wasteland: number;
  waterBody: number;
  builtUp: number;
}

export interface NDVITimeSeriesPoint {
  year: number;
  value: number;
}

export interface LinearParameters {
  streamOrderTable: StreamOrderRow[];
  totalStreamNumber: number;
  totalStreamLength: number;
  meanBifurcationRatio: number;
}

export interface ArealParameters {
  basinAreaKm2: number;
  basinPerimeterKm: number;
  basinLengthKm: number;
  drainageDensity: number;
  streamFrequency: number;
  drainageTexture: number;
  // TODO: confirm with source paper whether Texture Ratio / Gradient Ratio are meant
  // to be distinct from Drainage Texture / Relief Ratio — in the source Kasari
  // spreadsheet both pairs share the same formula (T = Dt = Nu/P, GR = Rr = Bh/Lb).
  textureRatio: number;
  formFactor: number;
  circularityRatio: number;
  elongationRatio: number;
  compactnessCoefficient: number;
  constantChannelMaintenance: number;
  infiltrationNumber: number;
  drainageIntensity: number;
  lemniscateRatio: number;
  meanStreamLengthBasin: number;
  timeOfConcentrationHrs: number;
}

export interface TerrainParameters {
  maximumElevationM: number;
  minimumElevationM: number;
  meanElevationM: number;
  meanBasinSlope: number;
  aspect?: string | number;
  hypsometricIntegral: number;
}

export interface ReliefParameters {
  basinReliefM: number;
  reliefRatio: number;
  relativeRelief: number;
  ruggednessNumber: number;
  dissectionIndex: number;
  meltonRuggednessNumber: number;
  // TODO: confirm with source paper whether Texture Ratio / Gradient Ratio are meant
  // to be distinct from Drainage Texture / Relief Ratio — in the source Kasari
  // spreadsheet both pairs share the same formula (T = Dt = Nu/P, GR = Rr = Bh/Lb).
  gradientRatio: number;
  channelGradient: number;
  lengthOfOverlandFlow: number;
}

export interface MorphologicalParams {
  linear: LinearParameters;
  areal: ArealParameters;
  terrain: TerrainParameters;
  relief: ReliefParameters;
  landUse: LandUse;
  soilType: string;
  soilDepth: number;
  infiltrationRate: number;
}

export interface RunoffParameters {
  curveNumber: number;
  potentialMaxRetentionMm: number;
  initialAbstractionMm: number;
  rainfallDepthMm: number;
  effectiveRainfallMm: number;
  directRunoffMm: number;
  runoffCoefficient: number;
  imperviousAreaPct: number;
  baseflowCumecs: number;
  timeOfConcentrationHrs: number;
}

export type DetectionClass =
  | 'check_dam'
  | 'farm_pond'
  | 'plantation'
  | 'vegetation'
  | 'water_body'
  | 'unclassified';

export interface FieldObservation {
  id: string;
  image_filename: string;
  latitude: number;
  longitude: number;
  captured_at: string | null;
  detected_class: DetectionClass;
  confidence: number;
  geojson_feature: Record<string, unknown>;
  intervention_id: string | null;
  uploaded_at: string;
}

export interface HydrologicalParams {
  annualRainfall: number;
  monsoonRainfall: number;
  runoffCoefficient: number;
  annualRunoff: number;
  peakDischarge: number;
  baseFlow: number;
  groundwaterLevel: number;
  groundwaterRecharge: number;
  evapotranspiration: number;
  soilMoisture: number;
  waterYield: number;
  sedimentYield: number;
  floodFrequency: number;
  droughtIndex: number;
  streamFlow: {
    min: number;
    max: number;
    mean: number;
  };
  reservoirCapacity: number;
  storageEfficiency: number;
  infiltrationLoss: number;
  surfaceRunoff: number;
  subSurfaceFlow: number;
  runoff?: RunoffParameters;
}

export interface Intervention {
  id: string;
  type: 'Check Dam' | 'Farm Pond' | 'Plantation' | 'Contour Trench';
  latitude: number;
  longitude: number;
  village: string;
  constructionYear: number;
  condition: 'Excellent' | 'Good' | 'Moderate' | 'Poor';
  confidence: number;
  photo: string | null;
  captureDate: string;
  waterPresent: boolean;
  ndviBefore: number;
  ndviAfter: number;
  ndwiBefore: number;
  ndwiAfter: number;
  waterAreaBefore: number;
  waterAreaAfter: number;
  rainfallChange: number;
  impactScore: number;
  riskLevel: 'High Impact' | 'Moderate Impact' | 'At Risk' | 'Needs Review';
  recommendation: string;
  ndviTimeSeries: NDVITimeSeriesPoint[];
  morphological: MorphologicalParams;
  hydrological: HydrologicalParams;
  notes?: string;
}

export interface AiAnalysisResult {
  detectedObject: string;
  condition: string;
  waterPresence: string;
  confidence: number;
  isDemo: boolean;
}

export interface SatelliteMetrics {
  ndvi: { before: number; after: number; change: number };
  ndwi: { before: number; after: number; change: number };
  waterArea: { before: number; after: number; change: number };
  rainfallChange: number;
}

export interface ImpactBreakdown {
  score: number;
  vegetation: number;
  water: number;
  landCover: number;
  structure: number;
  hydrological: number;
  rainfallAdjusted: number;
  label: string;
}

export interface SummaryStats {
  totalWatersheds: number;
  totalInterventions: number;
  highImpact: number;
  moderateImpact: number;
  atRisk: number;
  needsReview: number;
  avgImpactScore: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}
