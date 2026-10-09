import { useMemo } from 'react'
import LocationInput from './LocationInput'
import { formatDistanceKm, formatDuration, formatMinutes } from '@/utils/haversine'

const ROUTE_COLORS = ['#2563eb', '#f97316']

/** Fastest route is labelled "Fastest", any sibling becomes "Alternative". */
function useRouteLabels(routes) {
  return useMemo(() => {
    if (routes.length < 2) return routes.map((r, i) => `Route ${i + 1}`)

    const fastestId = routes.reduce((best, r) =>
      r.durationSeconds < best.durationSeconds ? r : best,
    ).id

    return routes.map((r) => (r.id === fastestId ? 'Fastest' : 'Alternative'))
  }, [routes])
}

function RouteCard({ route, index, label, isActive, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`w-full rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${
        isActive
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
        {route.isFallback && (
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
      </dl>

      <p className="mt-2 text-[11px] text-slate-400">
        ≈ {formatDuration(route.durationSeconds)} driving
      </p>
    </button>
  )
}

export default function RoutePanel({
  start,
  end,
  routes,
  activeRouteId,
  loading,
  error,
  clickTarget,
  onStartSelect,
  onEndSelect,
  onFindRoutes,
  onRouteSelect,
}) {
  const labels = useRouteLabels(routes)
  const canSearch = Boolean(start && end) && !loading

  return (
    <section className="flex h-full flex-col gap-4 overflow-y-auto bg-white p-4">
      <header>
        <h1 className="text-lg font-bold text-slate-900">AirRoute</h1>
        <p className="text-xs text-slate-500">
          Compare two driving routes between any two places.
        </p>
      </header>

      <div className="space-y-3">
        <LocationInput
          id="start-input"
          label="Start"
          placeholder="e.g. Connaught Place, New Delhi"
          value={start}
          onSelect={onStartSelect}
        />
        <LocationInput
          id="end-input"
          label="Destination"
          placeholder="e.g. HSR Layout, Bengaluru"
          value={end}
          onSelect={onEndSelect}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Tip: clicking the map fills in whichever point is next —{' '}
        <span className="font-medium text-slate-500">
          {clickTarget === 'start' ? 'the start' : 'the destination'}
        </span>
        .
      </p>

      <button
        type="button"
        onClick={onFindRoutes}
        disabled={!canSearch}
        className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {loading && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {loading ? 'Finding routes…' : 'Find routes'}
      </button>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <p className="font-semibold">
            Routing failed{error.code ? ` (${error.code})` : ''}
          </p>
          <p className="mt-0.5">{error.message}</p>
        </div>
      )}

      {routes.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Routes
          </h2>
          <div className="space-y-2">
            {routes.map((route, index) => (
              <RouteCard
                key={route.id}
                route={route}
                index={index}
                label={labels[index]}
                isActive={activeRouteId === route.id}
                onSelect={() => onRouteSelect(route.id)}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Select a card to highlight that route on the map.
          </p>
        </div>
      )}
    </section>
  )
}