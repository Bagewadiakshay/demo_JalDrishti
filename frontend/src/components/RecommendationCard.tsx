import type { Intervention } from '../types';
import { evaluateIntervention, generateRecommendation } from '../utils/recommendationEngine';

interface Props {
  intervention: Intervention;
  recommendation?: string;
}

const severityIcon: Record<string, string> = {
  success: '✓',
  warning: '⚠',
  danger: '✕',
};

const severityClass: Record<string, string> = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  danger: 'text-red-700 bg-red-50 border-red-200',
};

const ringClass: Record<string, string> = {
  success: 'from-emerald-50 to-white border-emerald-200',
  warning: 'from-amber-50 to-white border-amber-200',
  danger: 'from-red-50 to-white border-red-200',
};

export default function RecommendationCard({ intervention, recommendation }: Props) {
  const checks = evaluateIntervention(intervention);
  const finalRec = recommendation || generateRecommendation(intervention);
  const dangerCount = checks.filter((c) => c.severity === 'danger').length;
  const failCount = checks.filter((c) => !c.pass).length;

  const tone = dangerCount >= 2 ? 'danger' : failCount >= 2 ? 'warning' : 'success';
  const toneClass = ringClass[tone];

  return (
    <div className={`bg-gradient-to-br ${toneClass} border rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm font-bold text-lg">
          AI
        </div>
        <div>
          <div className="font-bold text-slate-900">AI + GIS Recommendation</div>
          <div className="text-xs text-slate-500">
            Rule-based prototype engine (future: ML model / LLM)
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        {checks.map((c, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-sm ${severityClass[c.severity]}`}
          >
            <span className="font-bold flex-shrink-0 mt-0.5">{severityIcon[c.severity]}</span>
            <span className="font-medium">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
          Recommendation
        </div>
        <p className="text-slate-800 font-medium leading-relaxed text-sm">{finalRec}</p>
      </div>
    </div>
  );
}
