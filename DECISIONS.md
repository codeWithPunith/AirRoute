# DECISIONS.md — AirRoute

## Phase 2 decisions

### Why Open-Meteo

`https://air-quality-api.open-meteo.com/v1/air-quality` was chosen because:

- **No API key.** Same constraint that drove the OSRM choice. Phase 1 is
  client-side only, and a keyed provider would mean either a backend or
  shipping a secret into the bundle.
- **Free and unmetered for this volume**, which matters because a route
  comparison costs up to 60 readings.
- **Global coverage** via the CAMS (Copernicus Atmosphere Monitoring Service)
  model, so the demo does not silently break outside Europe or the US.
- **Returns a US AQI directly** (`us_aqi`), so there is no hand-rolled
  breakpoint table to get wrong.

Rejected alternatives:

| Option | Why not |
|---|---|
| **OpenAQ** | Needs a registered API key, and key handling would force a backend. |
| **WAQI / aqicn** | Requires signup and a token. |
| **IP2Location / AirVisual** | Commercial, per-request billing, key required. |
| **AQI.innerr** | Free tier needs a key; less reliable uptime than Open-Meteo. |
| **WeatherAPI.com** | Key required; Open-Meteo is the same data family without the friction. |

### Measured limitation: the AQI grid is coarse

Open-Meteo snaps each request to the nearest CAMS grid cell (~0.1° ≈ 11 km).
Verified in Delhi: three points ~7 km apart returned AQI 156, 156 and 185 —
the 0.1° cells are interpolated, so intra-city gradients do exist, but they
are blocky. **Exposure differences between two short urban routes can be
small or zero.** The app reports whatever the API returns and does not
inflate the difference; see "Honest limits" below.

### Why 30 samples maximum

`samplePolyline(points, 500, 30)` caps each route at 30 readings. Two routes
is therefore at most 60 AQI calls. Open-Meteo rate-limits aggressively per
IP, and a 2000 km route at a 500 m interval would otherwise generate
thousands of calls and get the whole tab throttled.

When a route is long enough that 500 m spacing would exceed the cap, the
**interval grows** to `totalLength / (maxSamples - 1)` rather than samples
being dropped. So a 2000 km route is sampled every ~69 km and still gets
exactly 30 readings — every sample is equally spaced along the route, and
the length-weighted score stays unbiased. The first and last points are
always included.

### The uniform-speed assumption in Dijkstra

OSRM returns **one** duration for the whole route and `steps=false` in
Phase 1, so there are no per-segment timings available. Each segment's
duration is therefore derived as:

```
segmentDurationSeconds = segmentLengthMeters / avgSpeedMps
avgSpeedMps            = routeDistanceMeters / routeDurationSeconds
```

This assumes the vehicle holds the route's average speed the entire way.
In reality a city route is slow at junctions and fast on the arterial, so
real segment times are uneven and our reconstruction is a linear
approximation of them. It is used only to give Dijkstra a relative cost
scale — the *ordering* of edges is what matters, and that ordering is
preserved as long as speed is roughly uniform.

A more accurate version would re-request OSRM with `steps=true` and read the
per-step durations. That was not done because it was out of Phase 2 scope
and roughly doubles the response size.

### What Dijkstra does and does not do — stated plainly

This is the part most likely to be misunderstood, so it is written out.

**Dijkstra does not choose between the two OSRM routes.** That choice is made
by the min-max normalised score in `recommendRoutes()`. Dijkstra runs
*within* one route's sampled geometry.

**The sampled graph is not a bare chain.** Consecutive samples are connected,
but each node also connects up to 3 samples ahead, capped in metres so the
shortcuts stay local. Without this, a chain graph has exactly one simple path
and a "cleanest" search would return the same road regardless of pollution —
the algorithm would be decorative.

**Even so, it usually cannot find a cleaner path.** A single OSRM route's
geometry contains exactly one road. To switch to a parallel street the search
would need a long edge across a block, which the metres cap deliberately
forbids. Tested directly on a hairpin geometry with a clean outbound leg and
a filthy parallel return leg, clean mode produced **0% AQI reduction** — it
correctly refuses to teleport across the block.

So the honest framing, which is also what the UI says: **Dijkstra quantifies
the time-versus-pollution cost along a corridor.** The clean-mode cost being
96–200% above the fastest-mode cost is the honest price of weighting air
quality. `WhyPanel` reports "essentially unchanged" when the AQI difference
falls within ±2% instead of dressing it up as an improvement.

### Recommendation maths

```
timeNorm_i       = (duration_i       − min) / (max − min)
pollutionNorm_i  = (exposure_i       − min) / (max − min)
combined_i       = timeNorm_i × (1 − w) + pollutionNorm_i × w
recommended      = argmin(combined_i)
```

**Known quirk:** with exactly two candidates, min-max normalisation maps
them to 0 and 1, so `combined` becomes `w` and `1 − w` — meaning the slider
is an **exact tie at 50%**, and the first route wins the tie. This is
mathematically correct rather than a bug, but it is worth knowing. With
three or more routes the curves stop being symmetric.

Routes whose AQI calls all failed are given `pollutionNorm = NaN`, which
normalises to a neutral 0.5, so a route with no pollution data cannot win
on a fabricated number — time decides.

---

## Phase 1 decisions

## Why the OSRM public server was chosen

`https://router.project-osrm.org` is the demo instance of OSRM, the routing
engine used by OpenStreetMap's own map. It was picked for Phase 1 because:

- **No backend and no API key.** The brief is client-side only, and the OSRM
  demo server is open CORS. A hosted provider (Mapbox, Google, HERE) would need
  a key, which would mean either a server or shipping the key to the browser.
- **It already speaks the shape we need.** One call returns
  `alternatives=true`, so two routes come back in a single request, along with
  GeoJSON geometry at `overview=full` — enough to draw both polylines without a
  second round trip.
- **Real driving data.** Actual road network and real traffic-free travel times,
  not straight lines. This matters because later phases will score routes by
  how they cross polluted areas; a straight-line interpolation would make that
  meaningless.

The demo server is rate-limited and has no SLA. It is fine for a hackathon demo
and is not a production dependency. Swapping in a self-hosted OSRM later means
changing one constant in `src/services/routing.js`.

### Known limitation discovered while testing

The spec's fallback — re-requesting with `exclude=motorway` to manufacture a
second route — **cannot succeed against this server.** The public OSRM demo has
the `exclude` flag disabled and replies:

```
{"code":"InvalidValue","message":"Exclude flag combination is not supported."}
```

This was verified for `motorway`, `toll`, `ferry`, and combined values. So
whenever OSRM returns only one genuine alternative, the fallback request fails
and the app returns a single route. That is exactly the documented graceful
degradation, so the code is correct as written; it is just that on this server
the fallback is effectively inert. Against a self-hosted OSRM, or a provider
that enables the flag, the fallback becomes live with no code change.

In practice OSRM returned two routes for every long-distance pair tested
(e.g. Bengaluru → Mysuru: 144 km / 119 min and 148 km / 125 min), so the
two-route case is the normal one.

## Why `L.Routing.control` was avoided

`leaflet-routing-machine`'s `L.Routing.Control` owns its own state and its own
DOM. It renders its own marker layers, its own route panel, and its own
waypoint handlers inside the map container.

That collides head-on with React:

1. **Two sources of truth.** The control keeps waypoints and routes in
   imperative Leaflet state. React also holds `start`, `end`, and `routes`.
   They drift the moment either side changes, and reconciling them means
   writing imperative glue to push React state back into Leaflet on every
   render — which is a React anti-pattern.
2. **It renders into the map, not the tree.** The control appends its own HTML
   panel to the map container. Route cards therefore cannot be styled with
   Tailwind or laid out responsively, and the "click a card to highlight that
   route" interaction the brief asks for would have to be reverse-engineered
   through the control's private markup.
3. **It fights the brief's requirements.** Selecting a route to raise its
   weight and fade the other is a styling concern the control does not model —
   its `routeSelected` event only fires on lines *it* drew.

So `leaflet-routing-machine` is installed and its CSS is imported as the brief
allowed, but drawing is done by hand: OSRM GeoJSON coordinates are converted
from `[lng, lat]` to `[lat, lng]` and fed straight into React-Leaflet
`<Polyline>`. All styling stays declarative React state. The dependency cost is
one unused CSS import, which is the trade the brief explicitly sanctioned.

## Deviations from the task list

1. **Scaffolded into the repo root, not `airroute/`.** The working directory was
   already an empty `AirRoute/` folder, so `npm create vite@latest .` was used.
   The brief's `cd airroute` step would have nested a duplicate folder. File
   paths are otherwise exactly as specified.

2. **Pinned React to 18, and `react-leaflet` to 4.** The current Vite React
   template scaffolds React 19, but the brief specifies React 18. Critically,
   `react-leaflet` v5 requires React 19 while v4.2.1 targets React 18 — the two
   stated requirements cannot both be met on latest. Since the brief named
   React 18, React 18 + `react-leaflet@4.2.1` is the combination that actually
   works. `@types/react` was also pinned to 18 so the types agree with the
   runtime. Upgrading to React 19 later is a one-line change plus a
   `react-leaflet@5` bump.

3. **TailwindCSS v3, not v4.** The brief specifies
   `npm install -D tailwindcss postcss autoprefixer` and
   `npx tailwindcss init -p`, which is the Tailwind v3 workflow. Tailwind v4
   removed the `init` command in favour of an `@tailwindcss/vite` plugin, so v3
   was pinned to match the instructions.

4. **`exclude=motorway` fallback is retained but inert here.** Implemented as
   specified, including the `[lng, lat] → [lat, lng]` conversion and the
   route-shape contract. See the known limitation above — the public server
   rejects the flag.

5. **`RoutingError` is thrown, not returned.** The brief says to surface the
   OSRM `code` in a red banner. Services that swallow failures into an empty
   array cannot express "the server said `NoRoute`" versus "the server was
   unreachable", so `getRoutes` rejects with a `RoutingError` carrying `.code`.
   By contrast `searchPlaces` returns `[]` and `reverseGeocode` returns `null`,
   exactly as specified, because the autocomplete genuinely degrades to an
   empty state rather than an error state. Every call site is wrapped in
   try/catch.

6. **Click-to-fill order is start, then destination, forever.** The brief says
   "start first, then destination". This is implemented as: the first map click
   sets the start, and every click after that sets the destination. Clicking a
   third time replaces the destination rather than clearing the start, so a
   user can always see and correct both points. Map clicks reverse-geocode
   asynchronously to label the marker, but a failure there is non-fatal — the
   coordinate still works as an endpoint.

7. **Markers use `L.divIcon`, not the default Leaflet pin.** The classic
   bundler fix from the brief is applied in `src/main.jsx` exactly as
   specified. On top of that, the two endpoints use styled `divIcon` markers
   (green "A", red "B") because the phase is about comparing two named routes
   and needs the endpoints to be visually distinct from each other. The
   `Icon.Default` fix is retained for any stock Leaflet marker that still
   renders.

8. **`src/utils/debug.js` was added.** The brief asks for a `debug()` helper
   gated on `import.meta.env.DEV`. It is the only file in `src/` containing a
   `console.*` call, and both of its calls sit behind that guard.

## Other notes

- **`@` path alias** was added (`vite.config.js` + `jsconfig.json`) so service
  and utility imports survive future file moves.
- **Autocomplete race conditions** are handled with a monotonic request id:
  a slow response from an older keystroke can never overwrite newer results.
- **Stale routes are cleared** whenever an endpoint changes, so the map never
  shows routes that no longer match the inputs.
- **The 500 km limit does not exist.** Routes over 500 km render at full detail;
  `fitBounds` uses a `maxZoom` cap of 14 rather than any distance clamp.

---

## Phase 2 deviations from the task list

1. **Batched AQI requests.** The brief asked for one `getAirQuality(lat, lon)`
   call per sample. That export exists exactly as specified, but `scoreRoute`
   uses an additional `getAirQualityBatch()` because Open-Meteo accepts
   comma-separated coordinates. A 30-sample route costs **one** request
   instead of 30, and both routes together cost 2. Without this the app would
   fire 60 concurrent requests at a rate-limited free API and self-throttle.

2. **`recommendedId` is derived, not stored.** The brief suggested
   `useState` + a `useEffect`. Storing it would cost an extra render and leave
   one frame where the map highlight and the "Recommended" badge disagree. It
   comes straight out of a `useMemo` instead. It cannot drift.

3. **The raw `routes` state was removed in Phase 2.** Once routes are scored,
   `scoredRoutes` is a superset of `routes` (it contains the geometry plus
   exposure fields). Keeping both meant two collections to keep in sync. The
   map and panel now read from one list.

4. **Files split to stay under 200 lines.** `dijkstra.js` reached 298 lines
   and `RoutePanel.jsx` reached 251. Dijkstra is now `minHeap.js` (the heap),
   `graph.js` (adjacency + the uniform-speed assumption), and `dijkstra.js`
   (the algorithm and the two modes). `RouteCard.jsx` was split out of
   `RoutePanel.jsx`.

5. **`avgAqiAlongPath` is length-weighted, not a plain mean.** The first
   implementation averaged AQI over *path segments*, which is wrong because
   Dijkstra deliberately uses shortcut edges — two paths over identical road
   reported different averages purely because one was subdivided into 5 hops
   and the other into 12. It now weights by metres, matching
   `computeExposure()`.

6. **All relative imports, no `@` alias.** The alias still works in Vite but
   broke `node` imports, which made the algorithm files untestable outside
   the bundler. Relative imports mean `node --input-type=module` can run the
   whole data layer, which is how the numbers in the Phase 2 report were
   produced.

7. **`debug.js` uses `import.meta.env?.DEV`.** The optional chaining is
   deliberate: `import.meta.env` is `undefined` under plain Node, and the
   un-guarded version threw on import.