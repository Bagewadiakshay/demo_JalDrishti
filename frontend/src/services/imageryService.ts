import type { FieldObservation, DetectionClass } from '../types';

const USE_API = false;
const API_BASE = (import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const DETECTION_CLASSES: DetectionClass[] = [
  'check_dam',
  'farm_pond',
  'plantation',
  'vegetation',
  'water_body',
  'unclassified',
];

// Kasari basin approximate bbox (from watershed.json polygon):
// Lat 16.57 .. 16.81, Lng 74.07 .. 74.36
const KASARI_BBOX = {
  minLat: 16.57,
  maxLat: 16.81,
  minLng: 74.07,
  maxLng: 74.36,
};

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function seededRand(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidV4Like(seed: number): string {
  const rnd = seededRand(seed);
  const hex = (n: number) => Math.floor(rnd() * n).toString(16).padStart(2, '0');
  return `${hex(4294967295)}${hex(65535)}-${hex(65535)}-4${hex(4095)}-${hex(16383)}-${hex(4294967295)}${hex(65535)}${hex(65535)}`.slice(0, 36);
}

export interface UploadResult {
  featureCollection: {
    type: 'FeatureCollection';
    features: FieldObservation[];
  };
  imagesProcessed: number;
  featuresDetected: number;
}

async function apiUpload(files: File[]): Promise<UploadResult> {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const resp = await fetch(`${API_BASE}/api/imagery/upload`, {
    method: 'POST',
    body: fd,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text || '/api/imagery/upload'}`);
  }
  return (await resp.json()) as UploadResult;
}

function simulateUpload(files: File[]): Promise<UploadResult> {
  // Demo fallback: derive deterministic pseudo-detections from file metadata
  // (hash of name + size) so the same photo always produces the same features.
  return new Promise((resolve) => {
    const features: FieldObservation[] = [];
    for (const file of files) {
      const seed = hashString(`${file.name}-${file.size}`);
      const rnd = seededRand(seed);
      const nDetections = 1 + Math.floor(rnd() * 3); // 1..3 features per image
      for (let d = 0; d < nDetections; d++) {
        const obsId = uuidV4Like(seed + d * 7919);
        const classIdx = Math.floor(rnd() * DETECTION_CLASSES.length);
        const detectedClass = DETECTION_CLASSES[classIdx];
        const confidence = 0.55 + rnd() * 0.42; // 0.55 .. 0.97
        const latitude = KASARI_BBOX.minLat + rnd() * (KASARI_BBOX.maxLat - KASARI_BBOX.minLat);
        const longitude = KASARI_BBOX.minLng + rnd() * (KASARI_BBOX.maxLng - KASARI_BBOX.minLng);
        const capturedTs = Date.now() - Math.floor(rnd() * 60 * 24 * 60 * 60 * 1000); // up to 60 days ago
        features.push({
          id: obsId,
          image_filename: file.name,
          latitude: +latitude.toFixed(6),
          longitude: +longitude.toFixed(6),
          captured_at: new Date(capturedTs).toISOString(),
          detected_class: detectedClass,
          confidence: +confidence.toFixed(3),
          geojson_feature: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [+longitude.toFixed(6), +latitude.toFixed(6)],
            },
            properties: {
              class: detectedClass,
              confidence: +confidence.toFixed(3),
              image_id: obsId,
              captured_at: new Date(capturedTs).toISOString(),
            },
          },
          intervention_id: null,
          uploaded_at: new Date().toISOString(),
        });
      }
    }
    setTimeout(() => {
      resolve({
        featureCollection: {
          type: 'FeatureCollection',
          features,
        },
        imagesProcessed: files.length,
        featuresDetected: features.length,
      });
    }, 900 + files.length * 250);
  });
}

export const imageryService = {
  async uploadGeotaggedImages(files: File[]): Promise<UploadResult> {
    if (USE_API) return apiUpload(files);
    return simulateUpload(files);
  },
};

export const DETECTION_CLASS_LABELS: Record<DetectionClass, string> = {
  check_dam: 'Check Dam',
  farm_pond: 'Farm Pond',
  plantation: 'Plantation',
  vegetation: 'Vegetation',
  water_body: 'Water Body',
  unclassified: 'Unclassified',
};
