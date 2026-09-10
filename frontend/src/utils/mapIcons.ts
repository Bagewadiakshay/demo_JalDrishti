import L from 'leaflet';
import type { DetectionClass } from '../types';

const FIELD_DETECTION_COLORS: Record<DetectionClass, { bg: string; border: string; label: string }> = {
  check_dam: { bg: '#0ea5e9', border: '#0369a1', label: 'CD' },
  farm_pond: { bg: '#14b8a6', border: '#0f766e', label: 'FP' },
  plantation: { bg: '#22c55e', border: '#15803d', label: 'PL' },
  vegetation: { bg: '#84cc16', border: '#4d7c0f', label: 'VG' },
  water_body: { bg: '#06b6d4', border: '#0e7490', label: 'WB' },
  unclassified: { bg: '#94a3b8', border: '#475569', label: '??' },
};

export function createFieldDetectionIcon(detectedClass: DetectionClass): L.DivIcon {
  const palette = FIELD_DETECTION_COLORS[detectedClass] || FIELD_DETECTION_COLORS.unclassified;
  return L.divIcon({
    className: 'field-detection-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 42px;
        margin-left: -16px;
        margin-top: -42px;
      ">
        <div style="
          background: ${palette.bg};
          border: 2px solid ${palette.border};
          color: white;
          font-weight: 700;
          font-size: 11px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          margin: 0 auto;
          position: relative;
        ">${palette.label}
          <span style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: #1e293b;
            color: white;
            font-size: 7px;
            font-weight: 700;
            padding: 1px 3px;
            border-radius: 4px;
            border: 1px solid #fff;
            line-height: 1;
          ">AI</span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 10px solid ${palette.border};
          margin: -2px auto 0;
        "></div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
}

export function createCustomIcon(type: string, isAtRisk = false): L.DivIcon {
  const colors: Record<string, { bg: string; border: string; label: string }> = {
    'Check Dam': { bg: '#0ea5e9', border: '#0369a1', label: 'CD' },
    'Farm Pond': { bg: '#14b8a6', border: '#0f766e', label: 'FP' },
    'Plantation': { bg: '#22c55e', border: '#15803d', label: 'PL' },
    'Contour Trench': { bg: '#a855f7', border: '#7e22ce', label: 'CT' },
  };

  const palette = isAtRisk
    ? { bg: '#ef4444', border: '#b91c1c', label: '!' }
    : colors[type] || { bg: '#64748b', border: '#334155', label: '?' };

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 42px;
        margin-left: -16px;
        margin-top: -42px;
      ">
        <div style="
          background: ${palette.bg};
          border: 2px solid ${palette.border};
          color: white;
          font-weight: 700;
          font-size: 11px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          margin: 0 auto;
        ">${palette.label}</div>
        <div style="
          width: 0;
          height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 10px solid ${palette.border};
          margin: -2px auto 0;
        "></div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
}
