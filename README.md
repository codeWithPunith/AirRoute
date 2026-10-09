# AirRoute

Compare two driving routes between any two places, score both by **pollution
exposure**, and recommend the lower one. Client-side only: no backend, no API
keys.

> **Phase 2.** Phase 1 (the map, geocoding, and dual-route rendering) is
> unchanged underneath. See [DECISIONS.md](./DECISIONS.md) for the full
> rationale, including the honest limits of the air-quality data.

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

```bash
npm run build   # production build to dist/
npm run preview # serve the production build
npm run lint    # oxlint
```

## Try it in three steps

1. Enter **"Connaught Place, New Delhi"** as Start and **"Gurugram Cyber Hub"**
   as Destination, then press **Find routes**. Wait for the button to say
   *Reading air quality…* and finish.
2. Two coloured polylines appear — blue (`#2563eb`) and orange (`#f97316`) —
   each card showing distance, duration, an **Avg AQI** dot, and an
   **exposure index**.
3. Drag the **Priority: Fastest ←→ Cleanest** slider. Watch the **Recommended**
   badge move between cards as the weighting crosses the midpoint, and open
   **"Why this route?"** for the comparison.

> Use a **longer** pair than Connaught Place → India Gate. That is only 4.2 km
> and OSRM returns a single route for it, so the slider is correctly hidden.
> Gurugram, Noida Sec 18, and Ghaziabad were all tested; Gurugram reliably
> returns two.

## How the algorithm works

### 1. Sampling the route

Each route's geometry is walked and sampled every 500 m, capped at **30
samples**. If the route is long enough that 500 m spacing would exceed the
cap, the interval *grows* to `totalLength / (maxSamples - 1)` so samples stay
evenly spaced and the route is still fully covered. This is what protects the
free API from a 2000 km route generating thousands of requests.

### 2. Exposure score

AQI is fetched for every sample, then averaged **weighted by the length of
road each sample represents**:

```
exposureScore = Σ ( sampleAQI[i] × segmentLength[i] ) / Σ segmentLength[i]
```

Weighting matters. A plain average would treat a 200 m hop the same as a 5 km
one, so a route's score would depend on where the samples happened to land
rather than where the driving actually was.

### 3. Dijkstra weight

The samples form a graph. In **fastest** mode an edge costs only its travel
time. In **clean** mode the edge cost is inflated by the pollution it passes
through:

```
pollutionPenalty = ( aqi / 100 ) × sliderWeight        sliderWeight ∈ [0,1]
weight           = segmentDurationSeconds × (1 + pollutionPenalty)
```

At `sliderWeight = 0` clean mode is identical to fastest. At 1, an AQI of 100
doubles a segment's cost and an AQI of 50 adds 50% — so the cheapest path
trades time for cleaner air. Segment duration is derived from the route's
average speed (`distanceMeters / durationSeconds`) because OSRM returns a
single duration for the whole route, not per-segment timings.

Each node also connects to the next few samples, not just its neighbour.
A bare chain has exactly one simple path, which would make the search
meaningless; the extra local edges give it real alternatives.

### 4. Min-max normalisation for the slider

Duration (seconds) and exposure (an AQI index) are different units on wildly
different scales, so blending them raw would be meaningless. Both are
min-max normalised across the candidate set first:

```
timeNorm      = ( duration − min ) / ( max − min )
pollutionNorm = ( exposure − min ) / ( max − min )

combined = timeNorm × (1 − sliderWeight) + pollutionNorm × sliderWeight
```

Both are 0..1 and lower is better, so the lowest `combined` wins. With exactly
two routes this maps them to 0 and 1, which makes the slider an exact tie at
50% — mathematically correct, and why the badge sits still at the midpoint
before flipping past it.

### 5. What the Dijkstra result is used for

It **does not** replace or re-route the OSRM routes — it justifies the
recommendation by quantifying the time-versus-pollution tradeoff along the
chosen corridor. A single route contains one road, so clean mode usually
cannot find a genuinely different one; the UI says so rather than inventing
an improvement.

## Stack

React 18 · Vite · TailwindCSS v3 · Leaflet · React-Leaflet · Axios

## Data sources

- Tiles — [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Geocoding — [Nominatim](https://nominatim.openstreetmap.org/)
- Routing — [OSRM](https://project-osrm.org/) demo server
- Air quality — [Open-Meteo](https://open-meteo.com/en/docs/air-quality-api) (CAMS)

All three public services are rate-limited and carry no SLA; they are fine for
a hackathon demo and are not production dependencies.