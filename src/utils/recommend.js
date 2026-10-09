import { dijkstraFastest, dijkstraCleanest } from '../algorithms/dijkstra.js'
import { debugError } from './debug.js'

/**
 * Min-max normalise a list of numbers into 0..1.
 * With a single value (or when every value is identical) there is nothing
 * to compare, so the midpoint 0.5 is returned for all of them — which keeps
 * the slider meaningful instead of letting noise decide.
 */
export function minMaxNormalize(values) {
  const nums = values.filter((v) => Number.isFinite(v))
  if (nums.length === 0) return values.map(() => 0.5)

  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min

  if (Math.abs(span) < 1e-9) return values.map(() => 0.5)
  return values.map((v) => (Number.isFinite(v) ? (v - min) / span : 0.5))
}

/**
 * Choose a recommended route from scored routes.
 *
 *   score_i = timeNorm_i × (1 − sliderWeight) + pollutionNorm_i × sliderWeight
 *
 * Both dimensions are min-max normalised across the candidate set, so the
 * slider has a visible effect even when the raw units differ wildly
 * (seconds vs an AQI index). `timeNorm`/`pollutionNorm` are 0..1 and LOWER
 * is better, so the minimum combined score wins.
 *
 * @param {Array<object>} scoredRoutes
 * @param {number} sliderWeight 0 = fastest, 1 = cleanest
 * @returns {{recommendedId:string|null, items:Array<object>}}
 */
export function recommendRoutes(scoredRoutes, sliderWeight) {
  const routes = Array.isArray(scoredRoutes) ? scoredRoutes : []
  if (routes.length === 0) return { recommendedId: null, items: [] }

  try {
    const w = Math.min(1, Math.max(0, Number(sliderWeight) || 0))

    const timeNorm = minMaxNormalize(routes.map((r) => r.durationSeconds))
    const pollutionNorm = minMaxNormalize(
      // A route whose AQI calls all failed has no pollution signal, so it
      // should not win on a fabricated number — neutral 0.5 lets time decide.
      routes.map((r) => (r.fallback ? Number.NaN : r.exposureScore)),
    )

    const items = routes.map((route, i) => {
      const combined = timeNorm[i] * (1 - w) + pollutionNorm[i] * w
      return {
        id: route.id,
        timeNorm: timeNorm[i],
        pollutionNorm: pollutionNorm[i],
        combined,
        exposureIndex: Math.round(pollutionNorm[i] * 100),
      }
    })

    const winner = items.reduce((best, item) =>
      item.combined < best.combined ? item : best,
    )

    return { recommendedId: winner.id, items }
  } catch (err) {
    debugError('recommendRoutes failed:', err?.message)
    return { recommendedId: routes[0]?.id ?? null, items: [] }
  }
}

/**
 * Run both Dijkstra modes over one scored route to produce the numbers shown
 * in the "Why this route?" panel.
 *
 * `cost` is in seconds of travel time: fastest returns raw time, cleanest
 * returns the pollution-inflated cost, which is why the cleanest cost is
 * always >= the fastest cost at the same slider weight.
 *
 * @returns {{fastest:object, cleanest:object, timeCostPenaltyPct:number,
 *            aqiReductionPct:number}}
 */
export function analyseRoute(scoredRoute, sliderWeight = 1) {
  const samples = Array.isArray(scoredRoute?.samples) ? scoredRoute.samples : []
  const avgSpeedMps = Number(scoredRoute?.avgSpeedMps) || 0

  try {
    const fastest = dijkstraFastest(samples, avgSpeedMps)
    const cleanest = dijkstraCleanest(samples, avgSpeedMps, sliderWeight)

    const timeCostPenaltyPct =
      fastest.totalCost > 0
        ? ((cleanest.totalCost - fastest.totalCost) / fastest.totalCost) * 100
        : 0

    const aqiReductionPct =
      fastest.avgAqiAlongPath > 0
        ? ((fastest.avgAqiAlongPath - cleanest.avgAqiAlongPath) /
            fastest.avgAqiAlongPath) *
          100
        : 0

    return { fastest, cleanest, timeCostPenaltyPct, aqiReductionPct }
  } catch (err) {
    debugError('analyseRoute failed:', err?.message)
    return {
      fastest: { totalCost: 0, pathLength: 0, avgAqiAlongPath: 0 },
      cleanest: { totalCost: 0, pathLength: 0, avgAqiAlongPath: 0 },
      timeCostPenaltyPct: 0,
      aqiReductionPct: 0,
    }
  }
}

/** Map a US AQI reading to a traffic-light category. */
export function aqiCategory(aqi) {
  if (!Number.isFinite(aqi)) return { label: 'Unknown', dot: '#94a3b8', tone: 'slate' }
  if (aqi <= 50) return { label: 'Good', dot: '#22c55e', tone: 'green' }
  if (aqi <= 100) return { label: 'Moderate', dot: '#eab308', tone: 'yellow' }
  if (aqi <= 150) return { label: 'Unhealthy (sensitive)', dot: '#f97316', tone: 'orange' }
  return { label: 'Unhealthy', dot: '#ef4444', tone: 'red' }
}