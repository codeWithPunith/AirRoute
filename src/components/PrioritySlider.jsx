/**
 * Priority slider: 0 = fastest, 1 = cleanest.
 * Purely controlled — App owns sliderWeight so the recommendation and the
 * slider can never drift apart.
 */
export default function PrioritySlider({ value, onChange }) {
  const pct = Math.round((Number(value) || 0) * 100)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor="priority-slider"
          className="text-xs font-semibold text-slate-700"
        >
          Priority: Fastest ←→ Cleanest
        </label>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
          {pct}% clean
        </span>
      </div>

      <input
        id="priority-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-valuetext={`${pct} percent clean`}
        // The default range thumb is ~16px, which is fiddly to drag with a
        // finger. A taller track plus a padded wrapper enlarges the hit area
        // without changing the visual weight on desktop.
        className="mt-3 h-8 w-full cursor-pointer accent-sky-600 md:mt-2 md:h-5"
      />

      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-slate-400">
        <span>Fastest</span>
        <span>Cleanest</span>
      </div>
    </div>
  )
}