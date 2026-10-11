import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../services/geocoding.js'

const DEBOUNCE_MS = 400

/**
 * Text input with debounced Nominatim autocomplete.
 * Reports a picked result upward as { label, lat, lng }.
 */
export default function LocationInput({
  id,
  label,
  placeholder = 'Search for a place',
  value,
  onSelect,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [noMatches, setNoMatches] = useState(false)
  const containerRef = useRef(null)
  const requestIdRef = useRef(0)

  const trimmed = query.trim()
  const canSearch = trimmed.length >= 3

  // Debounced autocomplete. Each keystroke bumps requestIdRef so a slow
  // response from an earlier query can never overwrite a newer one.
  useEffect(() => {
    if (!canSearch) return

    const requestId = ++requestIdRef.current

    const timer = setTimeout(async () => {
      const hits = await searchPlaces(trimmed)
      if (requestId !== requestIdRef.current) return

      setResults(hits)
      setNoMatches(hits.length === 0)
      setSearching(false)
      setOpen(true)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [trimmed, canSearch])

  // Close the dropdown on outside click.
  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function handleSelect(hit) {
    setOpen(false)
    setQuery('')
    setResults([])
    setNoMatches(false)
    onSelect?.({
      label: hit.display_name,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
    })
  }

  // Derived during render rather than synced in an effect.
  const visibleResults = canSearch ? results : []
  const showEmpty = open && !searching && canSearch && noMatches
  const showList = open && !searching && visibleResults.length > 0

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            // Spin while the debounce timer is pending, driven by the
            // event that caused the change rather than by the effect.
            setSearching(next.trim().length >= 3)
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          // 16px on phones on purpose: iOS Safari zooms the whole viewport
          // when an input under 16px is focused, which throws off the
          // sticky header and the fixed map. Desktop keeps the tighter size.
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-base text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 md:py-2 md:text-sm"
        />

        {searching && (
          <span
            role="status"
            aria-label="Searching"
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"
          />
        )}
      </div>

      {value && (
        <p className="mt-1 truncate text-xs text-emerald-700" title={value.label}>
          <span className="font-medium">Selected:</span> {value.label}
        </p>
      )}

      {showList && (
        <ul className="absolute z-[1200] mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* Nominatim can legitimately return two results with identical
              coordinates but different display_names (e.g. a building and
              the street it sits on), so the index is part of the key. */}
          {visibleResults.map((hit, index) => (
            <li key={`${hit.lat},${hit.lon}#${index}`}>
              <button
                type="button"
                onClick={() => handleSelect(hit)}
                className="block w-full px-3 py-2.5 text-left text-sm text-slate-700 active:bg-sky-50 hover:bg-sky-50 md:py-2 md:text-xs"
              >
                {hit.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <p className="absolute z-[1200] mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          No matches found
        </p>
      )}
    </div>
  )
}