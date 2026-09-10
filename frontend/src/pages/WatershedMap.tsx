import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { interventionService, spatialService } from '../services/interventionService';
import { createCustomIcon, createFieldDetectionIcon } from '../utils/mapIcons';
import { getStatusLabel, statusBadgeClass, conditionBadgeClass } from '../utils/formatters';
import type { Intervention, GeoJSONCollection, FieldObservation, DetectionClass } from '../types';

// Kasari River Basin fallback defaults — used only before the real GeoJSON polygon loads.
// Prayag Sangam confluence (start of Panchganga): 16.7344°N, 74.1758°E
// Kolhapur city center (basemap anchor): 16.6917°N, 74.2333°E
const FALLBACK_CENTER: [number, number] = [16.6917, 74.2333];
const FALLBACK_ZOOM = 11;

const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const GOOGLE_HYBRID_URL = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
const GOOGLE_ROADS_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const GOOGLE_TERRAIN_URL = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';

const layerLegend: Record<string, { bg: string; name: string }> = {
  'Check Dam': { bg: '#0ea5e9', name: 'Check Dams' },
  'Farm Pond': { bg: '#14b8a6', name: 'Farm Ponds' },
  'Plantation': { bg: '#22c55e', name: 'Plantations' },
  'Contour Trench': { bg: '#a855f7', name: 'Contour Trenches' },
  'At Risk': { bg: '#ef4444', name: 'At Risk' },
  'AI check_dam': { bg: '#0ea5e9', name: 'Check Dams (AI)' },
  'AI farm_pond': { bg: '#14b8a6', name: 'Farm Ponds (AI)' },
  'AI plantation': { bg: '#22c55e', name: 'Plantations (AI)' },
  'AI vegetation': { bg: '#84cc16', name: 'Vegetation (AI)' },
  'AI water_body': { bg: '#06b6d4', name: 'Water Bodies (AI)' },
  'AI unclassified': { bg: '#94a3b8', name: 'Unclassified (AI)' },
};

function FitBoundsToGeoJson({ watershed }: { watershed: GeoJSONCollection | null }) {
  const map = useMap();
  useEffect(() => {
    if (!watershed) return;
    try {
      // Iterate over polygon coordinates to compute a bounding box manually (avoids adding turf dep)
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      const visit = (node: unknown) => {
        const arr = node as unknown[];
        if (!Array.isArray(arr) || !arr.length) return;
        if (typeof arr[0] === 'number') {
          const [lng, lat] = arr as [number, number];
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        } else {
          arr.forEach(visit);
        }
      };
      watershed.features.forEach((f) => visit(f.geometry.coordinates));
      if (isFinite(minLng)) {
        const pad = 0.02;
        map.fitBounds(
          [
            [minLat - pad, minLng - pad],
            [maxLat + pad, maxLng + pad],
          ],
          { padding: [20, 20], maxZoom: 13 }
        );
      }
    } catch {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
    }
  }, [watershed, map]);
  return null;
}

function FlyToLocation({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? map.getZoom(), { animate: true, duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

type BasemapType = 'satellite' | 'hybrid' | 'roads' | 'terrain';

const BASEMAP_URLS: Record<BasemapType, string> = {
  satellite: GOOGLE_SATELLITE_URL,
  hybrid: GOOGLE_HYBRID_URL,
  roads: GOOGLE_ROADS_URL,
  terrain: GOOGLE_TERRAIN_URL,
};

const BASEMAP_LABELS: Record<BasemapType, string> = {
  satellite: 'Satellite',
  hybrid: 'Hybrid',
  roads: 'Roads',
  terrain: 'Terrain',
};

export default function WatershedMap() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [fieldObservations, setFieldObservations] = useState<FieldObservation[]>([]);
  const [watershed, setWatershed] = useState<GeoJSONCollection | null>(null);
  const [drainage, setDrainage] = useState<GeoJSONCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | undefined>(undefined);
  const [showWatershedLayer, setShowWatershedLayer] = useState(true);
  const [showInterventions, setShowInterventions] = useState(true);
  const [showDrainage, setShowDrainage] = useState(false);
  const [showNDVI, setShowNDVI] = useState(false);
  const [showNDWI, setShowNDWI] = useState(false);
  const [showFieldDetections, setShowFieldDetections] = useState(true);
  const [basemap, setBasemap] = useState<BasemapType>('satellite');
  const [loading, setLoading] = useState(true);
  const [basinReady, setBasinReady] = useState(false);
  const refInitialized = useRef(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [ints, ws, dr] = await Promise.all([
        interventionService.getInterventions(),
        spatialService.getWatershedBoundary(),
        spatialService.getDrainageNetwork(),
      ]);
      setInterventions(ints);
      setWatershed(ws as GeoJSONCollection);
      setDrainage(dr as GeoJSONCollection);
      setLoading(false);
      // Next tick allow bounds-fit to run
      setTimeout(() => setBasinReady(true), 50);
    }
    load();
    // Listen for custom event from imagery upload / analytics gallery
    function onFlyObs(e: Event) {
      const ce = e as CustomEvent<{ lat: number; lng: number }>;
      if (ce.detail) setFlyTo([ce.detail.lat, ce.detail.lng]);
    }
    function onFieldObsUpdate(e: Event) {
      const ce = e as CustomEvent<FieldObservation[]>;
      if (ce.detail) setFieldObservations(ce.detail);
    }
    window.addEventListener('map:flyToObservation', onFlyObs as EventListener);
    window.addEventListener('map:updateFieldObservations', onFieldObsUpdate as EventListener);
    refInitialized.current = true;
    return () => {
      window.removeEventListener('map:flyToObservation', onFlyObs as EventListener);
      window.removeEventListener('map:updateFieldObservations', onFieldObsUpdate as EventListener);
    };
  }, []);

  const atRiskIds = useMemo(
    () => new Set(interventions.filter((i) => i.impactScore < 35).map((i) => i.id)),
    [interventions]
  );

  const handleListClick = (int: Intervention) => {
    setSelectedId(int.id);
    setFlyTo([int.latitude, int.longitude]);
  };

  const watershedStyle = {
    color: '#1d4ed8',
    weight: 2.5,
    fillColor: '#3b82f6',
    fillOpacity: 0.08,
    dashArray: '6 4',
  };

  const drainageStyle = {
    color: '#0ea5e9',
    weight: 2,
    opacity: 0.85,
  };

  const ndviLayerStyle = {
    color: 'transparent',
    fillColor: '#22c55e',
    fillOpacity: 0.15,
  };

  const fieldObsByClass = useMemo(() => {
    const map: Record<DetectionClass, FieldObservation[]> = {
      check_dam: [], farm_pond: [], plantation: [], vegetation: [], water_body: [], unclassified: [],
    };
    fieldObservations.forEach((o) => (map[o.detected_class] || map.unclassified).push(o));
    return map;
  }, [fieldObservations]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Watershed Map</h1>
          <p className="text-sm text-slate-600 mt-1">
            Kasari River Basin – Kolhapur, Maharashtra · ~62,769 ha (627.69 km²) · Click any marker to view details
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">Basemap:</span>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                  {(Object.keys(BASEMAP_LABELS) as BasemapType[]).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBasemap(b)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        basemap === b
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {BASEMAP_LABELS[b]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">Layers:</span>
                {[
                  { key: 'ws', label: 'Watershed', value: showWatershedLayer, setter: setShowWatershedLayer, color: 'blue' },
                  { key: 'int', label: 'Interventions', value: showInterventions, setter: setShowInterventions, color: 'slate' },
                  { key: 'dr', label: 'Drainage', value: showDrainage, setter: setShowDrainage, color: 'sky' },
                  { key: 'fd', label: 'Field Detections (AI)', value: showFieldDetections, setter: setShowFieldDetections, color: 'emerald' },
                  { key: 'ndvi', label: 'NDVI', value: showNDVI, setter: setShowNDVI, color: 'green' },
                  { key: 'ndwi', label: 'NDWI', value: showNDWI, setter: setShowNDWI, color: 'cyan' },
                ].map((l) => (
                  <label
                    key={l.key}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
                      l.value ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox" checked={l.value} onChange={(e) => l.setter(e.target.checked)} className="sr-only" />
                    <span className={`w-3 h-3 rounded-sm border ${l.value ? 'bg-blue-500 border-blue-600' : 'border-slate-300 bg-white'} flex items-center justify-center text-white text-[10px]`}>
                      {l.value ? '✓' : ''}
                    </span>
                    {l.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="h-[580px] bg-slate-100 relative">
              {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50/80">
                  <div className="text-sm text-slate-600">Loading map data…</div>
                </div>
              )}
              <MapContainer
                center={FALLBACK_CENTER}
                zoom={FALLBACK_ZOOM}
                zoomControl={true}
                scrollWheelZoom={true}
                style={{ width: '100%', height: '100%', borderRadius: 0 }}
              >
                {basinReady && <FitBoundsToGeoJson watershed={watershed} />}
                <FlyToLocation center={flyTo} zoom={15} />
                <TileLayer
                  attribution='&copy; <a href="https://maps.google.com">Google Earth</a> · Imagery © Google'
                  url={BASEMAP_URLS[basemap]}
                  maxZoom={20}
                />

                {showWatershedLayer && watershed && (
                  <GeoJSON
                    key="watershed"
                    data={watershed as any}
                    style={watershedStyle}
                  />
                )}

                {showNDVI && watershed && (
                  <GeoJSON
                    key="ndvi-sim"
                    data={watershed as any}
                    style={ndviLayerStyle}
                  />
                )}

                {showNDWI && drainage && (
                  <GeoJSON
                    key="ndwi-sim"
                    data={drainage as any}
                    style={{ ...drainageStyle, color: '#06b6d4', weight: 3, opacity: 0.7 }}
                  />
                )}

                {showDrainage && drainage && (
                  <GeoJSON
                    key="drainage"
                    data={drainage as any}
                    style={drainageStyle}
                  />
                )}

                {showInterventions && interventions.map((int) => {
                  const isAtRisk = int.impactScore < 35;
                  const isSelected = selectedId === int.id;
                  return (
                    <Marker
                      key={int.id}
                      // DEMO PLACEHOLDER — random radius scatter around Kolhapur centroid, not field-verified locations
                      position={[int.latitude, int.longitude]}
                      icon={createCustomIcon(int.type, isAtRisk)}
                      eventHandlers={{
                        click: () => setSelectedId(int.id),
                      }}
                    >
                      {isSelected && (
                        <Tooltip permanent direction="top" offset={[0, -40]}>
                          <div className="font-bold text-xs">{int.id}</div>
                        </Tooltip>
                      )}
                      <Popup>
                        <div className="p-1" style={{ minWidth: 240 }}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="text-xs text-slate-500 font-medium">Intervention</div>
                              <div className="font-bold text-slate-900 text-base">{int.id}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusBadgeClass(int.impactScore)}`}>
                              {getStatusLabel(int.impactScore)}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-slate-700">
                            <div><span className="text-slate-500">Type:</span> <span className="font-medium">{int.type}</span></div>
                            <div><span className="text-slate-500">Village:</span> <span className="font-medium">{int.village || '—'}</span></div>
                            <div>
                              <span className="text-slate-500">Condition:</span>{' '}
                              <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${conditionBadgeClass(int.condition)}`}>
                                {int.condition}
                              </span>
                            </div>
                            <div><span className="text-slate-500">Impact Score:</span> <span className="font-bold text-slate-900">{int.impactScore}/100</span></div>
                            <div><span className="text-slate-500">Location:</span> <span className="font-mono">{int.latitude.toFixed(4)}, {int.longitude.toFixed(4)}</span></div>
                          </div>
                          <Link
                            to={`/intervention/${int.id}`}
                            className="mt-3 block w-full text-center px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                          >
                            View Details →
                          </Link>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {showFieldDetections && fieldObservations.map((o) => (
                  <Marker
                    key={o.id}
                    position={[o.latitude, o.longitude]}
                    icon={createFieldDetectionIcon(o.detected_class)}
                  >
                    <Popup>
                      <div className="p-1" style={{ minWidth: 200 }}>
                        <div className="text-xs text-slate-500 font-medium">AI Detection</div>
                        <div className="font-bold text-slate-900 text-sm mb-1 capitalize">{o.detected_class.replace('_', ' ')}</div>
                        <div className="space-y-0.5 text-xs text-slate-700">
                          <div><span className="text-slate-500">Confidence:</span> <span className="font-mono font-semibold">{(o.confidence * 100).toFixed(0)}%</span></div>
                          <div><span className="text-slate-500">Image:</span> <span className="font-mono">{o.image_filename}</span></div>
                          <div><span className="text-slate-500">Coords:</span> <span className="font-mono">{o.latitude.toFixed(4)}, {o.longitude.toFixed(4)}</span></div>
                          {o.captured_at && (
                            <div><span className="text-slate-500">Captured:</span> {new Date(o.captured_at).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Legend</div>
            <div className="flex flex-wrap items-center gap-4">
              {Object.entries(layerLegend).map(([type, meta]) => (
                <div key={type} className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ background: meta.bg }}
                  />
                  <span className="text-xs text-slate-700">{meta.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">Interventions</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {interventions.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {interventions.map((int) => {
                const atRisk = int.impactScore < 35;
                const active = selectedId === int.id;
                return (
                  <button
                    key={int.id}
                    onClick={() => handleListClick(int)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      active
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900 text-sm">{int.id}</div>
                      <span
                        className={`w-2 h-2 rounded-full ${atRisk ? 'bg-red-500' : 'bg-emerald-500'}`}
                      />
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{int.type} · {int.village}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusBadgeClass(int.impactScore)}`}>
                        {getStatusLabel(int.impactScore)}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{int.impactScore}/100</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {fieldObservations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900">Field Detections (AI)</h3>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  {fieldObservations.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {fieldObservations.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setFlyTo([o.latitude, o.longitude])}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 capitalize">{o.detected_class.replace('_', ' ')}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-700">{(o.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">{o.image_filename}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
