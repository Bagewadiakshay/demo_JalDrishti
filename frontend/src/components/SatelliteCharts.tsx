import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell
} from 'recharts';
import type { SatelliteMetrics, Intervention } from '../types';
import { formatNumber } from '../utils/formatters';

interface BeforeAfterProps {
  metrics: SatelliteMetrics;
}

export function BeforeAfterBarChart({ metrics }: BeforeAfterProps) {
  const data = [
    { name: 'NDVI', Before: metrics.ndvi.before, After: metrics.ndvi.after },
    { name: 'NDWI', Before: metrics.ndwi.before, After: metrics.ndwi.after },
    { name: 'Water Area (ha)', Before: metrics.waterArea.before, After: metrics.waterArea.after },
  ];

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis tick={{ fontSize: 11 }} stroke="#64748b" width={40} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Before" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="After" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface NDVITimeSeriesProps {
  data: { year: number; value: number }[];
  label?: string;
  color?: string;
}

export function NDVITimeSeriesChart({ data, label = 'NDVI Trend', color = '#22c55e' }: NDVITimeSeriesProps) {
  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis domain={[0, 0.7]} tick={{ fontSize: 11 }} stroke="#64748b" width={40} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
            formatter={(v: any) => [formatNumber(Number(v)), label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 4, fill: color }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BeforeAfterCompareProps {
  intervention: Intervention;
}

export function BeforeAfterCompare({ intervention }: BeforeAfterCompareProps) {
  const items = [
    {
      label: 'NDVI',
      before: intervention.ndviBefore,
      after: intervention.ndviAfter,
      unit: '',
      isPositive: intervention.ndviAfter >= intervention.ndviBefore,
    },
    {
      label: 'NDWI',
      before: intervention.ndwiBefore,
      after: intervention.ndwiAfter,
      unit: '',
      isPositive: intervention.ndwiAfter >= intervention.ndwiBefore,
    },
    {
      label: 'Water Area',
      before: intervention.waterAreaBefore,
      after: intervention.waterAreaAfter,
      unit: ' ha',
      isPositive: intervention.waterAreaAfter >= intervention.waterAreaBefore,
    },
  ];

  const positiveCount = items.filter((i) => i.isPositive).length;
  const overallPositive = positiveCount >= 2;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className={`px-4 py-3 text-center font-bold text-sm ${overallPositive ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-red-50 text-red-800 border-b border-red-200'}`}>
        {overallPositive ? '✓ Positive Response Detected' : '⚠ Declining Indicators Detected'}
      </div>
      <div className="grid grid-cols-3 text-xs">
        <div className="bg-slate-50 p-3 font-semibold text-slate-700">Metric</div>
        <div className="bg-slate-50 p-3 font-semibold text-slate-700 text-center">Before Intervention</div>
        <div className="bg-slate-50 p-3 font-semibold text-slate-700 text-center">After Intervention</div>
        {items.map((it) => (
          <React.Fragment key={`row-${it.label}`}>
            <div className="p-3 border-t border-slate-100 font-semibold text-slate-800 flex items-center">
              {it.label}
              <span className={`ml-auto text-lg ${it.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {it.isPositive ? '↗' : '↘'}
              </span>
            </div>
            <div className="p-3 border-t border-slate-100 text-center text-slate-700 font-mono text-sm">
              {formatNumber(it.before)}{it.unit}
            </div>
            <div className={`p-3 border-t border-slate-100 text-center font-mono font-bold text-sm ${it.isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatNumber(it.after)}{it.unit}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
