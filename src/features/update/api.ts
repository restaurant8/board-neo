import { get, post } from '@/lib/api-client'

/** A single commit entry in the update log (from checkForUpdates). */
export type UpdateLog = {
  version: string
  message: string
  author: string
  date: string
  is_local?: boolean
}

/**
 * GET /update/check — result of UpdateService::checkForUpdates().
 * Compares the local git HEAD against the upstream repo commits.
 */
export type CheckUpdateResult = {
  has_update: boolean
  is_local_newer?: boolean
  latest_version: string
  current_version: string
  update_logs: UpdateLog[]
  download_url?: string
  published_at?: string
  author?: string
}

/** Successful payload of UpdateService::executeUpdate(). */
export type ExecuteUpdateResult = {
  success: boolean
  message: string
  version?: string
  update_info?: {
    from_version: string
    to_version: string
    update_logs: string[]
    author: string
    published_at: string
  }
}

/** GET /update/check — check upstream for a newer version. */
export function checkUpdate() {
  return get<CheckUpdateResult>('/update/check')
}

/** POST /update/execute — pull latest code, migrate, clear cache, restart. */
export function executeUpdate() {
  return post<ExecuteUpdateResult>('/update/execute')
}
