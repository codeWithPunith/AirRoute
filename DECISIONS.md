# DECISIONS.md — AirRoute Phase 1

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