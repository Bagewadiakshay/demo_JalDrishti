export default function About() {
  const architecture = [
    {
      title: 'Frontend',
      items: ['React 18 + TypeScript', 'Vite', 'Tailwind CSS', 'Leaflet + React-Leaflet', 'Recharts', 'React Router'],
      color: 'from-blue-500 to-indigo-600',
      icon: '🖥️',
    },
    {
      title: 'Service Layer (Mock → API)',
      items: [
        'interventionService.getInterventions() → GET /api/interventions',
        'interventionService.analyzeImage() → POST /api/ai/analyze',
        'interventionService.getSatelliteMetrics() → GET /api/satellite/:id',
        'spatialService.getWatershedBoundary() → PostGIS / GeoServer WFS',
      ],
      color: 'from-emerald-500 to-teal-600',
      icon: '🔌',
    },
    {
      title: 'Future Backend',
      items: ['FastAPI', 'PostgreSQL + PostGIS', 'Redis (caching)', 'Celery / RQ (async tasks)'],
      color: 'from-violet-500 to-purple-600',
      icon: '⚙️',
    },
    {
      title: 'Future Data Sources',
      items: [
        'Sentinel-2 (Sentinel Hub / EarthSearch)',
        'SRISHTI-DRISHTI portal',
        'IMD / GPM rainfall',
        'ALOS PALSAR / Cartosat DEM',
        'PostGIS raster data cube',
      ],
      color: 'from-amber-500 to-orange-600',
      icon: '🛰️',
    },
  ];

  const extensionPoints = [
    { file: 'interventionService.ts', label: 'Mock AI analysis →', note: 'Replace stub with real YOLO / ViT inference endpoint' },
    { file: 'interventionService.ts', label: 'Satellite metrics →', note: 'Connect to Sentinel-2 / SRISHTI pipeline' },
    { file: 'spatialService (watershed boundary)', label: 'Watershed polygon →', note: 'Fetch from PostGIS / GeoServer WFS' },
    { file: 'spatialService (drainage)', label: 'Drainage + DEM →', note: 'Integrate DEM-derived slope / flow accumulation' },
    { file: 'recommendationEngine.ts', label: 'Rule-based recs →', note: 'Upgrade to ML model or LLM (RAG on manuals)' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="text-center max-w-3xl mx-auto">
        
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          AI-Powered GeoSpatial Watershed Monitoring
          <br />
          <span className="bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">
            and Impact Assessment Platform
          </span>
        </h1>
       
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-1">System Overview</h2>
        <p className="text-sm text-slate-600 mb-6">
          The hierarchy is <strong className="text-slate-800">GIS + Field Evidence + Satellite Indicators</strong> →
          Interpretation → Impact Assessment → Decision Support.
          AI is one component — not the entire system.
        </p>

        <ol className="relative border-l-2 border-blue-200 ml-3 space-y-6">
          {[
            { step: '1', title: 'Geo-tagged Field Image', desc: 'Field photographs captured with GPS coordinates during surveys.' },
            { step: '2', title: 'AI Image Assessment', desc: 'Demo inference pipeline: object detection (type), condition classification, water presence. Currently rule-based; replace with YOLO / ViT later.' },
            { step: '3', title: 'Intervention Identification', desc: 'Records are matched against the intervention registry (ID, type, village, construction year).' },
            { step: '4', title: 'GIS Location', desc: 'Interventions are placed in watershed context — boundary, drainage, village polygons, administrative boundaries.' },
            { step: '5', title: 'Satellite Indicators', desc: 'NDVI (vegetation), NDWI (water), Water Area extents. Before/after and time-series views.' },
            { step: '6', title: 'Before vs After Comparison', desc: 'Paired metrics clearly presented for each site, normalized by rainfall context.' },
            { step: '7', title: 'Impact Score', desc: 'Weighted multi-criteria prototype score (30% Veg, 25% Water, 15% Land, 15% Structure, 10% Hydro, 5% Rainfall).' },
            { step: '8', title: 'Recommendation', desc: 'Rule-based engine today; ML / LLM recommendation system in the next iteration.' },
          ].map((s) => (
            <li key={s.step} className="ml-6">
              <span className="absolute -left-[15px] w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                {s.step}
              </span>
              <div className="font-semibold text-slate-900">{s.title}</div>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

     
    
    </div>
  );
}
