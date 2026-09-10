import { z } from 'zod';

const ndviRange = z.number().min(-1).max(1);
const ndwiRange = z.number().min(-1).max(1);

const positiveNumber = z.number().min(0);
const anyNumber = z.number();

const landUseSchema = z.object({
  agriculture: positiveNumber,
  forest: positiveNumber,
  wasteland: positiveNumber,
  waterBody: positiveNumber,
  builtUp: positiveNumber,
});

const morphologicalParamsSchema = z.object({
  elevation: anyNumber,
  slope: anyNumber,
  aspect: z.string().min(1),
  drainageDensity: anyNumber,
  streamOrder: z.number().int().min(0),
  watershedArea: anyNumber,
  basinLength: anyNumber,
  basinWidth: anyNumber,
  circularityRatio: anyNumber,
  elongationRatio: anyNumber,
  formFactor: anyNumber,
  ruggednessNumber: anyNumber,
  reliefRatio: anyNumber,
  totalRelief: anyNumber,
  meanSlope: anyNumber,
  textureRatio: anyNumber,
  landUse: landUseSchema,
  soilType: z.string().min(1),
  soilDepth: anyNumber,
  infiltrationRate: anyNumber,
});

const streamFlowSchema = z.object({
  min: anyNumber,
  max: anyNumber,
  mean: anyNumber,
});

const hydrologicalParamsSchema = z.object({
  annualRainfall: anyNumber,
  monsoonRainfall: anyNumber,
  runoffCoefficient: anyNumber,
  annualRunoff: anyNumber,
  peakDischarge: anyNumber,
  baseFlow: anyNumber,
  groundwaterLevel: anyNumber,
  groundwaterRecharge: anyNumber,
  evapotranspiration: anyNumber,
  soilMoisture: anyNumber,
  waterYield: anyNumber,
  sedimentYield: anyNumber,
  floodFrequency: anyNumber,
  droughtIndex: anyNumber,
  streamFlow: streamFlowSchema,
  reservoirCapacity: anyNumber,
  storageEfficiency: anyNumber,
  infiltrationLoss: anyNumber,
  surfaceRunoff: anyNumber,
  subSurfaceFlow: anyNumber,
});

const ndviTimeSeriesPointSchema = z.object({
  year: z.number().int(),
  value: anyNumber,
});

const interventionBaseSchema = z.object({
  type: z.enum(['Check Dam', 'Farm Pond', 'Plantation', 'Contour Trench']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  village: z.string().min(1),
  constructionYear: z.number().int().min(1900).max(2100),
  condition: z.enum(['Excellent', 'Good', 'Moderate', 'Poor']),
  confidence: z.number().min(0).max(100),
  photo: z.string().nullable().optional(),
  captureDate: z.string().min(1),
  waterPresent: z.boolean(),
  ndviBefore: ndviRange,
  ndviAfter: ndviRange,
  ndwiBefore: ndwiRange,
  ndwiAfter: ndwiRange,
  waterAreaBefore: positiveNumber,
  waterAreaAfter: positiveNumber,
  rainfallChange: anyNumber,
  ndviTimeSeries: z.array(ndviTimeSeriesPointSchema),
  morphological: morphologicalParamsSchema,
  hydrological: hydrologicalParamsSchema,
  notes: z.string().optional(),
});

export const createInterventionSchema = interventionBaseSchema.extend({
  id: z.string().min(1).optional(),
});

export const updateInterventionSchema = interventionBaseSchema.partial().extend({
  id: z.string().min(1).optional(),
});

export type CreateInterventionInput = z.infer<typeof createInterventionSchema>;
export type UpdateInterventionInput = z.infer<typeof updateInterventionSchema>;
