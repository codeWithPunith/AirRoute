// Dev-only logging helper. Stripped from production bundles by the DEV guard.
//
// `import.meta.env?.DEV` uses optional chaining deliberately: these modules are
// also imported by plain Node (scripts, algorithm checks) where Vite's compile
// -time substitution has not happened and `import.meta.env` is undefined.
const isDev = () => import.meta.env?.DEV === true

export function debug(...args) {
  if (isDev()) {
    console.log('[airroute]', ...args)
  }
}

export function debugError(...args) {
  if (isDev()) {
    console.error('[airroute]', ...args)
  }
}