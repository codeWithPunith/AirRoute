import { useAuth } from '../context/AuthContext'
import SignInButton from './SignInButton'

/**
 * UNUSED — safe to delete.
 *
 * This was a whole-page gate, but gating the landing page turned out to be the
 * wrong shape: an anonymous visitor never got to see the map or try the app.
 * AirRoute now gates at the point of intent instead — `SignInModal`, opened by
 * "Find routes" — and keeps this component only as a reference for wrapping a
 * future section (e.g. a saved-routes page).
 *
 * Wrapping usage, if it is ever needed:
 *
 *   <AuthGate fallback={<p>Sign in to save routes.</p>}>{children}</AuthGate>
 *
 * Note on what a gate can and cannot do here: the sign-in state lives in
 * Firebase and is per-browser-session, so this is a UX gate, not a security
 * boundary. There is no backend, and every data source AirRoute calls (OSRM,
 * Nominatim, Open-Meteo) is public. What it guarantees is that the UI does not
 * treat an anonymous visitor as a user.
 */
export default function AuthGate({ children, fallback }) {
  const { user, loading, error } = useAuth()

  // Never flash the prompt while the session is still being restored — that
  // would make every returning user see a "sign in" flash on each reload.
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-100">
        <div className="flex items-center text-sm text-slate-400">
          <span
            aria-hidden="true"
            className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500"
          />
          Checking sign-in…
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-slate-100 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6 text-sky-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
                stroke="#fff"
              />
              <path d="M4 20V7l8-3 8 3v13" />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-slate-900">Sign in to AirRoute</h2>
          <p className="mx-auto mt-1.5 max-w-[16rem] text-sm leading-relaxed text-slate-500">
            {fallback ||
              'Compare two routes and find the one with cleaner air. Sign in with Google to start.'}
          </p>

          <div className="mt-5 flex justify-center">
            <SignInButton />
          </div>

          {error && (
            <p role="alert" className="mt-4 text-[11px] text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  return children
}