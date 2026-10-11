import { useState } from 'react'
import { formatMinutes } from '../utils/haversine.js'

/**
 * "Why this route?" — the explainability panel.
 *
 * Deliberately shows the honest numbers, including the ones that are zero.
 * If clean mode found no cleaner path we say so rather than inventing a win.
 */
export default function WhyPanel({
  recommended,
  alternative,
  analysis,
  sliderWeight,
  airQualityDown,
}) {
  const [open, setOpen] = useState(true)

  if (!recommended) return null

  const fastestMin = formatMinutes(recommended.durationSeconds)
  const altMin = formatMinutes(alternative?.durationSeconds ?? 0)

  const timeDelta =
    alternative && recommended.durationSeconds !== alternative.durationSeconds
      ? recommended.durationSeconds - alternative.durationSeconds
      : 0

  // Percentage of the ALTERNATIVE's exposure that the recommended route
  // avoids. Positive only when the recommended route is genuinely CLEANER,
  // so the headline can never claim a "reduction" the data does not support.
  const cheaper =
    alternative && alternative.exposureScore > 0
      ? ((alternative.exposureScore - recommended.exposureScore) /
          alternative.exposureScore) *
        100
      : 0

  let headline
  if (!alternative) {
    headline = `Only one driving route was returned, so it is recommended at ${fastestMin} min.`
  } else if (airQualityDown) {
    headline = `Air quality data was unavailable, so this route is recommended on time alone — ${fastestMin} min versus ${altMin} min.`
  } else if (timeDelta <= 0 && cheaper > 0) {
    headline = `This route is both quicker (${fastestMin} vs ${altMin} min) and cuts pollution exposure by ${Math.round(Math.abs(cheaper))}%.`
  } else if (timeDelta <= 0) {
    headline = `This route is quicker (${fastestMin} vs ${altMin} min) with comparable pollution exposure.`
  } else if (cheaper > 0) {
    headline = `This route adds ${formatMinutes(Math.abs(timeDelta))} min but reduces pollution exposure by ${Math.round(cheaper)}%.`
  } else {
    headline = `With the slider at ${Math.round(sliderWeight * 100)}% clean, this route wins on the combined time-and-pollution score.`
  }

  // On a single route's geometry the two paths usually cover the same road,
  // so the AQI difference is tiny (and can even be slightly negative, because
  // fastest mode blind-jumps over samples via shortcut edges). Anything within
  // 2% is reported as "unchanged" rather than dressed up as an improvement.
  const UNCHANGED_TOLERANCE_PCT = 2
  const exposureUnchanged =
    analysis &&
    Math.abs(analysis.aqiReductionPct) < UNCHANGED_TOLERANCE_PCT

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-3 text-left md:py-2"
      >
        <span className="text-xs font-semibold text-sky-900">Why this route?</span>
        <span className="text-xs text-sky-500">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-sky-200 px-3 py-2.5 text-[11px] leading-relaxed text-sky-900">
          <p className="font-medium">{headline}</p>

          {analysis && Number.isFinite(analysis.fastest.totalCost) && (
            <p className="text-sky-800">
              Pure-fastest path cost: {analysis.fastest.totalCost.toFixed(1)} (
              avg AQI {analysis.fastest.avgAqiAlongPath.toFixed(0)}) | Weighted-optimal
              cost: {analysis.cleanest.totalCost.toFixed(1)} (avg AQI{' '}
              {analysis.cleanest.avgAqiAlongPath.toFixed(0)})
              {analysis.timeCostPenaltyPct > 0 && (
                <> — {analysis.timeCostPenaltyPct.toFixed(0)}% higher time cost</>
              )}
              {analysis.aqiReductionPct > 0.5 && (
                <>, {analysis.aqiReductionPct.toFixed(0)}% lower AQI exposure</>
              )}
            </p>
          )}

          {exposureUnchanged && (
            <p className="text-sky-700">
              Average AQI is essentially unchanged — a single route only
              contains one road, so Dijkstra re-weights that corridor rather
              than inventing a cleaner alternative. The time cost above is the
              price of weighting air quality at all.
            </p>
          )}

          <p className="text-sky-600">
            Exposure = Σ (sample AQI × segment length) ÷ total length.
          </p>
        </div>
      )}
    </div>
  )
}