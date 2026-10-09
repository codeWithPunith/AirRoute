import { useMemo } from 'react'
import LocationInput from './LocationInput.jsx'
import RouteCard from './RouteCard.jsx'
import PrioritySlider from './PrioritySlider.jsx'
import WhyPanel from './WhyPanel.jsx'

/** Fastest route is labelled "Fastest", any sibling becomes "Alternative". */
function useRouteLabels(scoredRoutes) {
  return useMemo(() => {
    if (scoredRoutes.length < 2) return scoredRoutes.map((_, i) => `Route ${i + 1}`)

    const fastestId = scoredRoutes.reduce((best, r) =>
      r.durationSeconds < best.durationSeconds ? r : best,
    ).id

    return scoredRoutes.map((r) => (r.id === fastestId ? 'Fastest' : 'Alternative'))
  }, [scoredRoutes])
}

export default function RoutePanel({
  start,
  end,
  scoredRoutes,
  scoredById,
  recItemById,
  recommendedId,
  activeRouteId,
  sliderWeight,
  loading,
  scoring,
  error,
  airQualityDown,
  analysis,
  clickTarget,
  onStartSelect,
  onEndSelect,
  onFindRoutes,
  onRouteSelect,
  onSliderChange,
}) {
  const labels = useRouteLabels(scoredRoutes)
  const canSearch = Boolean(start && end) && !loading
  const multiRoute = scoredRoutes.length > 1

  const recommended = scoredById.get(recommendedId)
  const alternative = multiRoute
    ? scoredRoutes.find((r) => r.id !== recommendedId)
    : null

  return (
    <section className="flex h-full flex-col gap-4 overflow-y-auto bg-white p-4">
      <header>
        <h1 className="text-lg font-bold text-slate-900">AirRoute</h1>
        <p className="text-xs text-slate-500">
          Recommend the driving route with lower pollution exposure.
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
          placeholder="e.g. India Gate, New Delhi"
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
        {loading
          ? scoring
            ? 'Reading air quality…'
            : 'Finding routes…'
          : 'Find routes'}
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

      {airQualityDown && scoredRoutes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Air quality unavailable — using default score. Ranking is weighted
          toward time only.
        </div>
      )}

      {multiRoute && (
        <PrioritySlider value={sliderWeight} onChange={onSliderChange} />
      )}

      {scoredRoutes.length === 1 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          Only one route was returned for this pair, so there is nothing to
          compare — the priority slider is hidden.
        </p>
      )}

      {scoredRoutes.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Routes
          </h2>
          <div className="space-y-2">
            {scoredRoutes.map((route, index) => (
              <RouteCard
                key={route.id}
                route={route}
                index={index}
                label={labels[index]}
                isActive={activeRouteId === route.id}
                isRecommended={route.id === recommendedId}
                recItem={recItemById.get(route.id)}
                onSelect={() => onRouteSelect(route.id)}
              />
            ))}
          </div>
        </div>
      )}

      {recommended && (
        <WhyPanel
          recommended={recommended}
          alternative={alternative}
          analysis={analysis}
          sliderWeight={sliderWeight}
          airQualityDown={airQualityDown}
        />
      )}
    </section>
  )
}