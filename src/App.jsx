import { useCallback, useMemo, useState } from 'react'
import MapView from './components/MapView'
import RoutePanel from './components/RoutePanel'
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

  async function handleFindRoutes() {
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 md:flex-row">
      <div className="relative h-[60vh] w-full shrink-0 border-b border-slate-200 md:h-full md:w-3/4 md:border-b-0 md:border-r">
        <MapView
          start={start}
          end={end}
          routes={scoredRoutes}
          activeRouteId={activeRouteId}
          recommendedId={recommendedId}
          onMapClick={handleMapClick}
        />
      </div>

      <div className="h-[40vh] w-full md:h-full md:w-1/4">
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
  )
}