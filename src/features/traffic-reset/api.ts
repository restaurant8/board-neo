import { get, post } from '@/lib/api-client'

/**
 * 注意：TrafficResetController 不使用标准信封 `{status,message,data,error}`，
 * 而是直接返回 `{data, pagination}` / `{data}` / `{message}`。api-client 的拦截器
 * 对这种响应原样透传，因此这里的 get/post 返回的是「整个响应体」，需自行取 .data。
 */

export type TrafficValue = {
  upload: number
  download: number
  total: number
  formatted: string
}

export type TrafficResetLog = {
  id: number
  user_id: number
  user_email: string
  reset_type: string
  reset_type_name: string
  reset_time: string
  old_traffic: TrafficValue
  new_traffic: TrafficValue
  trigger_source: string
  trigger_source_name: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export type TrafficLogsPagination = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type TrafficLogsResponse = {
  data: TrafficResetLog[]
  pagination: TrafficLogsPagination
}

export type TrafficStats = {
  total_resets: number
  auto_resets: number
  manual_resets: number
  cron_resets: number
}

export type UserHistoryEntry = {
  id: number
  reset_type: string
  reset_type_name: string
  reset_time: string
  old_traffic: TrafficValue
  trigger_source: string
  trigger_source_name: string
  metadata: Record<string, unknown> | null
}

export type UserHistory = {
  user: {
    id: number
    email: string
    reset_count: number | null
    last_reset_at: string | null
    next_reset_at: string | null
  }
  history: UserHistoryEntry[]
}

export type LogsParams = {
  user_id?: number
  user_email?: string
  reset_type?: string
  trigger_source?: string
  start_date?: string
  end_date?: string
  per_page?: number
  page?: number
}

/** GET /traffic-reset/logs — 重置日志（自定义分页结构 {data, pagination}）。 */
export async function fetchResetLogs(params: LogsParams) {
  return get<TrafficLogsResponse>('/traffic-reset/logs', params)
}

/** GET /traffic-reset/stats — 统计卡片数据，包裹在 {data}。 */
export async function fetchResetStats(days?: number) {
  const res = await get<{ data: TrafficStats }>('/traffic-reset/stats', { days })
  return res.data
}

/** GET /traffic-reset/user/{userId}/history — 用户重置历史，包裹在 {data}。 */
export async function fetchUserHistory(userId: number, limit?: number) {
  const res = await get<{ data: UserHistory }>(
    `/traffic-reset/user/${userId}/history`,
    { limit }
  )
  return res.data
}

/** POST /traffic-reset/reset-user — 手动重置某用户；失败时后端返回非 2xx，axios 抛错。 */
export async function resetUser(payload: { user_id: number; reason?: string }) {
  return post<{ message: string; data: unknown }>(
    '/traffic-reset/reset-user',
    payload
  )
}
