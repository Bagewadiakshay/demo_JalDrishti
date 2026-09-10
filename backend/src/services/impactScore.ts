import type { Intervention, ImpactBreakdown } from '../types';

const VEG_WEIGHT = 0.30;
const WATER_WEIGHT = 0.25;
const LAND_WEIGHT = 0.15;
const STRUCTURE_WEIGHT = 0.15;
const HYDRO_WEIGHT = 0.10;
const RAIN_WEIGHT = 0.05;

function normalizeChange(before: number, after: number, maxRange = 1): number {
  const delta = after - before;
  const norm = Math.max(-1, Math.min(1, delta / maxRange));
  const score = 50 + norm * 50;
  return Math.max(0, Math.min(100, score));
}

function conditionScore(condition: Intervention['condition']): number {
  switch (condition) {
    case 'Excellent': return 95;
    case 'Good': return 80;
    case 'Moderate': return 55;
    case 'Poor': return 30;
    default: return 50;
  }
}

function hydroRelevance(int: Intervention): number {
  const waterTypes = ['Check Dam', 'Farm Pond'];
  if (!waterTypes.includes(int.type)) return 65;
  if (int.waterAreaAfter > 3) return 92;
  if (int.waterAreaAfter > 1.5) return 75;
  if (int.waterPresent) return 55;
  return 35;
}

function rainfallAdjusted(int: Intervention): number {
  const r = int.rainfallChange;
  if (r >= 15) return 90;
  if (r >= 8) return 78;
  if (r >= 2) return 62;
  if (r >= -4) return 48;
  return 30;
}

export function calculateImpactScore(intervention: Intervention): ImpactBreakdown {
  const vegetation = normalizeChange(intervention.ndviBefore, intervention.ndviAfter, 0.5);
  const water = normalizeChange(intervention.ndwiBefore, intervention.ndwiAfter, 0.3) * 0.5 +
    normalizeChange(intervention.waterAreaBefore, intervention.waterAreaAfter, 5) * 0.5;
  const landCover = (vegetation + water) / 2;
  const structure = conditionScore(intervention.condition);
  const hydrological = hydroRelevance(intervention);
  const rainfallAdjustedScore = rainfallAdjusted(intervention);

  const score =
    vegetation * VEG_WEIGHT +
    water * WATER_WEIGHT +
    landCover * LAND_WEIGHT +
    structure * STRUCTURE_WEIGHT +
    hydrological * HYDRO_WEIGHT +
    rainfallAdjustedScore * RAIN_WEIGHT;

  const finalScore = Math.round(Math.max(0, Math.min(100, score)));

  let label = 'Moderate Impact';
  if (finalScore >= 75) label = 'High Impact';
  else if (finalScore >= 50) label = 'Moderate Impact';
  else if (finalScore >= 35) label = 'Needs Review';
  else label = 'At Risk';

  return {
    score: finalScore,
    vegetation: Math.round(vegetation),
    water: Math.round(water),
    landCover: Math.round(landCover),
    structure: Math.round(structure),
    hydrological: Math.round(hydrological),
    rainfallAdjusted: Math.round(rainfallAdjustedScore),
    label,
  };
}

export function riskLabel(score: number): 'High Impact' | 'Moderate Impact' | 'At Risk' | 'Needs Review' {
  if (score >= 75) return 'High Impact';
  if (score >= 50) return 'Moderate Impact';
  if (score >= 35) return 'Needs Review';
  return 'At Risk';
}

export function riskColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}
