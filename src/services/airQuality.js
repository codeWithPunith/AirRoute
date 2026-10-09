import axios from 'axios'
import { debug, debugError } from '../utils/debug.js'

const AQ_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const CURRENT_FIELDS = 'pm2_5,pm10,nitrogen_dioxide,ozone,us_aqi'

/** Neutral, healthy-but-not-pristine AQI used when the API is unreachable. */
const FALLBACK_AQI = 50

const http = axios.create({ timeout: 10000 })

const cache = new Map()

/**
 * sessionStorage is unavailable in some privacy modes; degrade to a
 * no-op cache rather than breaking the whole feature.
 */
function readCache(key) {
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota or privacy mode — the in-memory Map still works */
  }
}

/** Round to ~100 m so nearby samples share a cache entry. */
function cacheKey(lat, lon) {
  return `airroute:aq:${lat.toFixed(3)},${lon.toFixed(3)}`
}

function toReading(entry) {
  const current = entry?.current
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  return {
    aqi: num(current?.us_aqi),
    pm2_5: num(current?.pm2_5),
    pm10: num(current?.pm10),
    no2: num(current?.nitrogen_dioxide),
    o3: num(current?.ozone),
    fallback: false,
  }
}

function toFallback() {
  return { aqi: FALLBACK_AQI, pm2_5: null, pm10: null, no2: null, o3: null, fallback: true }
}

/**
 * Fetch current air quality for one coordinate. Never rejects.
 *
 * @returns {Promise<{aqi:number,pm2_5:number|null,pm10:number|null,
 *                    no2:number|null,o3:number|null,fallback:boolean}>}
 */
export async function getAirQuality(lat, lon) {
  try {
    if (typeof lat !== 'number' || typeof lon !== 'number') return toFallback()

    const key = cacheKey(lat, lon)
    if (cache.has(key)) return cache.get(key)

    const stored = readCache(key)
    if (stored) {
      cache.set(key, stored)
      return stored
    }

    const { data } = await http.get(AQ_BASE, {
      params: { latitude: lat, longitude: lon, current: CURRENT_FIELDS },
    })

    const reading = data?.current ? toReading(data) : toFallback()
    cache.set(key, reading)
    writeCache(key, reading)
    return reading
  } catch (err) {
    debugError('getAirQuality failed:', err?.message)
    return toFallback()
  }
}

/**
 * Fetch many coordinates in ONE request.
 *
 * Open-Meteo accepts comma-separated lat/lon and returns an array. This cuts
 * a 30-sample route from 30 requests down to 1, which matters a great deal
 * against a free, rate-limited API. Open-Meteo documents ~100 locations per
 * call; we stay well under that.
 *
 * @param {Array<{lat:number,lng:number}>} points
 * @returns {Promise<Array<{aqi:number,fallback:boolean}>>} aligned to `points`
 */
export async function getAirQualityBatch(points) {
  if (!Array.isArray(points) || points.length === 0) return []

  try {
    // Cache hits resolve instantly and need no network call at all.
    const resolved = await Promise.all(
      points.map(async (p) => {
        const key = cacheKey(p.lat, p.lng)
        if (cache.has(key)) return { hit: cache.get(key), cached: true }
        const stored = readCache(key)
        if (stored) {
          cache.set(key, stored)
          return { hit: stored, cached: true }
        }
        return { hit: null, cached: false }
      }),
    )

    const pendingIdx = resolved
      .map((r, i) => (r.cached ? -1 : i))
      .filter((i) => i !== -1)

    const fetched = new Map()

    if (pendingIdx.length > 0) {
      const params = {
        latitude: pendingIdx.map((i) => points[i].lat).join(','),
        longitude: pendingIdx.map((i) => points[i].lng).join(','),
        current: CURRENT_FIELDS,
      }
      const { data } = await http.get(AQ_BASE, { params })
      const list = Array.isArray(data) ? data : data ? [data] : []

      pendingIdx.forEach((pointIdx, n) => {
        const reading = list[n]?.current ? toReading(list[n]) : toFallback()
        fetched.set(pointIdx, reading)
        cache.set(cacheKey(points[pointIdx].lat, points[pointIdx].lng), reading)
        writeCache(cacheKey(points[pointIdx].lat, points[pointIdx].lng), reading)
      })
    }

    return points.map((p, i) => {
      const cached = resolved[i].hit
      if (cached) return cached
      const value = fetched.get(i) ?? toFallback()
      debug(`sample ${i} aqi=${value.aqi}${value.fallback ? ' (fallback)' : ''}`)
      return value
    })
  } catch (err) {
    debugError('getAirQualityBatch failed:', err?.message)
    // Every sample degrades independently to the neutral default.
    return points.map(() => toFallback())
  }
}

/** Exposed for tests / manual inspection. */
export function clearAirQualityCache() {
  cache.clear()
  try {
    Object.keys(window.sessionStorage)
      .filter((k) => k.startsWith('airroute:aq:'))
      .forEach((k) => window.sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}