import { useCallback, useState } from 'react'
import MapView from '@/components/MapView'
import RoutePanel from '@/components/RoutePanel'
import { getRoutes } from '@/services/routing'
import { reverseGeocode } from '@/services/geocoding'
import { debugError } from '@/utils/debug'

export default function App() {
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [routes, setRoutes] = useState([])
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const clickTarget = start ? 'end' : 'start'

  // Any change to the endpoints invalidates previously fetched routes.
  const resetRoutes = useCallback(() => {
    setRoutes([])
    setActiveRouteId(null)
  }, [])

  const handleMapClick = useCallback(
    async (lat, lng) => {
      // Start is filled first; every subsequent click sets the destination.
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
    try {
      const result = await getRoutes(start, end)
      setRoutes(result)
      setActiveRouteId(result[0]?.id ?? null)
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 md:flex-row">
      <div className="h-[60vh] w-full shrink-0 border-b border-slate-200 md:h-full md:w-3/4 md:border-b-0 md:border-r">
        <MapView
          start={start}
          end={end}
          routes={routes}
          activeRouteId={activeRouteId}
          onMapClick={handleMapClick}
        />
      </div>

      <div className="h-[40vh] w-full md:h-full md:w-1/4">
        <RoutePanel
          start={start}
          end={end}
          routes={routes}
          activeRouteId={activeRouteId}
          loading={loading}
          error={error}
          clickTarget={clickTarget}
          onStartSelect={handleStartSelect}
          onEndSelect={handleEndSelect}
          onFindRoutes={handleFindRoutes}
          onRouteSelect={setActiveRouteId}
        />
      </div>
    </div>
  )
}