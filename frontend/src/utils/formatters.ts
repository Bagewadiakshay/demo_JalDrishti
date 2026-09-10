import type { Intervention } from '../types';

export function getStatusLabel(score: number): string {
  if (score >= 75) return 'High Impact';
  if (score >= 50) return 'Moderate Impact';
  if (score >= 35) return 'Needs Review';
  return 'At Risk';
}

export function statusBadgeClass(score: number): string {
  if (score >= 75) return 'bg-green-100 text-green-800 border-green-200';
  if (score >= 50) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (score >= 35) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export function conditionBadgeClass(condition: Intervention['condition']): string {
  switch (condition) {
    case 'Excellent': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Good': return 'bg-green-100 text-green-800 border-green-200';
    case 'Moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Poor': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function formatNumber(n: number, decimals = 2): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 'N/A';
  return n.toFixed(decimals);
}
