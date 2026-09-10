import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center">
        <div className="text-7xl font-black text-slate-200 select-none">404</div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-slate-600 max-w-md mx-auto">
          The page you're looking for doesn't exist, or an intervention with this ID was not found in the demonstration dataset.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="px-5 py-2.5 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <Link
            to="/map"
            className="px-5 py-2.5 rounded-md border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            Open Watershed Map
          </Link>
        </div>
      </div>
    </div>
  );
}
