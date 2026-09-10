import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldObservation, DetectionClass } from '../types';
import { imageryService, DETECTION_CLASS_LABELS } from '../services/imageryService';

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface QueuedImage {
  file: File;
  previewUrl: string;
  status: UploadStatus;
  detections?: { detected_class: DetectionClass; confidence: number }[];
  error?: string;
}

const ACCEPT = 'image/jpeg,image/png,image/jpg';
const DETECTION_COLORS: Record<DetectionClass, string> = {
  check_dam: '#0ea5e9',
  farm_pond: '#14b8a6',
  plantation: '#22c55e',
  vegetation: '#84cc16',
  water_body: '#06b6d4',
  unclassified: '#94a3b8',
};

export default function GeoImageUploadPanel() {
  const [overallStatus, setOverallStatus] = useState<UploadStatus>('idle');
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      queue.forEach((q) => URL.revokeObjectURL(q.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };

  const enqueueFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => {
      if (!f.type.match(/^image\/(jpeg|png|jpg)$/i)) {
        showToast('err', `Skipped ${f.name}: only JPEG/PNG accepted`);
        return false;
      }
      return true;
    });
    if (!files.length) return;
    const next: QueuedImage[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
    }));
    setQueue((prev) => [...prev, ...next]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) enqueueFiles(e.dataTransfer.files);
    },
    [enqueueFiles]
  );

  const runUpload = async () => {
    const pending = queue.filter((q) => q.status === 'idle' || q.status === 'error');
    if (!pending.length) {
      showToast('err', 'No pending images to process.');
      return;
    }
    setOverallStatus('uploading');
    setQueue((prev) =>
      prev.map((q) => (pending.includes(q) ? { ...q, status: 'processing', error: undefined } : q))
    );

    try {
      const files = pending.map((q) => q.file);
      const result = await imageryService.uploadGeotaggedImages(files);

      const byFilename = new Map<string, FieldObservation[]>();
      for (const f of result.featureCollection.features) {
        const k = f.image_filename;
        if (!byFilename.has(k)) byFilename.set(k, []);
        byFilename.get(k)!.push(f);
      }

      setQueue((prev) =>
        prev.map((q) => {
          if (!pending.includes(q)) return q;
          const obs = byFilename.get(q.file.name) ?? [];
          return {
            ...q,
            status: 'done',
            detections: obs.map((o) => ({
              detected_class: o.detected_class,
              confidence: o.confidence,
            })),
          };
        })
      );
      setOverallStatus('done');

      if (result.featureCollection.features.length) {
        const ev = new CustomEvent<FieldObservation[]>('map:updateFieldObservations', {
          detail: result.featureCollection.features,
        });
        window.dispatchEvent(ev);
      }
      showToast(
        'ok',
        `${result.imagesProcessed} image${result.imagesProcessed === 1 ? '' : 's'} processed, ` +
          `${result.featuresDetected} feature${result.featuresDetected === 1 ? '' : 's'} detected.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setQueue((prev) =>
        prev.map((q) => (pending.includes(q) ? { ...q, status: 'error', error: msg } : q))
      );
      setOverallStatus('error');
      showToast('err', `Processing failed: ${msg}`);
    }
  };

  const removeItem = (idx: number) => {
    setQueue((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].previewUrl);
      next.splice(idx, 1);
      return next;
    });
  };

  const clearAll = () => {
    queue.forEach((q) => URL.revokeObjectURL(q.previewUrl));
    setQueue([]);
    setOverallStatus('idle');
  };

  const pendingCount = queue.filter((q) => q.status === 'idle' || q.status === 'error').length;
  const busy = overallStatus === 'uploading' || overallStatus === 'processing';

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
            📷
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Geotagged Field Imagery</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              JPEG / PNG with EXIF GPS — detected features appear on the map and analytics.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={runUpload}
            disabled={!pendingCount || busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy
              ? overallStatus === 'uploading'
                ? 'Uploading…'
                : 'Detecting…'
              : pendingCount
                ? `Process ${pendingCount}`
                : 'Process'}
          </button>
        </div>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`mx-6 my-5 border-[1px] border-dashed rounded-lg py-10 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
        }`}
      >
        <div className="text-2xl mb-2">🗺️</div>
        <div className="text-sm font-medium text-slate-800">
          Drop JPEG/PNG here, or <span className="underline decoration-slate-300 underline-offset-4">browse files</span>
        </div>
        <div className="text-xs text-slate-400 mt-1.5">
          Multiple files · GPS coordinates extracted from EXIF
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) enqueueFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {queue.length > 0 && (
        <div className="px-6 pb-6">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-3">
            {queue.length} file{queue.length === 1 ? '' : 's'} queued
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {queue.map((q, idx) => (
              <div
                key={`${q.file.name}-${idx}`}
                className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
              >
                <div className="aspect-square bg-slate-100 overflow-hidden">
                  <img
                    src={q.previewUrl}
                    alt={q.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {q.status === 'processing' && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {q.status === 'done' && q.detections && q.detections.length > 0 && (
                  <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1 max-w-[80%]">
                    {q.detections.slice(0, 3).map((d, di) => (
                      <span
                        key={di}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                        style={{ background: DETECTION_COLORS[d.detected_class] }}
                      >
                        {DETECTION_CLASS_LABELS[d.detected_class]} · {Math.round(d.confidence * 100)}%
                      </span>
                    ))}
                  </div>
                )}
                {q.status === 'error' && (
                  <div className="absolute top-1.5 right-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500 text-white shadow-sm">
                      Failed
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(idx);
                  }}
                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/90 text-slate-600 text-xs font-semibold opacity-0 group-hover:opacity-100 hover:bg-white transition-opacity shadow-sm"
                  aria-label="Remove file"
                >
                  ✕
                </button>
                <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                  <div className="text-[10px] text-slate-500 truncate" title={q.file.name}>
                    {q.file.name}
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">
                    {(q.file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center gap-2 ${
              toast.kind === 'ok'
                ? 'bg-white text-slate-900 border-slate-200'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}
          >
            <span>{toast.kind === 'ok' ? '✅' : '⚠️'}</span>
            {toast.msg}
          </div>
        </div>
      )}
    </section>
  );
}
