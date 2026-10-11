import { useAuth } from '../context/AuthContext'
import SignInButton from './SignInButton'
import UserMenu from './UserMenu'

/**
 * Top app bar: title plus the auth control.
 *
 * The app itself is browsable signed out, so the sign-in button stays here as
 * an optional shortcut — a visitor can identify themselves before pressing
 * "Find routes" and never meet the modal at all. While the Firebase session is
 * being restored we render a neutral placeholder instead, otherwise the bar
 * would visibly change shape on every page load.
 */
export default function Header() {
  const { user, loading } = useAuth()

  return (
    <header className="safe-top sticky top-0 z-[1300] shrink-0 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur md:px-4 md:py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-base font-bold text-slate-900">
            AirRoute
          </span>
          <span className="hidden truncate text-[11px] text-slate-500 sm:inline">
            The cleaner way to drive
          </span>
        </div>

        {loading ? (
          <span
            aria-label="Restoring sign-in state"
            className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-slate-100"
          />
        ) : user ? (
          <UserMenu />
        ) : (
          <SignInButton />
        )}
      </div>
    </header>
  )
}