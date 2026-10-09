import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import MapLegend from './MapLegend.jsx'

const DEFAULT_CENTER = [20.5937, 78.9629]
const DEFAULT_ZOOM = 5

const ROUTE_COLORS = ['#2563eb', '#f97316']

function endpointIcon(kind) {
  const isStart = kind === 'start'
  const color = isStart ? '#16a34a' : '#dc2626'
  const glyph = isStart ? 'A' : 'B'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);color:#fff;font:700 12px/1 system-ui,sans-serif">${glyph}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  })
}

const START_ICON = endpointIcon('start')
const END_ICON = endpointIcon('end')

/** Fits the viewport to every drawn route whenever `routes` changes. */
function FitBoundsToRoutes({ routes }) {
  const map = useMap()

  useEffect(() => {
    const points = routes.flatMap((r) => r.geometry).filter(Boolean)
    if (points.length === 0) return

    try {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 })
    } catch {
      // A degenerate bounds (all points identical) is not worth crashing over.
    }
  }, [map, routes])

  return null
}

/** Lets the parent imperatively pan the map when points are set by clicking. */
function MapClickBridge({ onMapClick }) {
  const map = useMap()

  useEffect(() => {
    if (!onMapClick) return
    const handler = (event) => onMapClick(event.latlng.lat, event.latlng.lng)
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [map, onMapClick])

  return null
}

export default function MapView({
  start,
  end,
  routes,
  activeRouteId,
  recommendedId,
  onMapClick,
}) {
  const polylines = useMemo(
    () =>
      routes.map((route, index) => {
        const isRecommended = Boolean(recommendedId) && route.id === recommendedId
        const isActive = activeRouteId === route.id
        const isDimmed = Boolean(activeRouteId) && !isActive

        // A recommended route always draws thick and solid, even before the
        // user clicks its card. Everything else recedes.
        const weight = isRecommended ? 7 : isDimmed ? 4 : 5
        const opacity = isRecommended ? 1 : isDimmed ? 0.4 : 1

        return {
          ...route,
          color: ROUTE_COLORS[index] ?? ROUTE_COLORS[ROUTE_COLORS.length - 1],
          dashArray: route.isFallback ? '10 8' : null,
          weight,
          opacity,
          zIndex: isRecommended ? 1000 - index : isActive ? 600 - index : 500 - index,
        }
      }),
    [routes, activeRouteId, recommendedId],
  )

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <MapClickBridge onMapClick={onMapClick} />
      <FitBoundsToRoutes routes={routes} />

      {start && <Marker position={[start.lat, start.lng]} icon={START_ICON} />}
      {end && <Marker position={[end.lat, end.lng]} icon={END_ICON} />}

      {polylines.map((route) =>
        route.geometry.length > 1 ? (
          <Polyline
            key={route.id}
            positions={route.geometry}
            pathOptions={{
              color: route.color,
              weight: route.weight,
              opacity: route.opacity,
              dashArray: route.dashArray ?? undefined,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            zIndexOffset={route.zIndex}
          />
        ) : null,
      )}

      <MapLegend routes={routes} recommendedId={recommendedId} />
    </MapContainer>
  )
}