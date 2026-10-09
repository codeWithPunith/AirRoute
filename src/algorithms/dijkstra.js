import { MinHeap } from './minHeap.js'
import { buildGraph, averageAqiAlongPath, unreachableResult } from './graph.js'

/**
 * Core Dijkstra over the sampled-route graph.
 *
 * @param {Array<{lat:number,lng:number,aqi:number}>} samples
 * @param {number} avgSpeedMps route distance / duration
 * @param {(seconds:number, aqi:number, lengthMeters:number, skippedAqi:number)=>number} costFn
 * @returns {{totalCost:number, pathLength:number, avgAqiAlongPath:number,
 *            visited:number, path:number[]}}
 */
export function dijkstra(samples, avgSpeedMps, costFn) {
  if (!Array.isArray(samples) || samples.length === 0) return unreachableResult()
  if (samples.length === 1) {
    return {
      totalCost: 0,
      pathLength: 0,
      avgAqiAlongPath: samples[0].aqi ?? 0,
      visited: 1,
      path: [0],
    }
  }

  const { nodes, adjacency } = buildGraph(samples, avgSpeedMps, costFn)
  const n = nodes.length

  const dist = new Array(n).fill(Infinity)
  const prev = new Array(n).fill(-1)
  const settled = new Array(n).fill(false)
  const heap = new MinHeap()

  dist[0] = 0
  heap.push(0, 0)

  let visited = 0

  while (heap.size > 0) {
    const current = heap.pop()

    // Skip stale entries: this node was already settled more cheaply.
    if (settled[current.id] || current.cost > dist[current.id]) continue

    settled[current.id] = true
    visited += 1

    if (current.id === n - 1) break // destination settled

    for (const edge of adjacency.get(current.id)) {
      if (settled[edge.to]) continue

      const candidate = current.cost + edge.weight
      if (candidate < dist[edge.to]) {
        dist[edge.to] = candidate
        prev[edge.to] = current.id
        heap.push(edge.to, candidate)
      }
    }
  }

  if (!Number.isFinite(dist[n - 1])) return unreachableResult()

  // Walk the predecessor chain back from the destination.
  const path = []
  for (let at = n - 1; at !== -1; at = prev[at]) path.unshift(at)

  const { pathLength, avgAqi } = averageAqiAlongPath(nodes, path)

  return {
    totalCost: dist[n - 1],
    pathLength,
    avgAqiAlongPath: avgAqi,
    visited,
    path,
  }
}

/**
 * Fastest mode: edge cost is travel time alone. Pollution is ignored.
 *
 * `totalCost` comes back in seconds of travel time.
 */
export function dijkstraFastest(samples, avgSpeedMps) {
  return dijkstra(samples, avgSpeedMps, (seconds) => seconds)
}

/**
 * Clean mode: edge cost is travel time inflated by pollution.
 *
 *   pollutionPenalty = (aqi / 100) × sliderWeight        sliderWeight ∈ [0,1]
 *   weight           = segmentDurationSeconds × (1 + pollutionPenalty)
 *
 * `aqi` is the AQI of the node the edge leaves plus half of whatever it
 * skips over — a shortcut crossing dirty ground is charged for it, which
 * is what stops the search from "avoiding" pollution for free.
 *
 * At sliderWeight = 0 this is identical to dijkstraFastest. At 1, an AQI
 * of 100 doubles a segment's cost and an AQI of 50 adds 50%.
 *
 * NOTE: `totalCost` is the inflated cost, NOT literal travel time — it is
 * always >= dijkstraFastest's cost at the same slider weight. That gap is
 * exactly the "time cost of insisting on clean air" the UI reports.
 */
export function dijkstraCleanest(samples, avgSpeedMps, sliderWeight = 1) {
  const w = Math.min(1, Math.max(0, Number(sliderWeight) || 0))

  return dijkstra(samples, avgSpeedMps, (seconds, aqi, lengthMeters, skippedAqi) => {
    const from = Number(aqi) || 0
    // A shortcut crosses ground rather than avoiding it, so charge the
    // average of the nodes it steps over, not their sum.
    const charge = skippedAqi > 0 ? from + skippedAqi / 2 : from

    const pollutionPenalty = (charge / 100) * w
    return seconds * (1 + pollutionPenalty)
  })
}