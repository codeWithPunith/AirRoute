// Dev-only logging helper. Stripped from production bundles by the DEV guard.
export function debug(...args) {
  if (import.meta.env.DEV) {
    console.log('[airroute]', ...args)
  }
}

export function debugError(...args) {
  if (import.meta.env.DEV) {
    console.error('[airroute]', ...args)
  }
}