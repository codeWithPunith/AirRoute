import { aqiCategory } from '../utils/recommend.js'

const ROUTE_COLORS = ['#2563eb', '#f97316']

/** Legend overlaid on the map: route colours + what the AQI dots mean. */
export default function MapLegend({ routes, recommendedId }) {
  if (!Array.isArray(routes) || routes.length === 0) return null

  const categories = [
    { max: 50, label: 'Good (≤50)' },
    { max: 100, label: 'Moderate (51–100)' },
    { max: Infinity, label: 'Unhealthy (>100)' },
  ]

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-lg bg-white/95 px-3 py-2 text-[10px] shadow-md ring-1 ring-slate-200">
      <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
        Routes
      </p>
      <ul className="mb-2 space-y-0.5">
        {routes.map((route, i) => (
          <li key={route.id} className="flex items-center gap-1.5 text-slate-700">
            <span
              className="inline-block h-1 w-5 rounded-full"
              style={{ backgroundColor: ROUTE_COLORS[i] ?? '#64748b' }}
            />
            <span>Route {i + 1}</span>
            {recommendedId === route.id && (
              <span className="font-semibold text-sky-600">recommended</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
        Air quality
      </p>
      <ul className="space-y-0.5">
        {categories.map((cat) => {
          const probe = cat.max === Infinity ? 120 : cat.max
          const { dot } = aqiCategory(probe)
          return (
            <li key={cat.label} className="flex items-center gap-1.5 text-slate-700">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: dot }}
              />
              <span>{cat.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}