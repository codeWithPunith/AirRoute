// Firebase client initialisation. All configuration comes from Vite env vars.
//
// Vite only exposes variables prefixed with `VITE_` to client code, and only
// those that exist at BUILD time — see
// https://vite.dev/guide/env-and-mode.html (env vars must start with VITE_ to
// be exposed, and `.env.local` is loaded automatically but gitignored).
//
// These values identify the Firebase project; they are not secrets. Access is
// gated by the project's Security Rules, not by hiding the API key.

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * True when every required key is present. Checked so the UI can explain a
 * missing `.env.local` instead of surfacing a raw `auth/invalid-api-key`.
 */
export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean)

if (!isFirebaseConfigured && import.meta.env?.DEV) {
  console.warn(
    '[airroute] Firebase env vars are missing. Copy .env.example to .env.local, ' +
      'fill in the values from Firebase Console → Project Settings → General, ' +
      'then restart the dev server.',
  )
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

// Selects an account every time, and asks for nothing beyond the default
// profile scopes (openid, email, profile).
export const googleProvider = new GoogleAuthProvider()