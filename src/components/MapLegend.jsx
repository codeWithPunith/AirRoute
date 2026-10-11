import { aqiCategory } from '../utils/recommend.js'

const ROUTE_COLORS = ['#2563eb', '#f97316']

const CATEGORIES = [
  { max: 50, label: 'Good (≤50)' },
  { max: 100, label: 'Moderate (51–100)' },
  { max: Infinity, label: 'Unhealthy (>100)' },
]

function RouteSwatch({ color, index, recommended }) {
  return (
    <li className="flex items-center gap-1.5 text-slate-700">
      <span
        aria-hidden="true"
        className="inline-block h-1 w-5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>Route {index + 1}</span>
      {recommended && <span className="font-semibold text-sky-600">recommended</span>}
    </li>
  )
}

/**
 * Legend overlaid on the map: route colours + what the AQI dots mean.
 *
 * On phones the map is only ~42dvh tall, so the full two-part legend would eat
 * a third of it. Mobile gets a single compact row of route colours; the AQI key
 * moves into the route cards, where each card already prints its own category
 * name next to its dot. Desktop keeps the complete legend.
 */
export default function MapLegend({ routes, recommendedId }) {
  if (!Array.isArray(routes) || routes.length === 0) return null

  return (
    <>
      {/* Compact: phones. */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-lg bg-white/95 px-2 py-1.5 text-[11px] shadow-md ring-1 ring-slate-200 md:hidden">
        <ul className="flex items-center gap-3">
          {routes.map((route, i) => (
            <RouteSwatch
              key={route.id}
              color={ROUTE_COLORS[i] ?? '#64748b'}
              index={i}
              recommended={recommendedId === route.id}
            />
          ))}
        </ul>
      </div>

      {/* Full: desktop. */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] hidden rounded-lg bg-white/95 px-3 py-2 text-[10px] shadow-md ring-1 ring-slate-200 md:block">
        <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
          Routes
        </p>
        <ul className="mb-2 space-y-0.5">
          {routes.map((route, i) => (
            <RouteSwatch
              key={route.id}
              color={ROUTE_COLORS[i] ?? '#64748b'}
              index={i}
              recommended={recommendedId === route.id}
            />
          ))}
        </ul>

        <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
          Air quality
        </p>
        <ul className="space-y-0.5">
          {CATEGORIES.map((cat) => {
            const probe = cat.max === Infinity ? 120 : cat.max
            const { dot } = aqiCategory(probe)
            return (
              <li key={cat.label} className="flex items-center gap-1.5 text-slate-700">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: dot }}
                />
                <span>{cat.label}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}