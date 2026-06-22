import { get } from '@/lib/api-client'

/** GET /system/getSystemStatus — schedule + horizon health. */
export type SystemStatus = {
  schedule: boolean
  horizon: boolean
  schedule_last_runtime: number | null
}

export function getSystemStatus() {
  return get<SystemStatus>('/system/getSystemStatus')
}

/** GET /system/getQueueStats — Horizon aggregate stats. */
export type QueueStats = {
  failedJobs: number
  jobsPerMinute: number
  pausedMasters: number
  processes: number
  recentJobs: number
  status: boolean
  queueWithMaxRuntime?: string | null
  queueWithMaxThroughput?: string | null
  periods?: { failedJobs?: number; recentJobs?: number }
  wait?: Record<string, number> | unknown
}

export function getQueueStats() {
  return get<QueueStats>('/system/getQueueStats')
}

/** GET /system/getQueueWorkload — per-queue workload. */
export type QueueWorkload = {
  name: string
  length: number
  wait: number
  processes?: number
}

export function getQueueWorkload() {
  return get<QueueWorkload[]>('/system/getQueueWorkload')
}

/**
 * GET /system/getQueueMasters — proxied to Horizon's MasterSupervisorController.
 * Horizon returns a bare array (no Xboard envelope), so the interceptor does
 * not unwrap it; res.data is the array itself. Defensive about the shape.
 */
export type QueueMaster = {
  name: string
  status: string
  pid?: number
  supervisors?: string[]
}

export async function getQueueMasters() {
  const body = await get<unknown>('/system/getQueueMasters')
  if (Array.isArray(body)) return body as QueueMaster[]
  // Some Horizon versions wrap as { data: [...] }.
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: QueueMaster[] }).data
  }
  return [] as QueueMaster[]
}

/**
 * GET /system/getHorizonFailedJobs — paginated failed jobs.
 * Returns bare { data, total, current, page_size } (no current_page), so it is
 * not auto-detected as a paginator; unwrap manually.
 */
export type HorizonFailedJob = {
  id: string
  name?: string
  queue?: string
  failed_at?: number
  exception?: string
  [key: string]: unknown
}

export type HorizonFailedJobsResult = {
  data: HorizonFailedJob[]
  total: number
  current: number
  page_size: number
}

export function getHorizonFailedJobs(current = 1, pageSize = 20) {
  return get<HorizonFailedJobsResult>('/system/getHorizonFailedJobs', {
    current,
    page_size: pageSize,
  })
}

/**
 * GET/POST /system/getAuditLog — admin audit log.
 * Returns bare { data, total } (no current_page), so unwrap manually.
 */
export type AuditLog = {
  id: number
  admin_id: number
  admin?: { id: number; email: string } | null
  action?: string
  uri?: string
  method?: string
  ip?: string
  request_data?: string
  created_at?: number | string
  [key: string]: unknown
}

export type AuditLogResult = {
  data: AuditLog[]
  total: number
}

export function getAuditLog(params: {
  current?: number
  page_size?: number
  action?: string
  admin_id?: number
  keyword?: string
}) {
  return get<AuditLogResult>('/system/getAuditLog', params)
}
