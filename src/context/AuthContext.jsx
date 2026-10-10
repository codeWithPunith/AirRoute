import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'

const AuthContext = createContext(null)

/**
 * Tracks the signed-in Firebase user.
 *
 * `loading` stays true until Firebase has restored the existing session from
 * local storage. Consumers must gate on it, otherwise the header flickers
 * "Sign in" for a moment on every page load before flipping to the user menu.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      // Rejects on popup-blocked, cancelled, or unauthorised-domain errors;
      // callers are responsible for surfacing that to the user.
      signInWithGoogle: () => signInWithPopup(auth, googleProvider),
      signOut: () => signOut(auth),
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}