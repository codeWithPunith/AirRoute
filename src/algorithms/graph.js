import { haversineDistance } from '../utils/haversine.js'

/** How many samples ahead a shortcut edge may reach. */
const MAX_HOPS = 3

/**
 * Unreachable-destination contract, shared by both Dijkstra entry points.
 *
 * `totalCost` is `Infinity` (not null) so callers can keep doing arithmetic,
 * but note `Infinity` serialises to `null` under JSON.stringify — always
 * guard with Number.isFinite before showing it to a user.
 */
export function unreachableResult() {
  return {
    totalCost: Infinity,
    pathLength: 0,
    avgAqiAlongPath: 0,
    visited: 0,
    path: [],
  }
}

/**
 * Build the adjacency list for a sampled route.
 *
 * Nodes are the sampled points. Edges are NOT limited to consecutive
 * samples: each node also connects to the next few samples, giving the
 * search genuine alternative paths. A bare chain has exactly ONE simple
 * path, so a "cleanest" search over it would be meaningless — it would
 * return the same road no matter how dirty that road was.
 *
 * Shortcuts stay deliberately local (capped in metres, not just in hops)
 * so the graph cannot collapse into a single direct start->end edge, which
 * would trivially skip every intermediate sample.
 *
 * @param {Array<{lat:number,lng:number,aqi:number}>} samples
 * @param {number} avgSpeedMps route distance / duration
 * @param {(seconds:number, aqi:number, lengthMeters:number, skippedAqi:number)=>number} costFn
 * @returns {{nodes:Array, adjacency:Map<number, Array<{to:number,weight:number,lengthMeters:number}>>}}
 */
export function buildGraph(samples, avgSpeedMps, costFn) {
  const nodes = []
  const adjacency = new Map()

  for (let i = 0; i < samples.length; i += 1) {
    nodes.push(samples[i])
    adjacency.set(i, [])
  }

  const spacings = []
  for (let i = 1; i < samples.length; i += 1) {
    spacings.push(
      haversineDistance(
        { lat: samples[i - 1].lat, lng: samples[i - 1].lng },
        { lat: samples[i].lat, lng: samples[i].lng },
      ),
    )
  }
  const nominalSpacing =
    spacings.reduce((a, b) => a + b, 0) / Math.max(1, spacings.length)
  const MAX_SHORTCUT_METERS = Math.max(nominalSpacing * MAX_HOPS * 1.5, 1)

  for (let i = 0; i < samples.length; i += 1) {
    const from = samples[i]

    for (let hop = 1; hop <= MAX_HOPS; hop += 1) {
      const j = i + hop
      if (j >= samples.length) break

      const to = samples[j]
      const lengthMeters = haversineDistance(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng },
      )

      // A "shortcut" that skips a lot of road is not a shortcut, it is a
      // different and longer journey — only keep genuinely local hops.
      if (lengthMeters > MAX_SHORTCUT_METERS) break

      // UNIFORM SPEED ASSUMPTION: OSRM returns a single duration for the
      // whole route, so per-segment time is derived by assuming the vehicle
      // holds the route's average speed the entire way. Real traffic varies
      // segment to segment, but the API exposes no per-segment timings.
      const segmentSeconds = avgSpeedMps > 0 ? lengthMeters / avgSpeedMps : lengthMeters

      // A shortcut absorbs the nodes it steps over implicitly, so those are
      // counted too — that is what lets the search pay for bypassing a
      // dirty sample rather than ignoring it for free.
      let skippedAqi = 0
      for (let s = i + 1; s < j; s += 1) skippedAqi += samples[s]?.aqi ?? 0

      const weight = costFn(segmentSeconds, from.aqi, lengthMeters, skippedAqi)

      adjacency.get(i).push({ to: j, weight, lengthMeters })
      adjacency.get(j).push({ to: i, weight, lengthMeters })
    }
  }

  return { nodes, adjacency }
}

/**
 * Length-weighted average AQI over a reconstructed path.
 *
 * Weighting by metres (rather than a plain mean over path segments) keeps
 * this number comparable with computeExposure() in scoring.js: two paths
 * over identical ground get compared on equal terms even when one was
 * subdivided differently (this algorithm deliberately uses shortcut edges).
 */
export function averageAqiAlongPath(nodes, path) {
  let pathLength = 0
  let weightedAqi = 0

  for (let i = 1; i < path.length; i += 1) {
    const a = nodes[path[i - 1]]
    const b = nodes[path[i]]
    const segmentLength = haversineDistance(
      { lat: a.lat, lng: a.lng },
      { lat: b.lat, lng: b.lng },
    )
    pathLength += segmentLength
    weightedAqi += (a.aqi ?? 0) * segmentLength
  }

  return { pathLength, avgAqi: pathLength > 0 ? weightedAqi / pathLength : (nodes[0]?.aqi ?? 0) }
}