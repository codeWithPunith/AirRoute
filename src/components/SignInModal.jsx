import { useEffect, useRef } from 'react'
import SignInButton from './SignInButton'

/**
 * Blocking sign-in dialog, shown when a signed-out visitor asks for routes.
 *
 * The intent is preserved by the caller: it runs the deferred search in
 * `onSuccess` once Firebase reports a user, so the visitor never has to press
 * "Find routes" a second time.
 *
 * Dismissing is allowed — it returns to the map with nothing computed. The
 * point is that authentication is required to *get results*, not that the user
 * is trapped on the page.
 */
export default function SignInModal({ open, onClose, onSuccess }) {
  const panelRef = useRef(null)

  // Escape closes, and focus moves into the dialog so keyboard users are not
  // left tabbing around the page behind it.
  useEffect(() => {
    if (!open) return

    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop: click to dismiss. aria-hidden so AT ignores the decoration. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-modal-title"
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-sky-50">
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
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            />
            <path d="M4 20V7l8-3 8 3v13" />
          </svg>
        </div>

        <h2
          id="signin-modal-title"
          className="text-center text-base font-bold text-slate-900"
        >
          Sign in to find routes
        </h2>
        <p className="mx-auto mt-1.5 max-w-[15rem] text-center text-sm leading-relaxed text-slate-500">
          Comparing routes needs an account, so your results stay yours. Continue
          with Google and we'll pick up right where you left off.
        </p>

        <div className="mt-5 flex justify-center">
          {/* onSuccess fires from the Firebase auth state change, so the button
              itself stays a plain trigger. */}
          <SignInButton onSuccess={onSuccess} />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          By continuing you agree to let AirRoute read your basic Google profile
          (name, email, photo).
        </p>
      </div>
    </div>
  )
}