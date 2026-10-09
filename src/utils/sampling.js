import { haversineDistance } from './haversine.js'

/**
 * Walk a polyline and emit roughly one sample every `intervalMeters`.
 *
 * @param {Array<[number, number]>} points [[lat, lng], ...] route geometry
 * @param {number} intervalMeters desired spacing between samples
 * @param {number} maxSamples hard cap; the interval grows to respect it
 * @returns {Array<[number, number]>} sampled coordinates, first and last always included
 */
export function samplePolyline(points, intervalMeters = 500, maxSamples = 30) {
  if (!Array.isArray(points) || points.length === 0) return []
  if (points.length === 1) return [[points[0][0], points[0][1]]]

  const coords = points.filter(
    (p) => Array.isArray(p) && Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]),
  )
  if (coords.length < 2) return coords.length === 1 ? [coords[0]] : []

  // --- total length, used to size the interval so we never exceed maxSamples ---
  let totalLength = 0
  for (let i = 1; i < coords.length; i += 1) {
    totalLength += haversineDistance(
      { lat: coords[i - 1][0], lng: coords[i - 1][1] },
      { lat: coords[i][0], lng: coords[i][1] },
    )
  }
  if (totalLength === 0) return [coords[0], coords[coords.length - 1]]

  // A cap of N samples can only fit N-1 gaps, so the interval has to be at
  // least totalLength/(maxSamples-1). This is what protects us from a
  // 2000 km route turning into thousands of API calls.
  const floorInterval = totalLength / Math.max(1, maxSamples - 1)
  const effectiveInterval = Math.max(intervalMeters, floorInterval)

  const samples = [[coords[0][0], coords[0][1]]]
  let accumulated = 0

  for (let i = 1; i < coords.length; i += 1) {
    const prev = coords[i - 1]
    const curr = coords[i]

    let segmentLength = haversineDistance(
      { lat: prev[0], lng: prev[1] },
      { lat: curr[0], lng: curr[1] },
    )
    if (segmentLength === 0) continue

    // Consume this segment, emitting a sample at each interval boundary.
    let travelled = 0
    while (accumulated + (segmentLength - travelled) >= effectiveInterval) {
      const needed = effectiveInterval - accumulated
      travelled += needed

      const ratio = segmentLength === 0 ? 0 : travelled / segmentLength
      samples.push([
        prev[0] + (curr[0] - prev[0]) * ratio,
        prev[1] + (curr[1] - prev[1]) * ratio,
      ])

      accumulated = 0
      // Hard stop: the interval maths can still overshoot by one on rounding.
      if (samples.length >= maxSamples) break
    }

    if (samples.length >= maxSamples) break
    accumulated += segmentLength - travelled
  }

  const last = coords[coords.length - 1]
  const tail = samples[samples.length - 1]
  const tailIsLast =
    Math.abs(tail[0] - last[0]) < 1e-9 && Math.abs(tail[1] - last[1]) < 1e-9

  if (!tailIsLast && samples.length < maxSamples) {
    samples.push([last[0], last[1]])
  }

  return samples
}

/**
 * Per-sample segment lengths for a sampled polyline.
 * Returns an array of length samples.length - 1 (distance from i to i+1).
 */
export function segmentLengths(samples) {
  if (!Array.isArray(samples) || samples.length < 2) return []

  const lengths = []
  for (let i = 1; i < samples.length; i += 1) {
    lengths.push(
      haversineDistance(
        { lat: samples[i - 1][0], lng: samples[i - 1][1] },
        { lat: samples[i][0], lng: samples[i][1] },
      ),
    )
  }
  return lengths
}