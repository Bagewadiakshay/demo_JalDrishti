import type { ImpactBreakdown } from '../types';
import { riskColor } from '../utils/impactScore';

interface Props {
  breakdown: ImpactBreakdown;
}

const subScores: { key: keyof Omit<ImpactBreakdown, 'score' | 'label'>; label: string; weight: number }[] = [
  { key: 'vegetation', label: 'Vegetation Improvement', weight: 30 },
  { key: 'water', label: 'Water Improvement', weight: 25 },
  { key: 'landCover', label: 'Land-cover / Env. Improvement', weight: 15 },
  { key: 'structure', label: 'Structure Condition', weight: 15 },
  { key: 'hydrological', label: 'Hydrological Relevance', weight: 10 },
  { key: 'rainfallAdjusted', label: 'Rainfall-adjusted Response', weight: 5 },
];

export default function ImpactScoreGauge({ breakdown }: Props) {
  const score = breakdown.score;
  const color = riskColor(score);
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0">
          <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="14"
            />
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ position: 'relative', marginTop: -220 }}>
            <div className="text-5xl font-black text-slate-900" style={{ lineHeight: 1 }}>{score}</div>
            <div className="text-sm text-slate-500 font-medium mt-1">/ 100</div>
            <div
              className="mt-2 px-3 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {breakdown.label}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-xs">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1">
            Weighted components
          </div>
          {subScores.map((s) => {
            const val = breakdown[s.key];
            const barColor = riskColor(val);
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">{s.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono">{s.weight}%</span>
                    <span className="font-bold text-slate-900 w-7 text-right">{val}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${val}%`, backgroundColor: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
        <strong>Prototype Impact Score.</strong> Formula: 30% Veg. + 25% Water + 15% Land + 15% Structure + 10% Hydro + 5% Rainfall.
        Not an official government scoring method.
      </div>
    </div>
  );
}
