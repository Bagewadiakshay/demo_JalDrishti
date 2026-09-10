import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { interventionService } from '../services/interventionService';
import type { SummaryStats } from '../types';
import GeoImageUploadPanel from '../components/GeoImageUploadPanel';

const workflowSteps = [
  { n: '01', title: 'Field Image', desc: 'Geo-tagged field photo' },
  { n: '02', title: 'AI Interpretation', desc: 'Structure + condition' },
  { n: '03', title: 'GIS Integration', desc: 'Location + watershed' },
  { n: '04', title: 'Satellite Analysis', desc: 'NDVI · NDWI · Time-series' },
  { n: '05', title: 'Impact Assessment', desc: 'Multi-indicator score' },
  { n: '06', title: 'Recommendation', desc: 'Decision support' },
];

const statCards = [
  { key: 'totalInterventions', label: 'Interventions', accent: 'text-slate-900' },
  { key: 'highImpact', label: 'High Impact', accent: 'text-emerald-600' },
  { key: 'moderateImpact', label: 'Moderate', accent: 'text-amber-600' },
  { key: 'atRisk', label: 'At Risk', accent: 'text-red-600' },
  { key: 'avgImpactScore', label: 'Avg Score', accent: 'text-blue-700', suffix: '/100' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<SummaryStats>({
    totalWatersheds: 1,
    totalInterventions: 0,
    highImpact: 0,
    moderateImpact: 0,
    atRisk: 0,
    needsReview: 0,
    avgImpactScore: 0,
  });
  const [typeCounts, setTypeCounts] = useState({
    checkDams: 0,
    farmPonds: 0,
    plantations: 0,
    contourTrenches: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const fromApi = await interventionService.getSummaryStats();
      setStats(fromApi);
      const data = await interventionService.getInterventions();
      setTypeCounts({
        checkDams: data.filter((i) => i.type === 'Check Dam').length,
        farmPonds: data.filter((i) => i.type === 'Farm Pond').length,
        plantations: data.filter((i) => i.type === 'Plantation').length,
        contourTrenches: data.filter((i) => i.type === 'Contour Trench').length,
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-14">
      <header className="space-y-2">
        <div className="text-xs font-medium tracking-widest uppercase text-slate-400">
          Watershed Platform
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Impact Intelligence
        </h1>
        <p className="text-base text-slate-500 max-w-xl">
          AI · GIS · Remote sensing based monitoring and intervention assessment.
        </p>
        <div className="flex items-center gap-3 pt-4">
          <Link
            to="/map"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Explore Map
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            View Analytics
          </Link>
        </div>
      </header>

      <GeoImageUploadPanel />

      <section>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
          {statCards.map((s) => (
            <div key={s.key} className="bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {s.label}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-3xl font-semibold ${s.accent}`}>
                  {loading ? '—' : (stats as unknown as Record<string, number>)[s.key]}
                </span>
                {s.suffix && (
                  <span className="text-sm text-slate-300">{s.suffix}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pipeline</h2>
            <p className="text-sm text-slate-500 mt-0.5">End-to-end interpretation workflow</p>
          </div>
          <span className="text-xs text-slate-400">6 steps</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
          {workflowSteps.map((step) => (
            <div key={step.n} className="bg-white p-5 space-y-2">
              <div className="text-xs font-mono text-slate-300">{step.n}</div>
              <div className="text-sm font-semibold text-slate-900">{step.title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Watershed</h2>
                <p className="text-sm text-slate-500 mt-0.5">Kasari River Basin – Kolhapur, Maharashtra</p>
              </div>
            <Link to="/map" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              Open →
            </Link>
          </div>
          <div className="flex items-center gap-4 py-3 border-y border-slate-100">
            <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-xl">
              🌏
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900 text-sm">Wadegaon · Pabal · Kanhersar · Kasari · Kivale · Bhajgaon · Nandivali · Rajapur · Gajapur · Shahapur · Padali · Karvir</div>
              <div className="text-xs text-slate-500 mt-0.5">Area: ~62,769 ha (627.69 km²)</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { k: 'Check Dams', v: typeCounts.checkDams },
              { k: 'Farm Ponds', v: typeCounts.farmPonds },
              { k: 'Plantations + Trenches', v: typeCounts.plantations + typeCounts.contourTrenches },
            ].map((item) => (
              <div key={item.k}>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">
                  {item.k}
                </div>
                <div className="text-xl font-semibold text-slate-900 mt-1">{loading ? '—' : item.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-slate-900">Attention</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">{stats.atRisk} interventions</span> are flagged "At Risk" with declining indices.
          </p>
          {stats.atRisk > 0 && (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-slate-500 italic">Open the map to view at-risk locations.</p>
            </div>
          )}
          <Link to="/map" className="block text-sm font-medium text-slate-700 hover:text-slate-900 pt-1">
            Inspect on map →
          </Link>
        </div>
      </section>
    </div>
  );
}
