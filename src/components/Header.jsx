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
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-bold text-slate-900">AirRoute</span>
        <span className="hidden text-[11px] text-slate-500 sm:inline">
          The cleaner way to drive
        </span>
      </div>

      {loading ? (
        <span
          aria-label="Restoring sign-in state"
          className="h-7 w-20 animate-pulse rounded-full bg-slate-100"
        />
      ) : user ? (
        <UserMenu />
      ) : (
        <SignInButton />
      )}
    </header>
  )
}