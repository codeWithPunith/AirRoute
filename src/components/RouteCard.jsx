import { formatDistanceKm, formatDuration, formatMinutes } from '../utils/haversine.js'
import { aqiCategory } from '../utils/recommend.js'

const ROUTE_COLORS = ['#2563eb', '#f97316']

export default function RouteCard({
  route,
  index,
  label,
  isActive,
  isRecommended,
  recItem,
  onSelect,
}) {
  const cat = aqiCategory(route.exposureScore)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`w-full rounded-xl border p-3 text-left transition active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-sky-300 ${
        isRecommended
          ? 'border-emerald-400 bg-emerald-50 shadow-sm'
          : isActive
            ? 'border-sky-400 bg-sky-50 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: ROUTE_COLORS[index] ?? '#64748b' }}
        />
        <span className="text-sm font-semibold text-slate-800">{label}</span>

        {isRecommended && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            Recommended
          </span>
        )}
        {!isRecommended && route.isFallback && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            motorway-free
          </span>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <dt className="text-slate-400">Distance</dt>
          <dd className="font-medium text-slate-800">
            {formatDistanceKm(route.distanceMeters)} km
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Duration</dt>
          <dd className="font-medium text-slate-800">
            {formatMinutes(route.durationSeconds)} min
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Avg AQI</dt>
          <dd className="flex items-center gap-1.5 font-medium text-slate-800">
            {route.fallback ? (
              <span className="text-slate-400">n/a</span>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.dot }}
                />
                {Math.round(route.exposureScore)}
                <span className="truncate text-[10px] font-normal text-slate-400">
                  {cat.label}
                </span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Exposure index</dt>
          <dd className="font-medium text-slate-800">
            {recItem ? recItem.exposureIndex : '—'}
            <span className="text-[10px] font-normal text-slate-400"> / 100</span>
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[11px] text-slate-400">
        ≈ {formatDuration(route.durationSeconds)} driving ·{' '}
        {route.samples?.length ?? 0} samples
      </p>
    </button>
  )
}