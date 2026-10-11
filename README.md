# AirRoute

Compare two driving routes between any two places, score both by **pollution
exposure**, and recommend the lower one. Client-side only: no backend, no API
keys.

> **Phase 2.** Phase 1 (the map, geocoding, and dual-route rendering) is
> unchanged underneath. See [DECISIONS.md](./DECISIONS.md) for the full
> rationale, including the honest limits of the air-quality data.

> **Phase 3 — sign-in required to see results.** Google sign-in via Firebase
> Authentication gates *route results*, not the app: the map and the inputs are
> browsable signed out, and pressing **Find routes** opens a sign-in dialog that
> resumes the search once you authenticate. See
> [Authentication Setup](#authentication-setup).

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

## Authentication Setup

**The app is browsable signed out; results are not.** Loading the map, clicking
to set endpoints, and typing search terms all work without an account. The gate
sits at the point of intent instead: pressing **Find routes** while signed out
opens a modal, and completing Google sign-in resumes that same search
automatically — you never press the button twice. Signing out clears the
in-memory route state so the next person to sign in does not inherit it.

You can also sign in from the header up front, which means never meeting the
modal at all.

> This is a **UX gate, not a security boundary**. There is no backend, and every
> data source AirRoute calls (OSRM, Nominatim, Open-Meteo) is public — anyone
> can call them directly. What the gate guarantees is that the UI never presents
> another visitor's route results as theirs.

Requires the `firebase` package:

```bash
npm install firebase
```

### 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. **Add project** → name it → Google Analytics is optional → **Create**.
   (Or select an existing project.)
3. **Project Settings** (gear icon) → **General** → scroll to **Your apps** →
   click the web icon `</>` → give it a nickname → **Register app**.
4. Copy the `firebaseConfig` values shown. You need `apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.

### 2. Enable the Google provider

5. **Authentication** → **Sign-in method** → **Google** → **Enable** → pick a
   **support email** → **Save**.
6. **Authentication** → **Settings** → **Authorized domains** → **Add domain**
   → `localhost` (already present for dev) and your production domain, e.g.
   `your-app.vercel.app`.

> Docs — [enable a provider](https://firebase.google.com/docs/auth/web/password-auth),
> [authorized domains](https://firebase.google.com/docs/auth/web/redirect-best-practices),
> [env vars in Vite](https://vite.dev/guide/env-and-mode.html).
> Vite only exposes variables prefixed `VITE_` to client code.

### 3. Configure locally

```bash
cp .env.example .env.local   # then paste your real values into .env.local
npm run dev
```

`.env.local` is gitignored. Vite reads env vars at **build** time, so restart
the dev server (or rebuild) after any change.

If the vars are missing the app still loads and you can browse the map, but no
search will ever return results — both sign-in buttons are disabled and a
dev-only console warning names `.env.local`.

### 4. Before deploying

- Add the production domain to Firebase → Authentication → Authorized domains.
- Add the same `VITE_FIREBASE_*` variables to your host's environment settings
  (Vercel, Netlify, Firebase Hosting).
- **Rebuild and redeploy** — static builds bake env values in at build time.

### Verify

Signed out, the map loads and you can set Start/Destination normally. Press
**Find routes** → a sign-in dialog opens → complete Google sign-in → the search
runs on its own and the results appear → the header shows your name and photo.
Refresh → still signed in, and pressing Find routes goes straight to results.
**Sign out** → the dialog no longer appears on a fresh search, and the previous
results are cleared.

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

## Layout

The app is **two layouts, not one responsive squeeze**:

- **Desktop (`md:` and up)** — the original two-pane app: map on the left,
  control panel scrolling independently on the right, filling the viewport.
- **Phones** — a single natural page scroll. The map is a fixed `42dvh` band at
  the top with the form and results flowing below it, so there is no
  scroll-inside-a-scroll-box.

Mobile-specific details: the header is sticky and respects the notch
(`env(safe-area-inset-top)`), inputs use a 16px font so iOS Safari does not
auto-zoom on focus, controls are sized to ~44px touch targets, and the map
legend collapses to a compact route-colour row. When scores finish, the panel
scrolls itself into view, since results land below the fold.

## Stack

React 18 · Vite · TailwindCSS v3 · Leaflet · React-Leaflet · Axios · Firebase Auth (optional sign-in)

## Data sources

- Tiles — [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Geocoding — [Nominatim](https://nominatim.openstreetmap.org/)
- Routing — [OSRM](https://project-osrm.org/) demo server
- Air quality — [Open-Meteo](https://open-meteo.com/en/docs/air-quality-api) (CAMS)

All three public services are rate-limited and carry no SLA; they are fine for
a hackathon demo and are not production dependencies.