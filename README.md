# AirRoute — Phase 1

Compare two driving routes between any two places on an interactive map.
Client-side only: no backend, no API keys.

> **Phase 1 scope is the map foundation only.** Air quality, pollution scoring,
> Dijkstra, and sliders are deliberately *not* here yet — see
> [DECISIONS.md](./DECISIONS.md) for the reasoning behind the current design.

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

## Stack

React 18 · Vite · TailwindCSS v3 · Leaflet · React-Leaflet · Axios

## Try it in three steps

1. Type **"Connaught Place, New Delhi"** into the Start field and pick the
   suggestion; do the same with **"Koramangala, Bengaluru"** in Destination.
2. Press **Find routes**.
3. Two coloured polylines appear — blue (`#2563eb`) and orange (`#f97316`).
   Click either result card to raise that route to weight 7 and fade the other
   to 0.35 opacity.

You can also skip the inputs entirely and just **click the map twice**: the
first click sets the start, the second sets the destination.

## Data sources

- Tiles — [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Geocoding — [Nominatim](https://nominatim.openstreetmap.org/)
- Routing — [OSRM](https://project-osrm.org/) demo server

Both public services are rate-limited and carry no SLA; they are fine for a
hackathon demo and are not production dependencies.