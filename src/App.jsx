import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import RoutePanel from './components/RoutePanel'
import Header from './components/Header'
import SignInModal from './components/SignInModal'
import { useAuth } from './context/AuthContext'
import { getRoutes } from './services/routing'
import { reverseGeocode } from './services/geocoding'
import { scoreAllRoutes } from './services/scoring.js'
import { recommendRoutes, analyseRoute } from './utils/recommend.js'
import { debug, debugError } from './utils/debug.js'

export default function App() {
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // `scoredRoutes` is the single collection every view reads from: raw
  // routes are never stored separately, so the map and the panel can never
  // disagree about which geometry is on screen.
  const [sliderWeight, setSliderWeight] = useState(0)
  const [scoredRoutes, setScoredRoutes] = useState([])
  const [scoring, setScoring] = useState(false)

  // A signed-out visitor pressing "Find routes" sets this instead of running
  // the search; the modal then resolves it once Firebase returns a user.
  const [pendingSearch, setPendingSearch] = useState(false)

  const { user } = useAuth()

  // Signing out leaves the map visible but empties the results, so this state
  // must be cleared too — otherwise signing in as someone else would reveal
  // the previous user's endpoints and scored routes.
  const prevUid = useRef(null)
  const panelRef = useRef(null)
  useEffect(() => {
    if (prevUid.current && prevUid.current !== user?.uid) {
      setStart(null)
      setEnd(null)
      setActiveRouteId(null)
      setScoredRoutes([])
      setScoring(false)
      setSliderWeight(0)
      setError(null)
      setPendingSearch(false)
    }
    prevUid.current = user?.uid ?? null
  }, [user])

  // On a phone the map sits above the fold, so results appear off-screen with
  // no cue that anything happened. Nudge the panel into view once, when the
  // first scores land. Desktop is a two-pane layout where both are already
  // visible, so this is skipped there.
  const seenRoutes = useRef(false)
  useEffect(() => {
    if (scoredRoutes.length > 0) seenRoutes.current = true
    if (!seenRoutes.current || scoredRoutes.length === 0) return
    if (scoring) return
    if (!window.matchMedia('(max-width: 767px)').matches) return

    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    seenRoutes.current = false
  }, [scoredRoutes, scoring])

  const clickTarget = start ? 'end' : 'start'

  // Any change to the endpoints invalidates previously fetched routes.
  const resetRoutes = useCallback(() => {
    setActiveRouteId(null)
    setScoredRoutes([])
    setScoring(false)
  }, [])

  const handleMapClick = useCallback(
    async (lat, lng) => {
      // Start is filled first; every click after that sets the destination.
      if (!start) {
        setStart({ label: 'Start point', lat, lng })
        resetRoutes()
        return
      }

      setEnd({ label: 'Destination point', lat, lng })
      resetRoutes()

      // Reverse geocode purely to label the marker; failure is non-fatal.
      const label = await reverseGeocode(lat, lng)
      if (!label) return

      setEnd((prev) =>
        prev && prev.lat === lat && prev.lng === lng ? { ...prev, label } : prev,
      )
    },
    [start, resetRoutes],
  )

  // The authenticated workhorse. Split out from handleFindRoutes so the same
  // search can run either immediately or after the sign-in modal completes.
  async function runFindRoutes() {
    if (!start || !end) return

    setLoading(true)
    setError(null)
    setScoredRoutes([])
    try {
      const result = await getRoutes(start, end)
      setActiveRouteId(result[0]?.id ?? null)

      // Fetch real AQI for every sampled point. scoreAllRoutes never throws —
      // an unreachable air-quality API degrades to the neutral default AQI.
      if (result.length > 0) {
        setScoring(true)
        try {
          const scored = await scoreAllRoutes(result)
          debug(
            'scored routes:',
            scored.map((r) => `${r.id} exposure=${r.exposureScore.toFixed(1)} fallback=${r.fallback}`),
          )
          setScoredRoutes(scored)
        } finally {
          setScoring(false)
        }
      }
    } catch (err) {
      debugError('find routes failed:', err?.code, err?.message)
      resetRoutes()
      setError({
        message: err?.message || 'Something went wrong while routing.',
        code: err?.code ?? null,
      })
    } finally {
      setLoading(false)
    }
  }

  // Browsing the map and filling in the endpoints works for anyone. The gate is
  // here, at the moment it starts to cost something, so a signed-out visitor
  // sees a real app first and is asked to identify themselves only when they
  // actually want results.
  function handleFindRoutes() {
    if (!user) {
      setPendingSearch(true)
      return
    }
    runFindRoutes()
  }

  // Resume the search the visitor originally asked for, now that they have a
  // user. Endpoints are still in state, so nothing needs re-entering.
  function handleSignInSuccess() {
    setPendingSearch(false)
    runFindRoutes()
  }

  function handleStartSelect(point) {
    setStart(point)
    resetRoutes()
  }

  function handleEndSelect(point) {
    setEnd(point)
    resetRoutes()
  }

  // The recommendation is DERIVED, not stored. Keeping it in useState and
  // syncing via useEffect would cost an extra render and leave one frame
  // where the map highlight and the "Recommended" badge disagree.
  const { recommendedId, items: recItems } = useMemo(
    () => recommendRoutes(scoredRoutes, sliderWeight),
    [scoredRoutes, sliderWeight],
  )

  const scoredById = useMemo(() => {
    const map = new Map()
    scoredRoutes.forEach((r) => map.set(r.id, r))
    return map
  }, [scoredRoutes])

  const recItemById = useMemo(() => {
    const map = new Map()
    recItems.forEach((i) => map.set(i.id, i))
    return map
  }, [recItems])

  // Dijkstra comparison numbers for the recommended route.
  const analysis = useMemo(() => {
    const route = scoredById.get(recommendedId)
    if (!route) return null
    return analyseRoute(route, Math.max(sliderWeight, 0.5))
  }, [scoredById, recommendedId, sliderWeight])

  const airQualityDown = useMemo(
    () => scoredRoutes.length > 0 && scoredRoutes.every((r) => r.fallback),
    [scoredRoutes],
  )

  // Mobile and desktop are deliberately different layouts, not one layout that
  // squeezes. On phones the page is ONE natural scroll: a fixed-height map on
  // top, then the form and results in flow below it. That kills the
  // scroll-inside-a-scroll-box trap of a 40vh panel. On desktop it stays the
  // two-pane app it always was.
  return (
    <div className="flex min-h-dvh flex-col bg-slate-100 md:h-screen md:overflow-hidden">
      <Header />

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <div className="relative h-[42dvh] w-full shrink-0 border-b border-slate-200 md:h-full md:w-3/4 md:border-b-0 md:border-r">
          <MapView
            start={start}
            end={end}
            routes={scoredRoutes}
            activeRouteId={activeRouteId}
            recommendedId={recommendedId}
            onMapClick={handleMapClick}
          />
        </div>

        <div ref={panelRef} className="w-full md:h-full md:w-1/4">
          <RoutePanel
            start={start}
            end={end}
            scoredRoutes={scoredRoutes}
            scoredById={scoredById}
            recItemById={recItemById}
            recommendedId={recommendedId}
            activeRouteId={activeRouteId}
            sliderWeight={sliderWeight}
            loading={loading || scoring}
            scoring={scoring}
            error={error}
            airQualityDown={airQualityDown}
            analysis={analysis}
            clickTarget={clickTarget}
            onStartSelect={handleStartSelect}
            onEndSelect={handleEndSelect}
            onFindRoutes={handleFindRoutes}
            onRouteSelect={setActiveRouteId}
            onSliderChange={setSliderWeight}
          />
        </div>
      </div>

      <SignInModal
        open={pendingSearch}
        onClose={() => setPendingSearch(false)}
        onSuccess={handleSignInSuccess}
      />
    </div>
  )
}