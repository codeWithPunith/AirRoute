import { samplePolyline, segmentLengths } from '../utils/sampling.js'
import { getAirQualityBatch } from './airQuality.js'
import { debugError } from '../utils/debug.js'

export const DEFAULT_MAX_SAMPLES = 30
const SAMPLE_INTERVAL_METERS = 500

/**
 * Length-weighted average AQI along a route.
 *
 *   exposureScore = Σ (sampleAQI[i] × segmentLength[i]) / Σ segmentLength[i]
 *
 * Each segment is attributed the AQI of its *starting* sample (left
 * endpoint). Segments near the cap are truncated in the denominator by
 * `segmentLengths`, which returns one length per consecutive pair.
 *
 * @param {Array<{lat:number,lng:number,aqi:number}>} samples
 * @param {number[]} lengths one length per consecutive sample pair
 * @returns {number}
 */
export function computeExposure(samples, lengths) {
  const total = lengths.reduce((sum, len) => sum + len, 0)
  if (total <= 0) {
    // Degenerate geometry (start === end): fall back to a plain mean.
    const values = samples.map((s) => s.aqi).filter(Number.isFinite)
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  let weighted = 0
  for (let i = 0; i < lengths.length; i += 1) {
    const aqi = samples[i]?.aqi
    weighted += (Number.isFinite(aqi) ? aqi : 0) * lengths[i]
  }
  return weighted / total
}

/**
 * Sample a route, fetch real AQI for each sample, and compute exposure.
 *
 * Never rejects: an unreachable AQI API degrades every sample to the
 * neutral default and flags the route with `fallback: true`.
 *
 * @param {{geometry:Array<[number,number]>,distanceMeters:number,durationSeconds:number}} route
 * @returns {Promise<object>} the original route plus samples/exposure fields
 */
export async function scoreRoute(route, maxSamples = DEFAULT_MAX_SAMPLES) {
  const base = { ...route }

  try {
    const coords = samplePolyline(
      Array.isArray(route?.geometry) ? route.geometry : [],
      SAMPLE_INTERVAL_METERS,
      maxSamples,
    )

    if (coords.length === 0) {
      return {
        ...base,
        samples: [],
        exposureScore: 0,
        avgAqi: 0,
        avgSpeedMps: 0,
        fallback: true,
      }
    }

    const readings = await getAirQualityBatch(
      coords.map(([lat, lng]) => ({ lat, lng })),
    )

    // Align readings to samples defensively: a short response must not
    // shift every subsequent value by one position.
    const samples = coords.map(([lat, lng], i) => ({
      lat,
      lng,
      aqi: Number.isFinite(readings[i]?.aqi) ? readings[i].aqi : 50,
      fallback: Boolean(readings[i]?.fallback),
    }))

    const lengths = segmentLengths(coords)
    const exposureScore = computeExposure(samples, lengths)

    // Average speed is what Dijkstra assumes is uniform along the route.
    const avgSpeedMps =
      route?.durationSeconds > 0 ? route.distanceMeters / route.durationSeconds : 0

    // `fallback` on the ROUTE means literally every sample failed.
    const allFailed = samples.every((s) => s.fallback)

    return {
      ...base,
      samples,
      lengths,
      exposureScore,
      avgAqi: exposureScore, // display alias, per spec
      avgSpeedMps,
      fallback: allFailed,
    }
  } catch (err) {
    debugError('scoreRoute failed:', err?.message)
    return {
      ...base,
      samples: [],
      exposureScore: 0,
      avgAqi: 0,
      avgSpeedMps: 0,
      fallback: true,
    }
  }
}

/**
 * Score every route in parallel. Individual failures degrade that route
 * only — one bad route can never prevent the others from scoring.
 *
 * @param {Array<object>} routes
 * @returns {Promise<Array<object>>}
 */
export async function scoreAllRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) return []

  try {
    return await Promise.all(
      routes.map(async (route) => {
        try {
          return await scoreRoute(route)
        } catch (err) {
          debugError('scoreRoute threw unexpectedly:', err?.message)
          return { ...route, samples: [], exposureScore: 0, avgAqi: 0, avgSpeedMps: 0, fallback: true }
        }
      }),
    )
  } catch (err) {
    debugError('scoreAllRoutes failed:', err?.message)
    return []
  }
}