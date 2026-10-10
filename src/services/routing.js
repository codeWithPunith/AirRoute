import axios from 'axios'
import { debug, debugError } from '../utils/debug.js'

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

const http = axios.create({ timeout: 20000 })

/** Carries the OSRM `code` so the UI can surface it verbatim in a banner. */
export class RoutingError extends Error {
  constructor(message, code = null) {
    super(message)
    this.name = 'RoutingError'
    this.code = code
  }
}

/** GeoJSON [lng, lat] tuples -> Leaflet-friendly [lat, lng] pairs. */
function toLatLngPairs(coordinates) {
  if (!Array.isArray(coordinates)) return []
  return coordinates
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => [Number(lat), Number(lng)])
    .filter(
      ([lat, lng]) =>
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180,
    )
}

function parseRoutes(data) {
  if (!Array.isArray(data?.routes)) return []
  return data.routes.map((route, index) => ({
    id: `route-${index}`,
    distanceMeters: Number(route.distance) || 0,
    durationSeconds: Number(route.duration) || 0,
    geometry: toLatLngPairs(route.geometry?.coordinates),
    isFallback: false,
  }))
}

async function requestRoutes(start, end, params) {
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`
  const { data } = await http.get(`${OSRM_BASE}/${coords}`, { params })

  if (data?.code !== 'Ok') {
    throw new RoutingError(
      data?.message || 'The routing service rejected this request.',
      data?.code ?? 'Unknown',
    )
  }
  return parseRoutes(data)
}

/**
 * Fetch up to two alternative driving routes between two points.
 *
 * @param {{lat:number,lng:number}} start
 * @param {{lat:number,lng:number}} end
 * @returns {Promise<Array<{id:string,distanceMeters:number,durationSeconds:number,geometry:Array<[number,number]>,isFallback:boolean}>>}
 *          Resolves to a 1–2 element array. Rejects with {@link RoutingError}
 *          only when OSRM reports a non-'Ok' code or the network fails.
 */
export async function getRoutes(start, end) {
  try {
    const routes = await requestRoutes(start, end, {
      alternatives: true,
      geometries: 'geojson',
      overview: 'full',
      steps: false,
    })

    if (routes.length >= 2) return routes.slice(0, 2)

    const [only] = routes
    if (!only) {
      throw new RoutingError('No route found between these points.', 'NoRoute')
    }

    // OSRM sometimes has no genuine alternative. Retry while avoiding
    // motorways so the user still gets a second, meaningfully different path.
    //
    // NOTE: the public router.project-osrm.org demo server has the `exclude`
    // flag disabled and answers "Exclude flag combination is not supported."
    // The catch below therefore normally wins, and we degrade to one route.
    // Self-hosted OSRM (or a provider that enables it) gets the real fallback.
    debug('single route returned, retrying with exclude=motorway')
    try {
      const alternatives = await requestRoutes(start, end, {
        alternatives: true,
        geometries: 'geojson',
        overview: 'full',
        steps: false,
        exclude: 'motorway',
      })

      const candidate = alternatives.find(
        (r) => r.geometry.length > 1 && r.distanceMeters !== only.distanceMeters,
      )

      if (!candidate) return [only]

      return [only, { ...candidate, id: 'route-1', isFallback: true }]
    } catch (fallbackErr) {
      // Expected on the public demo server, which rejects `exclude` with a
      // 400. This is normal degradation to a single route, not a real error,
      // so it logs at debug level rather than error level.
      debug('no motorway-free alternative available:', fallbackErr?.message)
      return [only]
    }
  } catch (err) {
    if (err instanceof RoutingError) throw err
    debugError('getRoutes failed:', err?.message)
    throw new RoutingError(
      'Could not reach the routing service. Check your connection and try again.',
      'NetworkError',
    )
  }
}