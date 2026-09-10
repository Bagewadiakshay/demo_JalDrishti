export interface MorphologicalParams {
  elevation: number;
  slope: number;
  aspect: string;
  drainageDensity: number;
  streamOrder: number;
  watershedArea: number;
  basinLength: number;
  basinWidth: number;
  circularityRatio: number;
  elongationRatio: number;
  formFactor: number;
  ruggednessNumber: number;
  reliefRatio: number;
  totalRelief: number;
  meanSlope: number;
  textureRatio: number;
  landUse: {
    agriculture: number;
    forest: number;
    wasteland: number;
    waterBody: number;
    builtUp: number;
  };
  soilType: string;
  soilDepth: number;
  infiltrationRate: number;
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
}

export type InterventionType = 'Check Dam' | 'Farm Pond' | 'Plantation' | 'Contour Trench';
export type InterventionCondition = 'Excellent' | 'Good' | 'Moderate' | 'Poor';
export type RiskLevel = 'High Impact' | 'Moderate Impact' | 'At Risk' | 'Needs Review';

export interface NDVITimeSeriesPoint {
  year: number;
  value: number;
}

export interface Intervention {
  id: string;
  type: InterventionType;
  latitude: number;
  longitude: number;
  village: string;
  constructionYear: number;
  condition: InterventionCondition;
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
  riskLevel: RiskLevel;
  recommendation: string;
  ndviTimeSeries: NDVITimeSeriesPoint[];
  morphological: MorphologicalParams;
  hydrological: HydrologicalParams;
  notes?: string;
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
