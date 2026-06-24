/**
 * Runtime configuration.
 *
 * Two injection sources are supported, in priority order:
 * 1. `window.XBOARD_CONFIG` — set by `public/settings.js` (used in dev; the Vite
 *    proxy forwards `/api`). Lets us point at any backend without rebuilding.
 * 2. `window.settings` — injected by Xboard's `admin.blade.php` in production
 *    (`{ base_url, secure_path, title, ... }`). This makes the built panel work
 *    when served from the backend's `/{secure_path}` route with no extra config.
 *
 * - `apiBase`   : origin of the backend. '' = same origin.
 * - `securePath`: dynamic admin route prefix (`admin_setting('secure_path')`).
 */

type XboardConfig = {
  apiBase?: string
  securePath?: string
  title?: string
}

type BladeSettings = {
  base_url?: string
  secure_path?: string
  title?: string
}

declare global {
  interface Window {
    XBOARD_CONFIG?: XboardConfig
    settings?: BladeSettings
  }
}

const injected: XboardConfig =
  (typeof window !== 'undefined' && window.XBOARD_CONFIG) || {}
const blade: BladeSettings =
  (typeof window !== 'undefined' && window.settings) || {}

/** base_url "/" (or empty) means same-origin → apiBase ''. */
function normalizeBase(base?: string): string | undefined {
  if (base == null) return undefined
  const trimmed = base.replace(/\/+$/, '')
  return trimmed === '' ? '' : trimmed
}

export const config = {
  /** Backend origin. '' means same-origin (Vite proxy in dev, Laravel in prod). */
  apiBase:
    injected.apiBase ??
    normalizeBase(blade.base_url) ??
    import.meta.env.VITE_API_BASE ??
    '',
  /** Dynamic admin path prefix, e.g. "readmin0". */
  securePath:
    injected.securePath ??
    blade.secure_path ??
    import.meta.env.VITE_SECURE_PATH ??
    'admin',
  /** Panel title. */
  title: injected.title ?? blade.title ?? 'Xboard',
}

/** Base URL for public (passport/guest) v2 endpoints. */
export const apiV2Base = `${config.apiBase}/api/v2`

/** Base URL for authenticated admin endpoints (prefixed by secure_path). */
export const adminBase = `${config.apiBase}/api/v2/${config.securePath}`
