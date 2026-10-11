import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { debugError } from '../utils/debug'

function initials(name, email) {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Avatar + dropdown menu shown in the header when signed in. */
export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef(null)

  // Close on outside click or Escape — a dropdown with no dismissal is a trap.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  const label = user.displayName || user.email || 'Signed in'

  async function handleSignOut() {
    setError(null)
    try {
      await signOut()
    } catch (err) {
      debugError('sign-out failed:', err?.code, err?.message)
      setError('Could not sign out. Please try again.')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-[40px] items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-7 w-7 rounded-full bg-slate-200 object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
            {initials(user.displayName, user.email)}
          </span>
        )}
        <span className="max-w-[10rem] truncate">{label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[1100] mt-2 w-56 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
            {user.email && (
              <p className="truncate text-[11px] text-slate-500">{user.email}</p>
            )}
            {user.emailVerified && (
              <p className="mt-0.5 text-[10px] font-medium text-emerald-600">
                Email verified
              </p>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="block w-full px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>

          {error && (
            <p role="alert" className="border-t border-slate-100 px-3 py-2 text-[11px] text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}