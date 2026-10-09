import axios from 'axios'
import { debugError } from '../utils/debug.js'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

// Nominatim's usage policy asks for an identifying User-Agent.
// Browsers block setting it, but a Referer + custom header still helps
// operators identify traffic coming from this demo.
const geoClient = axios.create({
  baseURL: NOMINATIM_BASE,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
    'Accept-Language': 'en',
  },
})

/**
 * Forward geocode a free-text query.
 * @param {string} query
 * @returns {Promise<Array<{ display_name: string, lat: number, lon: number }>>}
 *          Resolves to [] on any failure (never rejects).
 */
export async function searchPlaces(query) {
  const trimmed = (query || '').trim()
  if (trimmed.length < 3) return []

  try {
    const { data } = await geoClient.get('/search', {
      params: {
        format: 'json',
        q: trimmed,
        limit: 5,
        addressdetails: 0,
      },
    })

    if (!Array.isArray(data)) return []

    return data.map((hit) => ({
      display_name: hit.display_name,
      lat: Number(hit.lat),
      lon: Number(hit.lon),
    }))
  } catch (err) {
    debugError('searchPlaces failed:', err?.message)
    return []
  }
}

/**
 * Reverse geocode a coordinate pair.
 * @returns {Promise<string|null>} display_name, or null on failure.
 */
export async function reverseGeocode(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null

  try {
    const { data } = await geoClient.get('/reverse', {
      params: {
        format: 'json',
        lat,
        lon,
      },
    })

    return data?.display_name ?? null
  } catch (err) {
    debugError('reverseGeocode failed:', err?.message)
    return null
  }
}