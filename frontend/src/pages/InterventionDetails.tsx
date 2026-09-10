import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { interventionService } from '../services/interventionService';
import { calculateImpactScore } from '../utils/impactScore';
import {
  conditionBadgeClass,
  statusBadgeClass,
  getStatusLabel,
  formatNumber,
} from '../utils/formatters';
import type { Intervention, AiAnalysisResult, SatelliteMetrics, ImpactBreakdown } from '../types';
import ImpactScoreGauge from '../components/ImpactScoreGauge';
import RecommendationCard from '../components/RecommendationCard';
import {
  BeforeAfterBarChart,
  NDVITimeSeriesChart,
  BeforeAfterCompare,
} from '../components/SatelliteCharts';

export default function InterventionDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [metrics, setMetrics] = useState<SatelliteMetrics | null>(null);
  const [impact, setImpact] = useState<ImpactBreakdown | null>(null);
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const int = await interventionService.getInterventionById(id);
      if (!int) {
        setError('Intervention not found.');
        setLoading(false);
        return;
      }
      const [m] = await Promise.all([
        interventionService.getSatelliteMetrics(id),
      ]);
      setIntervention(int);
      setMetrics(m);
      setImpact(calculateImpactScore(int));
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleAnalyze() {
    if (!intervention) return;
    setAiLoading(true);
    setAiResult(null);
    const res = await interventionService.analyzeImage(intervention.id);
    setAiResult(res);
    setAiLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-600">
        Loading intervention data…
      </div>
    );
  }

  if (error || !intervention || !metrics || !impact) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {error || 'Intervention not found'}
          </h1>
          <p className="text-slate-600 mb-6">
            The intervention ID <code className="bg-slate-100 px-2 py-0.5 rounded">{id}</code> could not be loaded.
          </p>
          <Link
            to="/map"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            ← Back to Watershed Map
          </Link>
        </div>
      </div>
    );
  }

  const typeColor: Record<string, string> = {
    'Check Dam': 'from-sky-500 to-blue-600',
    'Farm Pond': 'from-teal-500 to-emerald-600',
    'Plantation': 'from-emerald-500 to-green-600',
    'Contour Trench': 'from-purple-500 to-violet-600',
  };

  const headerGradient = typeColor[intervention.type] || 'from-slate-600 to-slate-800';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <nav className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
        <Link to="/" className="hover:text-blue-700">Dashboard</Link>
        <span>/</span>
        <Link to="/map" className="hover:text-blue-700">Watershed Map</Link>
        <span>/</span>
        <span className="font-medium text-slate-700">{intervention.id}</span>
      </nav>

      <header className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${headerGradient} text-white shadow-lg`}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0, transparent 45%)' }} />
        <div className="relative px-6 sm:px-8 py-7 sm:py-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-medium mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                {intervention.type} · Watershed – Maharashtra
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {intervention.type.toUpperCase()} {intervention.id}
              </h1>
              <p className="mt-1 text-blue-100 text-sm sm:text-base">
                {intervention.village || 'Village N/A'} · Constructed {intervention.constructionYear}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${conditionBadgeClass(intervention.condition).replace('border-', 'bg-white/10 text-white border-white/30 ')} bg-white/10 text-white border border-white/30`}>
                Condition: {intervention.condition}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/30">
                {getStatusLabel(intervention.impactScore)} · {intervention.impactScore}/100
              </span>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/5 border border-white/15 rounded-xl p-3">
              <div className="text-white/70 text-xs uppercase tracking-wide">Type</div>
              <div className="font-bold mt-1">{intervention.type}</div>
            </div>
            <div className="bg-white/5 border border-white/15 rounded-xl p-3">
              <div className="text-white/70 text-xs uppercase tracking-wide">Location</div>
              <div className="font-mono mt-1 text-sm">{intervention.latitude.toFixed(4)}, {intervention.longitude.toFixed(4)}</div>
            </div>
            <div className="bg-white/5 border border-white/15 rounded-xl p-3">
              <div className="text-white/70 text-xs uppercase tracking-wide">AI Confidence</div>
              <div className="font-bold mt-1">{intervention.confidence}%</div>
            </div>
            <div className="bg-white/5 border border-white/15 rounded-xl p-3">
              <div className="text-white/70 text-xs uppercase tracking-wide">Water Present</div>
              <div className="font-bold mt-1">{intervention.waterPresent ? 'Yes' : 'No'}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/map')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 text-white text-sm font-medium"
            >
              ← Return to Map
            </button>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 text-white text-sm font-medium"
            >
              📈 View Analytics
            </Link>
          </div>
        </div>
      </header>

      <section className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-slate-900">Geo-tagged Field Image</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Captured during field survey
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                Prototype Inference Ready
              </span>
            </div>

            <div className="p-5 grid md:grid-cols-2 gap-5">
              <div>
                <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 border border-slate-200 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  {intervention.photo ? (
                    <img src={intervention.photo} alt="Field" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <div className="absolute inset-0 opacity-30"
                        style={{
                          backgroundImage: `
                            linear-gradient(135deg, rgba(14,165,233,0.1), rgba(34,197,94,0.1)),
                            repeating-linear-gradient(0deg, #cbd5e1 0 1px, transparent 1px 14px),
                            repeating-linear-gradient(90deg, #cbd5e1 0 1px, transparent 1px 14px)
                          `,
                        }}
                      />
                      <div className="relative">
                        <div className="text-6xl mb-2 opacity-60">
                          {intervention.type === 'Check Dam' ? '🌊' :
                           intervention.type === 'Farm Pond' ? '💧' :
                           intervention.type === 'Plantation' ? '🌳' : '⛏️'}
                        </div>
                        <div className="text-sm font-semibold text-slate-600">
                          Field image unavailable
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Placeholder
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="text-slate-500">Latitude</div>
                    <div className="font-mono font-bold text-slate-800">{intervention.latitude.toFixed(5)}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="text-slate-500">Longitude</div>
                    <div className="font-mono font-bold text-slate-800">{intervention.longitude.toFixed(5)}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="text-slate-500">Capture Date</div>
                    <div className="font-bold text-slate-800">{intervention.captureDate}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="text-slate-500">Intervention Type</div>
                    <div className="font-bold text-slate-800">{intervention.type}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={aiLoading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                  >
                    {aiLoading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Running AI Analysis…
                      </>
                    ) : (
                      <>
                        🤖 Run AI Analysis
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-500 mt-2 text-center">
                    Prototype inference
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">AI</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800">AI Image Analysis</div>
                      <div className="text-[11px] text-slate-500">
                        {aiResult ? 'Completed' : 'Waiting to run…'}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 min-h-[180px]">
                    {!aiResult && !aiLoading && (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-sm py-6">
                        <div className="text-4xl mb-2">👆</div>
                        Click "Run AI Analysis" to view results.
                      </div>
                    )}
                    {aiLoading && (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-sm py-8 space-y-3">
                        <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                        <div>
                          <div className="font-semibold text-slate-700">Running prototype inference…</div>
                          <div className="text-xs text-slate-500 mt-1">
                            // TODO: Replace with YOLO / ViT inference API
                          </div>
                        </div>
                      </div>
                    )}
                    {aiResult && (
                      <>
                        {(['detectedObject', 'condition', 'waterPresence', 'confidence'] as const).map((k) => {
                          const labels: Record<string, string> = {
                            detectedObject: 'Detected Object',
                            condition: 'Condition',
                            waterPresence: 'Water Presence',
                            confidence: 'Confidence',
                          };
                          const values: Record<string, any> = {
                            detectedObject: aiResult.detectedObject,
                            condition: aiResult.condition,
                            waterPresence: aiResult.waterPresence,
                            confidence: `${aiResult.confidence}%`,
                          };
                          return (
                            <div key={k} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                              <span className="text-xs text-slate-500">{labels[k]}</span>
                              <span className="text-sm font-bold text-slate-900">{values[k]}</span>
                            </div>
                          );
                        })}
                        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                          <span className="font-semibold">⚠ Prototype inference:</span> Replace with real YOLO / Vision Transformer API when available.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Satellite-Based Environmental Response</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Before vs After intervention · satellite metrics
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                // TODO: Connect Sentinel-2 / SRISHTI-DRISHTI
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
              {[
                { label: 'NDVI', before: metrics.ndvi.before, after: metrics.ndvi.after, change: metrics.ndvi.change, accent: 'text-emerald-600' },
                { label: 'NDWI', before: metrics.ndwi.before, after: metrics.ndwi.after, change: metrics.ndwi.change, accent: 'text-sky-600' },
                { label: 'Water Area (ha)', before: metrics.waterArea.before, after: metrics.waterArea.after, change: metrics.waterArea.change, accent: 'text-blue-600', suffix: ' ha' },
              ].map((m) => (
                <div key={m.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">{m.label}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xs text-slate-500">{formatNumber(m.before)}</span>
                    <span className="text-slate-400">→</span>
                    <span className={`font-extrabold ${m.accent}`}>{formatNumber(m.after)}{m.suffix || ''}</span>
                  </div>
                  <div className={`mt-1 text-xs font-bold ${m.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.change >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(m.change))}{m.suffix || ''} change
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">Before / After Comparison</h3>
                <BeforeAfterBarChart metrics={metrics} />
              </div>
              <BeforeAfterCompare intervention={intervention} />
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">
                  NDVI Time-Series (2021–2025)
                </h3>
                <NDVITimeSeriesChart data={intervention.ndviTimeSeries} label="NDVI" />
                <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  // TODO: Connect yearly time-series to actual Sentinel / Landsat composites from PostGIS data cube.
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-6 rounded-full bg-gradient-to-b from-blue-500 to-emerald-500" />
              Prototype Impact Score
            </h2>
            <ImpactScoreGauge breakdown={impact} />
          </div>

          <RecommendationCard intervention={intervention} />

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-slate-900 mb-3 text-sm">Field Notes</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {intervention.notes || 'No additional field notes provided for this intervention.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-slate-500">Village</div>
                <div className="font-semibold text-slate-800">{intervention.village || '—'}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-slate-500">Year Built</div>
                <div className="font-semibold text-slate-800">{intervention.constructionYear}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-slate-500">Rainfall Δ</div>
                <div className={`font-semibold ${intervention.rainfallChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {intervention.rainfallChange >= 0 ? '+' : ''}{intervention.rainfallChange}%
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-slate-500">Risk Level</div>
                <div className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusBadgeClass(intervention.impactScore)}`}>
                  {getStatusLabel(intervention.impactScore)}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
