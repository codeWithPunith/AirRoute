/**
 * Haversine great-circle distance between two { lat, lng } points.
 * Phase 1 does not call this for routing (OSRM returns authoritative
 * distances) — it is here for the later scoring phase.
 */
export function haversineDistance(a, b) {
  if (!a || !b) return 0

  const R = 6371008.8 // mean Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Metres -> kilometres string with one decimal, per the Phase 1 spec. */
export function formatDistanceKm(meters, decimals = 1) {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return '—'
  return (meters / 1000).toFixed(decimals)
}

export function formatMinutes(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '—'
  return Math.round(seconds / 60)
}

export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '—'
  const totalMin = Math.round(seconds / 60)
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours === 0) return `${mins} min`
  return `${hours} h ${mins} min`
}