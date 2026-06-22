/**
 * Runtime configuration.
 *
 * Values are injected at deploy time via `public/settings.js` (and an optional
 * `settings.local.js`) which set `window.XBOARD_CONFIG`. This mirrors the way the
 * official Xboard admin panel injects `secure_path` without rebuilding.
 *
 * - `apiBase`  : origin of the Xboard backend. Empty string = same origin
 *                (recommended in production, and in dev via the Vite proxy).
 * - `securePath`: the dynamic admin route prefix (`admin_setting('secure_path')`).
 */

type XboardConfig = {
  apiBase?: string
  securePath?: string
  title?: string
}

declare global {
  interface Window {
    XBOARD_CONFIG?: XboardConfig
  }
}

const injected: XboardConfig =
  (typeof window !== 'undefined' && window.XBOARD_CONFIG) || {}

export const config = {
  /** Backend origin. '' means same-origin (Vite proxy in dev, Laravel in prod). */
  apiBase: injected.apiBase ?? import.meta.env.VITE_API_BASE ?? '',
  /** Dynamic admin path prefix, e.g. "a4bd57db". */
  securePath:
    injected.securePath ?? import.meta.env.VITE_SECURE_PATH ?? 'admin',
  /** Panel title. */
  title: injected.title ?? 'Xboard',
}

/** Base URL for public (passport/guest) v2 endpoints. */
export const apiV2Base = `${config.apiBase}/api/v2`

/** Base URL for authenticated admin endpoints (prefixed by secure_path). */
export const adminBase = `${config.apiBase}/api/v2/${config.securePath}`
