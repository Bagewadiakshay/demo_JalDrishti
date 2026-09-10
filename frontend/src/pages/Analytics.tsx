import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { interventionService, kasariRunoffBaseline, kasariStreamOrderTable } from '../services/interventionService';
import {
  conditionBadgeClass,
  statusBadgeClass,
  getStatusLabel,
  formatNumber,
} from '../utils/formatters';
import type {
  Intervention,
  MorphologicalParams,
  LinearParameters,
  ArealParameters,
  TerrainParameters,
  ReliefParameters,
  RunoffParameters,
  FieldObservation,
} from '../types';

const PIE_COLORS = {
  'High Impact': '#22c55e',
  'Moderate Impact': '#f59e0b',
  'Needs Review': '#f97316',
  'At Risk': '#ef4444',
};

const LANDUSE_COLORS = ['#92400e', '#166534', '#57534e', '#0369a1', '#475569'];

const DETECTION_CLASS_COLORS: Record<FieldObservation['detected_class'], string> = {
  check_dam: '#0ea5e9',
  farm_pond: '#14b8a6',
  plantation: '#22c55e',
  vegetation: '#84cc16',
  water_body: '#06b6d4',
  unclassified: '#94a3b8',
};

type MorphoCategory = 'linear' | 'areal' | 'terrain' | 'relief';
type AnalysisTab = 'overview' | 'morphological' | 'hydrological' | 'fieldImagery';

// ============================================================
// Morphological — per-category small components
// ============================================================

function LinearParamsPanel({ data }: { data: LinearParameters }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
        <div className="bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Total Streams (Nu)</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">{data.totalStreamNumber}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Total Length (Lu)</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">{data.totalStreamLength} <span className="text-sm text-slate-400">km</span></div>
        </div>
        <div className="bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Mean Bifurcation (Rbm)</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">{data.meanBifurcationRatio.toFixed(4)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h4 className="text-sm font-semibold text-slate-900">Horton–Strahler Stream Order Table</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Order (U)', 'Stream No. (Nu)', 'Stream Length (Lu, km)', 'Mean Length (Lsm)', 'Length Ratio (Rl)', 'Bifurcation (Rb)'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.streamOrderTable.map((row) => (
                <tr key={row.order} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{row.order}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700">{row.streamNumber}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700">{row.streamLengthKm.toFixed(2)}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700">{row.meanStreamLength.toFixed(4)}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{row.streamLengthRatio != null ? row.streamLengthRatio.toFixed(4) : '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{row.bifurcationRatio != null ? row.bifurcationRatio.toFixed(4) : '—'}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-2.5 text-slate-700">Total</td>
                <td className="px-4 py-2.5 font-mono text-slate-900">{data.totalStreamNumber}</td>
                <td className="px-4 py-2.5 font-mono text-slate-900">{data.totalStreamLength.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-slate-400">—</td>
                <td className="px-4 py-2.5 text-slate-400">—</td>
                <td className="px-4 py-2.5 font-mono text-slate-900">{data.meanBifurcationRatio.toFixed(4)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold text-slate-900">{value}</span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function ArealParamsPanel({ data }: { data: ArealParameters }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      <KV label="Basin Area (A)" value={data.basinAreaKm2.toFixed(3)} unit="km²" />
      <KV label="Basin Perimeter (P)" value={data.basinPerimeterKm.toFixed(3)} unit="km" />
      <KV label="Basin Length (Lb)" value={data.basinLengthKm.toFixed(1)} unit="km" />
      <KV label="Drainage Density (Dd)" value={data.drainageDensity.toFixed(4)} unit="km/km²" />
      <KV label="Stream Frequency (Fs)" value={data.streamFrequency.toFixed(4)} />
      <KV label="Drainage Texture (Dt)" value={data.drainageTexture.toFixed(4)} />
      <KV label="Texture Ratio (T)" value={data.textureRatio.toFixed(4)} />
      <KV label="Form Factor (Rf)" value={data.formFactor.toFixed(4)} />
      <KV label="Circularity Ratio (Rc)" value={data.circularityRatio.toFixed(4)} />
      <KV label="Elongation Ratio (Re)" value={data.elongationRatio.toFixed(4)} />
      <KV label="Compactness Coeff. (Cc)" value={data.compactnessCoefficient.toFixed(4)} />
      <KV label="Constant Channel Maint." value={data.constantChannelMaintenance.toFixed(4)} />
      <KV label="Infiltration Number (If)" value={data.infiltrationNumber.toFixed(4)} />
      <KV label="Drainage Intensity (Di)" value={data.drainageIntensity.toFixed(4)} />
      <KV label="Lemniscate Ratio (K)" value={data.lemniscateRatio.toFixed(4)} />
      <KV label="Mean Stream Length" value={data.meanStreamLengthBasin.toFixed(2)} unit="km" />
      <KV label="Time of Concentration (Tc)" value={data.timeOfConcentrationHrs.toFixed(4)} unit="hrs" />
    </div>
  );
}

function TerrainParamsPanel({ data }: { data: TerrainParameters }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
      <KV label="Maximum Elevation (Hmax)" value={data.maximumElevationM.toFixed(1)} unit="m" />
      <KV label="Minimum Elevation (Hmin)" value={data.minimumElevationM.toFixed(2)} unit="m" />
      <KV label="Mean Elevation" value={data.meanElevationM.toFixed(2)} unit="m" />
      <KV label="Mean Basin Slope" value={data.meanBasinSlope.toFixed(1)} unit="°" />
      <KV label="Aspect" value={data.aspect != null && data.aspect !== '' ? String(data.aspect) : 'TBD'} />
      <KV label="Hypsometric Integral (HI)" value={data.hypsometricIntegral.toFixed(4)} />
    </div>
  );
}

function ReliefParamsPanel({ data }: { data: ReliefParameters }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
      <KV label="Basin Relief (Bh)" value={data.basinReliefM.toFixed(2)} unit="m" />
      <KV label="Relief Ratio (Rr)" value={data.reliefRatio.toFixed(4)} />
      <KV label="Relative Relief (Rh)" value={data.relativeRelief.toFixed(4)} />
      <KV label="Ruggedness Number (Rn)" value={data.ruggednessNumber.toFixed(4)} />
      <KV label="Dissection Index (DI)" value={data.dissectionIndex.toFixed(4)} />
      <KV label="Melton Ruggedness (MRN)" value={data.meltonRuggednessNumber.toFixed(4)} />
      <KV label="Gradient Ratio (GR)" value={data.gradientRatio.toFixed(4)} />
      <KV label="Channel Gradient (CG)" value={data.channelGradient.toFixed(4)} />
      <KV label="Overland Flow Length (Lo)" value={data.lengthOfOverlandFlow.toFixed(4)} unit="km" />
    </div>
  );
}

// ============================================================
// Hydrological — SCS-CN Runoff panel
// ============================================================

function ScsCnPanel({ runoff }: { runoff: RunoffParameters }) {
  const [cn, setCn] = useState(runoff.curveNumber);
  const [p, setP] = useState(runoff.rainfallDepthMm);
  const [ia, setIa] = useState(runoff.initialAbstractionMm);
  const [imp, setImp] = useState(runoff.imperviousAreaPct);

  const s = 25400 / cn - 254;
  const pe = Math.max(0, p - ia);
  const q = pe > 0 ? Math.pow(pe, 2) / (pe + s) : 0;
  const c = p > 0 ? q / p : 0;
  const tc = runoff.timeOfConcentrationHrs;
  const bf = runoff.baseflowCumecs;

  const rows: { param: string; formula: string; value: string }[] = [
    { param: 'Curve Number (CN)', formula: 'Given', value: cn.toString() },
    { param: 'Potential Maximum Retention (S)', formula: 'S = 25400/CN − 254', value: `${s.toFixed(3)} mm` },
    { param: 'Initial Abstraction (Ia)', formula: 'Given', value: `${ia.toFixed(3)} mm` },
    { param: 'Rainfall Depth (P)', formula: 'Assumed', value: `${p.toFixed(0)} mm` },
    { param: 'Effective Rainfall (Pe)', formula: 'P − Ia', value: `${pe.toFixed(2)} mm` },
    { param: 'Direct Runoff (Q)', formula: '(P − Ia)² / (P − Ia + S)', value: `${q.toFixed(2)} mm` },
    { param: 'Runoff Coefficient (C)', formula: 'Q / P', value: c.toFixed(3) },
    { param: 'Impervious Area', formula: 'Given', value: `${imp.toFixed(3)} %` },
    { param: 'Baseflow', formula: 'Assumed constant', value: `${bf.toFixed(1)} m³/s` },
    { param: 'Time of Concentration (Tc)', formula: 'Given (Kirpich from Areal params)', value: `${tc.toFixed(3)} hrs` },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: 'Curve Number', v: cn, setter: (v: number) => setCn(Math.max(1, Math.min(100, v))) },
          { k: 'Rainfall (mm)', v: p, setter: (v: number) => setP(Math.max(0, v)) },
          { k: 'Initial Abs. (mm)', v: ia, setter: (v: number) => setIa(Math.max(0, v)) },
          { k: 'Impervious (%)', v: imp, setter: (v: number) => setImp(Math.max(0, Math.min(100, v))) },
        ].map((f) => (
          <label key={f.k} className="space-y-1 block">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{f.k}</span>
            <input
              type="number"
              step="any"
              value={f.v}
              onChange={(e) => f.setter(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono text-slate-900 bg-white focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </label>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-amber-50/40">
          <h4 className="text-sm font-semibold text-slate-900">Runoff Estimation — SCS Curve Number Method</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Live what-if calculator · Tc sourced from Areal parameters to avoid drift</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Parameter', 'Formula / Definition', 'Value'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.param} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{r.param}</td>
                  <td className="px-4 py-2.5 text-slate-600 italic text-[13px] font-serif">{r.formula}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function Analytics() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [fieldObservations, setFieldObservations] = useState<FieldObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [selectedCategory, setSelectedCategory] = useState<MorphoCategory | null>(null);
  const [flyToObs, setFlyToObs] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    Promise.all([
      interventionService.getInterventions(),
    ]).then(([ints]) => {
      setInterventions(ints);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const onFieldObsUpdate = (e: Event) => {
      const ce = e as CustomEvent<FieldObservation[]>;
      if (ce.detail && Array.isArray(ce.detail)) {
        setFieldObservations((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          ce.detail.forEach((o) => byId.set(o.id, o));
          return Array.from(byId.values()).sort((a, b) => (a.uploaded_at ?? '').localeCompare(b.uploaded_at ?? ''));
        });
      }
    };
    window.addEventListener('map:updateFieldObservations', onFieldObsUpdate as EventListener);
    return () => window.removeEventListener('map:updateFieldObservations', onFieldObsUpdate as EventListener);
  }, []);

  // Baseline Kasari morphology — seed from intervention service (exact values)
  const baselineMorpho: MorphologicalParams = useMemo(() => {
    if (interventions.length > 0) return interventions[0].morphological;
    return {
      linear: {
        streamOrderTable: kasariStreamOrderTable,
        totalStreamNumber: 650,
        totalStreamLength: 638,
        meanBifurcationRatio: 1.95260987,
      },
      areal: {
        basinAreaKm2: 627.687, basinPerimeterKm: 171.229, basinLengthKm: 49.7,
        drainageDensity: 1.016430163, streamFrequency: 1.035547972, drainageTexture: 3.796085943,
        textureRatio: 3.796085943, formFactor: 0.254115032, circularityRatio: 0.268892156,
        elongationRatio: 0.340542, compactnessCoefficient: 2.107245354,
        constantChannelMaintenance: 0.983835423, infiltrationNumber: 1.052562195,
        drainageIntensity: 1.018808777, lemniscateRatio: 0.983806419,
        meanStreamLengthBasin: 156.94, timeOfConcentrationHrs: 18.3298916,
      },
      terrain: {
        maximumElevationM: 947.8, minimumElevationM: 456.82, meanElevationM: 584.41,
        meanBasinSlope: 9.6, hypsometricIntegral: 0.259868019,
      },
      relief: {
        basinReliefM: 490.98, reliefRatio: 9.878873239, relativeRelief: 2.867388118,
        ruggednessNumber: 499.0468816, dissectionIndex: 0.518020679,
        meltonRuggednessNumber: 9.672033781, gradientRatio: 9.878873239,
        channelGradient: 3.128456735, lengthOfOverlandFlow: 0.491917712,
      },
      landUse: { agriculture: 55, forest: 25, wasteland: 8, waterBody: 3, builtUp: 9 },
      soilType: 'Vertisol', soilDepth: 1.2, infiltrationRate: 8.5,
    };
  }, [interventions]);

  const summary = useMemo(() => {
    const total = interventions.length;
    const high = interventions.filter((i) => i.impactScore >= 75).length;
    const moderate = interventions.filter((i) => i.impactScore >= 50 && i.impactScore < 75).length;
    const needsReview = interventions.filter((i) => i.impactScore >= 35 && i.impactScore < 50).length;
    const atRisk = interventions.filter((i) => i.impactScore < 35).length;
    const avgNDVIbefore = interventions.reduce((a, b) => a + b.ndviBefore, 0) / (total || 1);
    const avgNDVIafter = interventions.reduce((a, b) => a + b.ndviAfter, 0) / (total || 1);
    const avgNDWIbefore = interventions.reduce((a, b) => a + b.ndwiBefore, 0) / (total || 1);
    const avgNDWIafter = interventions.reduce((a, b) => a + b.ndwiAfter, 0) / (total || 1);
    const avgImpact = interventions.reduce((a, b) => a + b.impactScore, 0) / (total || 1);
    return { total, high, moderate, needsReview, atRisk, avgNDVIbefore, avgNDVIafter, avgNDWIbefore, avgNDWIafter, avgImpact: Math.round(avgImpact) };
  }, [interventions]);

  const hydrologicalSummary = useMemo(() => {
    const n = interventions.length || 1;
    const avg = (k: keyof Intervention['hydrological']) => {
      const v = interventions[0]?.hydrological[k];
      if (typeof v === 'object' && v !== null) return 0;
      return interventions.reduce((a, b) => a + (b.hydrological[k] as number), 0) / n;
    };
    return {
      avgAnnualRainfall: +avg('annualRainfall').toFixed(0),
      avgMonsoonRainfall: +avg('monsoonRainfall').toFixed(0),
      avgRunoffCoeff: +avg('runoffCoefficient').toFixed(3),
      avgAnnualRunoff: +avg('annualRunoff').toFixed(0),
      avgPeakDischarge: +avg('peakDischarge').toFixed(1),
      avgBaseFlow: +avg('baseFlow').toFixed(2),
      avgGWL: +avg('groundwaterLevel').toFixed(2),
      avgGWR: +avg('groundwaterRecharge').toFixed(0),
      avgET: +avg('evapotranspiration').toFixed(0),
      avgSoilMoisture: +avg('soilMoisture').toFixed(1),
      avgWaterYield: +avg('waterYield').toFixed(0),
      avgSedimentYield: +avg('sedimentYield').toFixed(2),
      avgFloodFreq: +avg('floodFrequency').toFixed(3),
      avgDroughtIdx: +avg('droughtIndex').toFixed(3),
      avgStorageEff: +avg('storageEfficiency').toFixed(3),
      avgInfiltrationLoss: +avg('infiltrationLoss').toFixed(0),
      avgSurfaceRunoff: +avg('surfaceRunoff').toFixed(0),
      avgSubSurfaceFlow: +avg('subSurfaceFlow').toFixed(0),
      avgReservoirCap: +avg('reservoirCapacity').toFixed(0),
      streamFlowMin: +(interventions.reduce((a, b) => a + b.hydrological.streamFlow.min, 0) / n).toFixed(2),
      streamFlowMax: +(interventions.reduce((a, b) => a + b.hydrological.streamFlow.max, 0) / n).toFixed(0),
      streamFlowMean: +(interventions.reduce((a, b) => a + b.hydrological.streamFlow.mean, 0) / n).toFixed(1),
    };
  }, [interventions]);

  const landUseAgg = useMemo(() => {
    const n = interventions.length || 1;
    const sums = interventions.reduce(
      (acc, i) => {
        acc.agriculture += i.morphological.landUse.agriculture;
        acc.forest += i.morphological.landUse.forest;
        acc.wasteland += i.morphological.landUse.wasteland;
        acc.waterBody += i.morphological.landUse.waterBody;
        acc.builtUp += i.morphological.landUse.builtUp;
        return acc;
      },
      { agriculture: 0, forest: 0, wasteland: 0, waterBody: 0, builtUp: 0 }
    );
    return {
      agriculture: +(sums.agriculture / n).toFixed(1),
      forest: +(sums.forest / n).toFixed(1),
      wasteland: +(sums.wasteland / n).toFixed(1),
      waterBody: +(sums.waterBody / n).toFixed(1),
      builtUp: +(sums.builtUp / n).toFixed(1),
    };
  }, [interventions]);

  const statusDistribution = useMemo(() => [
    { name: 'High Impact', value: summary.high, color: PIE_COLORS['High Impact'] },
    { name: 'Moderate Impact', value: summary.moderate, color: PIE_COLORS['Moderate Impact'] },
    { name: 'Needs Review', value: summary.needsReview, color: PIE_COLORS['Needs Review'] },
    { name: 'At Risk', value: summary.atRisk, color: PIE_COLORS['At Risk'] },
  ].filter((d) => d.value > 0), [summary]);

  const ndviTrend = useMemo(() => {
    const years = new Set<number>();
    interventions.forEach((i) => i.ndviTimeSeries.forEach((p) => years.add(p.year)));
    const sortedYears = Array.from(years).sort();
    return sortedYears.map((year) => {
      const pts = interventions.flatMap((i) => i.ndviTimeSeries.filter((p) => p.year === year));
      const avg = pts.reduce((a, b) => a + b.value, 0) / (pts.length || 1);
      return { year, NDVI: +avg.toFixed(3) };
    });
  }, [interventions]);

  const ndwiBeforeAfter = useMemo(() => {
    const byType: Record<string, { before: number; after: number; count: number }> = {};
    interventions.forEach((i) => {
      if (!byType[i.type]) byType[i.type] = { before: 0, after: 0, count: 0 };
      byType[i.type].before += i.ndwiBefore;
      byType[i.type].after += i.ndwiAfter;
      byType[i.type].count += 1;
    });
    return Object.entries(byType).map(([type, v]) => ({
      type,
      Before: +(v.before / v.count).toFixed(3),
      After: +(v.after / v.count).toFixed(3),
    }));
  }, [interventions]);

  const landUseData = useMemo(() => [
    { name: 'Agriculture', value: landUseAgg.agriculture },
    { name: 'Forest', value: landUseAgg.forest },
    { name: 'Wasteland', value: landUseAgg.wasteland },
    { name: 'Water Body', value: landUseAgg.waterBody },
    { name: 'Built-up', value: landUseAgg.builtUp },
  ], [landUseAgg]);

  const rainfallRunoffByType = useMemo(() => {
    const byType: Record<string, { rain: number; runoff: number; recharge: number; count: number }> = {};
    interventions.forEach((i) => {
      if (!byType[i.type]) byType[i.type] = { rain: 0, runoff: 0, recharge: 0, count: 0 };
      byType[i.type].rain += i.hydrological.annualRainfall;
      byType[i.type].runoff += i.hydrological.annualRunoff;
      byType[i.type].recharge += i.hydrological.groundwaterRecharge;
      byType[i.type].count += 1;
    });
    return Object.entries(byType).map(([type, v]) => ({
      type,
      Rainfall: Math.round(v.rain / v.count),
      Runoff: Math.round(v.runoff / v.count),
      Recharge: Math.round(v.recharge / v.count),
    }));
  }, [interventions]);

  const waterBalanceData = useMemo(() => {
    const byType: Record<string, { et: number; surf: number; sub: number; infil: number; count: number }> = {};
    interventions.forEach((i) => {
      if (!byType[i.type]) byType[i.type] = { et: 0, surf: 0, sub: 0, infil: 0, count: 0 };
      byType[i.type].et += i.hydrological.evapotranspiration;
      byType[i.type].surf += i.hydrological.surfaceRunoff;
      byType[i.type].sub += i.hydrological.subSurfaceFlow;
      byType[i.type].infil += i.hydrological.infiltrationLoss;
      byType[i.type].count += 1;
    });
    return Object.entries(byType).map(([type, v]) => ({
      type,
      ET: Math.round(v.et / v.count / 10),
      'Surface': Math.round(v.surf / v.count),
      'Sub-surface': Math.round(v.sub / v.count),
      'Infiltration': Math.round(v.infil / v.count),
    }));
  }, [interventions]);

  const flowTimeSeries = useMemo(() => [
    { month: 'Jun', stream: 6.2, gw: 7.1, sm: 22 },
    { month: 'Jul', stream: 18.4, gw: 7.4, sm: 34 },
    { month: 'Aug', stream: 28.6, gw: 7.8, sm: 40 },
    { month: 'Sep', stream: 22.3, gw: 8.2, sm: 38 },
    { month: 'Oct', stream: 11.5, gw: 8.0, sm: 33 },
    { month: 'Nov', stream: 5.8, gw: 7.6, sm: 28 },
    { month: 'Dec', stream: 3.2, gw: 7.1, sm: 24 },
    { month: 'Jan', stream: 2.1, gw: 6.7, sm: 21 },
    { month: 'Feb', stream: 1.6, gw: 6.3, sm: 19 },
    { month: 'Mar', stream: 1.4, gw: 5.9, sm: 18 },
    { month: 'Apr', stream: 1.2, gw: 5.6, sm: 17 },
    { month: 'May', stream: 1.1, gw: 5.4, sm: 16 },
  ], []);

  const hydroCards = [
    { k: 'Annual Rainfall', v: hydrologicalSummary.avgAnnualRainfall, unit: 'mm' },
    { k: 'Monsoon Rainfall', v: hydrologicalSummary.avgMonsoonRainfall, unit: 'mm' },
    { k: 'Annual Runoff', v: hydrologicalSummary.avgAnnualRunoff, unit: 'mm' },
    { k: 'Runoff Coefficient', v: hydrologicalSummary.avgRunoffCoeff, unit: '' },
    { k: 'GW Level', v: hydrologicalSummary.avgGWL, unit: 'mbgl' },
    { k: 'GW Recharge', v: hydrologicalSummary.avgGWR, unit: 'mm' },
  ];

  const summaryCards = [
    { label: 'Interventions', value: summary.total, accent: 'text-slate-900', sub: '1 watershed' },
    { label: 'High Impact', value: summary.high, accent: 'text-emerald-600', sub: '≥ 75 score' },
    { label: 'Moderate', value: summary.moderate, accent: 'text-amber-600', sub: '50–74 score' },
    { label: 'At Risk', value: summary.atRisk, accent: 'text-red-600', sub: '< 35 score' },
    { label: 'Avg Score', value: summary.avgImpact, accent: 'text-blue-700', sub: '/ 100', suffix: true },
  ];

  // --- Field Imagery tab helpers ---
  const fieldStats = useMemo(() => {
    const n = fieldObservations.length;
    const byClass: Record<string, number> = {};
    let confSum = 0;
    fieldObservations.forEach((o) => {
      byClass[o.detected_class] = (byClass[o.detected_class] || 0) + 1;
      confSum += o.confidence;
    });
    return {
      total: n,
      avgConfidence: n > 0 ? +(confSum / n).toFixed(3) : 0,
      byClass: Object.entries(byClass).map(([k, v]) => ({ name: k, value: v, color: DETECTION_CLASS_COLORS[k as FieldObservation['detected_class']] || '#94a3b8' })),
    };
  }, [fieldObservations]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-2">
        <div className="text-xs font-medium tracking-widest uppercase text-slate-400">Analytics</div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Watershed Analysis</h1>
        <p className="text-sm text-slate-500">
          Kasari River Basin · Kolhapur, Maharashtra · 62,769 ha (627.69 km²)
        </p>
      </header>

      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 w-fit">
        {(['overview', 'morphological', 'hydrological', 'fieldImagery'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${
              activeTab === t
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'fieldImagery' ? 'Field Imagery' : t}
          </button>
        ))}
      </div>

      {/* =================== OVERVIEW =================== */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
            {summaryCards.map((c) => (
              <div key={c.label} className="bg-white p-5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={`text-2xl font-semibold ${c.accent}`}>{loading ? '—' : c.value}</span>
                  {c.suffix && <span className="text-sm text-slate-300">/ 100</span>}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="sm:col-span-2 lg:col-span-1 rounded-xl border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Vegetation (NDVI)</h3>
                <p className="text-[11px] text-slate-400">Before → After</p>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Before</span>
                    <span className="font-mono font-semibold text-slate-700">{formatNumber(summary.avgNDVIbefore)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${summary.avgNDVIbefore * 180}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">After</span>
                    <span className="font-mono font-semibold text-emerald-700">{formatNumber(summary.avgNDVIafter)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${summary.avgNDVIafter * 180}%` }} />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">Net: </span>
                  <span className="font-semibold text-emerald-700">+{formatNumber(summary.avgNDVIafter - summary.avgNDVIbefore)}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Water (NDWI)</h4>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Before</span>
                    <span className="font-mono font-semibold text-slate-700">{formatNumber(summary.avgNDWIbefore)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${Math.min(100, summary.avgNDWIbefore * 500)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">After</span>
                    <span className="font-mono font-semibold text-sky-700">{formatNumber(summary.avgNDWIafter)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min(100, summary.avgNDWIafter * 500)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">NDVI Trend</h3>
              <p className="text-[11px] text-slate-400 mb-3">2021–2025</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ndviTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis domain={[0.2, 0.55]} tick={{ fontSize: 11 }} stroke="#94a3b8" width={40} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Line type="monotone" dataKey="NDVI" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Status Distribution</h3>
              <p className="text-[11px] text-slate-400 mb-3">Impact classification</p>
              <div className="h-52 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} dataKey="value">
                      {statusDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="sm:col-span-2 rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">NDWI Before / After by Type</h3>
              <p className="text-[11px] text-slate-400 mb-3">Grouped water index response</p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ndwiBeforeAfter} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={40} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Before" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="After" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== MORPHOLOGICAL =================== */}
      {activeTab === 'morphological' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1 flex-1 min-w-[260px]">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Parameter Category</label>
              <select
                value={selectedCategory ?? ''}
                onChange={(e) => setSelectedCategory(e.target.value ? (e.target.value as MorphoCategory) : null)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              >
                <option value="">Select a parameter category to view its values</option>
                <option value="linear">Linear Parameters</option>
                <option value="areal">Areal Parameters</option>
                <option value="terrain">Terrain Parameters</option>
                <option value="relief">Relief Parameters</option>
              </select>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 max-w-md">
              Values are the Kasari River Basin morphological baseline from GIS analysis (referenced spreadsheet). Source: <span className="font-semibold text-slate-700">Kasari River — 627.69 km²</span>
            </div>
          </div>

          {!selectedCategory && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
              <div className="text-sm text-slate-500">Select a parameter category to view its values</div>
            </div>
          )}

          {selectedCategory === 'linear' && (
            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Linear Parameters</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Stream ordering &amp; Horton ratios</p>
                </div>
                <span className="text-[11px] uppercase tracking-wide font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">Category 1/4</span>
              </div>
              <LinearParamsPanel data={baselineMorpho.linear} />
            </div>
          )}

          {selectedCategory === 'areal' && (
            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Areal Parameters</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Basin shape, density &amp; areal metrics</p>
                </div>
                <span className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">Category 2/4</span>
              </div>
              <ArealParamsPanel data={baselineMorpho.areal} />
            </div>
          )}

          {selectedCategory === 'terrain' && (
            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Terrain Parameters</h3>
                  <p className="text-xs text-slate-500 mt-0.5">DEM-derived elevation &amp; slope</p>
                </div>
                <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">Category 3/4</span>
              </div>
              <TerrainParamsPanel data={baselineMorpho.terrain} />
            </div>
          )}

          {selectedCategory === 'relief' && (
            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Relief Parameters</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Relief ratios &amp; ruggedness indices</p>
                </div>
                <span className="text-[11px] uppercase tracking-wide font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">Category 4/4</span>
              </div>
              <ReliefParamsPanel data={baselineMorpho.relief} />
            </div>
          )}

          {selectedCategory && (
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Land Use Composition (Avg across sites)</h3>
              <div className="grid md:grid-cols-3 gap-5 items-start">
                <div className="h-56 md:col-span-1 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={landUseData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${value}%`} labelLine={false}>
                        {landUseData.map((_, i) => <Cell key={i} fill={LANDUSE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {landUseData.map((d, i) => (
                    <div key={d.name} className="space-y-1 border border-slate-100 rounded-lg p-3 bg-slate-50/40">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: LANDUSE_COLORS[i] }} />
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{d.name}</span>
                      </div>
                      <div className="text-lg font-semibold text-slate-900">{d.value}<span className="text-xs text-slate-400 ml-1">%</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== HYDROLOGICAL =================== */}
      {activeTab === 'hydrological' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
            {hydroCards.map((c) => (
              <div key={c.k} className="bg-white p-5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.k}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-slate-900">{c.v}</span>
                  <span className="text-xs text-slate-400">{c.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 p-6 bg-white">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Runoff Estimation — SCS Curve Number Method</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All 10 parameters from the hydrological reference sheet. Tc is sourced from Areal Parameters (Kirpich) so it never drifts.
                </p>
              </div>
            </div>
            <ScsCnPanel runoff={interventions[0]?.hydrological.runoff ?? kasariRunoffBaseline} />
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="md:col-span-2 rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Rainfall · Runoff · Recharge</h3>
              <p className="text-[11px] text-slate-400 mb-3">By intervention type (mm)</p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rainfallRunoffByType} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={50} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Rainfall" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Runoff" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Recharge" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Flow Components</h3>
              <p className="text-[11px] text-slate-400 mb-3">Stream flow (m³/s)</p>
              <div className="space-y-4 pt-2">
                {[
                  { k: 'Minimum', v: hydrologicalSummary.streamFlowMin, u: 'm³/s', c: 'bg-sky-400', pct: Math.min(100, hydrologicalSummary.streamFlowMin * 30) },
                  { k: 'Mean', v: hydrologicalSummary.streamFlowMean, u: 'm³/s', c: 'bg-sky-500', pct: Math.min(100, hydrologicalSummary.streamFlowMean * 6) },
                  { k: 'Maximum', v: hydrologicalSummary.streamFlowMax, u: 'm³/s', c: 'bg-sky-700', pct: Math.min(100, hydrologicalSummary.streamFlowMax) },
                ].map((f) => (
                  <div key={f.k}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{f.k}</span>
                      <span className="font-mono font-semibold text-slate-700">{f.v} {f.u}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${f.c} rounded-full`} style={{ width: `${f.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Flood Freq (annual)</span>
                  <span className="font-mono font-semibold text-slate-700">{hydrologicalSummary.avgFloodFreq}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Drought Index</span>
                  <span className="font-mono font-semibold text-slate-700">{hydrologicalSummary.avgDroughtIdx}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Storage Efficiency</span>
                  <span className="font-mono font-semibold text-emerald-700">{(hydrologicalSummary.avgStorageEff * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Sediment Yield</span>
                  <span className="font-mono font-semibold text-slate-700">{hydrologicalSummary.avgSedimentYield} t/ha</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="md:col-span-2 rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Seasonal Flow Regime</h3>
              <p className="text-[11px] text-slate-400 mb-3">Stream flow · GW level · Soil moisture (annual cycle)</p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={flowTimeSeries}>
                    <defs>
                      <linearGradient id="cStream" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cGW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={40} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="stream" name="Stream Flow" stroke="#0ea5e9" strokeWidth={2} fill="url(#cStream)" />
                    <Area type="monotone" dataKey="gw" name="GW Level" stroke="#22c55e" strokeWidth={2} fill="url(#cGW)" />
                    <Line type="monotone" dataKey="sm" name="Soil Moisture" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Water Balance</h3>
              <p className="text-[11px] text-slate-400 mb-3">By type (mm, ET/10 scaled)</p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterBalanceData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={40} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ET" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Surface" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Sub-surface" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Infiltration" fill="#64748b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== FIELD IMAGERY =================== */}
      {activeTab === 'fieldImagery' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
            <div className="bg-white p-5">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Images Processed</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{fieldStats.total}</div>
            </div>
            <div className="bg-white p-5">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Features Detected</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{fieldStats.total}</div>
            </div>
            <div className="bg-white p-5">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Avg Confidence</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{(fieldStats.avgConfidence * 100).toFixed(0)}<span className="text-xs text-slate-400 ml-1">%</span></div>
            </div>
            <div className="bg-white p-5">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Unique Classes</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{fieldStats.byClass.length}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-slate-200 p-5 md:col-span-1">
              <h3 className="text-sm font-semibold text-slate-900">Detections by Class</h3>
              <p className="text-[11px] text-slate-400 mb-3">Upload geotagged images via Dashboard</p>
              {fieldStats.byClass.length > 0 ? (
                <div className="h-56 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={fieldStats.byClass} cx="50%" cy="50%" outerRadius={78} dataKey="value" label={({ name, value }) => `${name} · ${value}`} labelLine={false}>
                        {fieldStats.byClass.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center text-xs text-slate-500">
                  No detections yet. Use the upload panel on the Dashboard.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-5 md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Thumbnail Gallery</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click a pin to fly to its map location</p>
                </div>
                <Link to="/map" className="text-xs font-medium text-slate-700 hover:text-slate-900">Open map →</Link>
              </div>
              {fieldObservations.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {fieldObservations.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setFlyToObs({ lat: o.latitude, lng: o.longitude });
                        const flyEv = new CustomEvent('map:flyToObservation', {
                          detail: { latitude: o.latitude, longitude: o.longitude, zoom: 15 },
                        });
                        window.dispatchEvent(flyEv);
                      }}
                      className="aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex flex-col hover:ring-2 hover:ring-slate-300 transition-all"
                      title={`${o.detected_class} @ ${o.latitude.toFixed(4)}, ${o.longitude.toFixed(4)}`}
                    >
                      <div className="flex-1 flex items-center justify-center text-2xl">
                        {o.detected_class === 'check_dam' ? '🪨' :
                         o.detected_class === 'farm_pond' ? '💧' :
                         o.detected_class === 'plantation' ? '🌱' :
                         o.detected_class === 'vegetation' ? '🌿' :
                         o.detected_class === 'water_body' ? '🌊' : '❓'}
                      </div>
                      <div className="px-2 py-1 border-t border-slate-100 text-[10px] font-mono text-slate-600 bg-white flex items-center justify-between">
                        <span style={{ color: DETECTION_CLASS_COLORS[o.detected_class] }} className="font-semibold uppercase">
                          {o.detected_class.replace('_', ' ')}
                        </span>
                        <span>{(o.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center text-xs text-slate-500 space-y-2">
                  <div className="text-2xl mb-2">📷</div>
                  <div>No field imagery uploaded yet.</div>
                  <div>Use the <span className="font-semibold text-slate-700">Geotagged Image Upload</span> on the Dashboard header to process images.</div>
                </div>
              )}
            </div>
          </div>

          {flyToObs && (
            <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between bg-slate-50/60">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Map fly-to:</span>{' '}
                <span className="font-mono">{flyToObs.lat.toFixed(5)}, {flyToObs.lng.toFixed(5)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/map" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                  Go to map →
                </Link>
                <button onClick={() => setFlyToObs(null)} className="text-xs text-slate-500 hover:text-slate-700">Clear</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== INTERVENTION INVENTORY (all tabs) =================== */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-end justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Intervention Inventory</h3>
            <p className="text-xs text-slate-500 mt-0.5">{interventions.length} records · Kasari River Basin</p>
          </div>
          <Link to="/map" className="text-xs font-medium text-slate-700 hover:text-slate-900">
            Locate on map →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['ID', 'Type', 'Village', 'Condition', 'NDVI Δ', 'NDWI Δ', 'Impact', 'Status', 'Action'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${[5, 6].includes(i) ? 'text-right' : i === 7 ? 'text-center' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {interventions.map((i) => {
                const ndviDelta = i.ndviAfter - i.ndviBefore;
                const ndwiDelta = i.ndwiAfter - i.ndwiBefore;
                return (
                  <tr key={i.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{i.id}</div>
                      <div className="text-[10px] text-slate-400">Built {i.constructionYear}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{i.type}</td>
                    <td className="px-4 py-3 text-slate-600">{i.village}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${conditionBadgeClass(i.condition)}`}>
                        {i.condition}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${ndviDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {ndviDelta >= 0 ? '+' : ''}{formatNumber(ndviDelta)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${ndwiDelta >= 0 ? 'text-sky-700' : 'text-red-600'}`}>
                      {ndwiDelta >= 0 ? '+' : ''}{formatNumber(ndwiDelta)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-slate-900">{i.impactScore}<span className="text-slate-400 text-[10px]">/100</span></div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusBadgeClass(i.impactScore)}`}>
                        {getStatusLabel(i.impactScore)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/intervention/${i.id}`} className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline">
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
