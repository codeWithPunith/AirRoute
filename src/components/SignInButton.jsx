import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isFirebaseConfigured } from '../services/firebase'
import { debugError } from '../utils/debug'

/** Firebase error codes worth showing verbatim; the rest get a generic copy. */
const FRIENDLY_ERRORS = {
  'auth/popup-blocked':
    'The popup was blocked. Allow popups for this site, then try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open.',
  'auth/network-request-failed': 'Network error. Check your connection and retry.',
  'auth/unauthorized-domain':
    'This domain is not authorised in Firebase → Authentication → Settings → Authorized domains.',
  'auth/invalid-api-key': 'Firebase API key is missing or invalid. Check .env.local.',
  'auth/operation-not-allowed':
    'Google sign-in is not enabled for this Firebase project.',
  'auth/account-exists-with-different-credential':
    'That email is already registered with a different sign-in method.',
}

function messageFor(err) {
  if (err?.code && FRIENDLY_ERRORS[err.code]) return FRIENDLY_ERRORS[err.code]
  if (err?.message) return err.message
  return 'Could not sign in. Please try again.'
}

/** Google sign-in button. Owns its busy/error state so the header stays dumb. */
export default function SignInButton({ className = '', onSuccess }) {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleClick() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      // Deferred work (e.g. "find routes") resumes from the caller's callback.
      onSuccess?.()
    } catch (err) {
      // A user closing the popup is not an error worth shouting about.
      if (err?.code !== 'auth/cancelled-popup-request') debugError('sign-in failed:', err?.code, err?.message)
      if (err?.code !== 'auth/popup-closed-by-user') setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || !isFirebaseConfigured

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
          />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"
            />
            <path
              fill="#EA4335"
              d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z"
            />
          </svg>
        )}
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>

      {error && (
        <p role="alert" className="max-w-[16rem] text-right text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}