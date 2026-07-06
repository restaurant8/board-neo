import { get, post, getPaginated } from '@/lib/api-client'

/** v2_winback_log 记录 + 后端附加的 converted（券是否已用于有效订单）。 */
export type WinbackLog = {
  id: number
  user_id: number
  /** 过期天数阈值（7/30/60）。 */
  tier: number
  /** window=窗口自然触发 backlog=存量清洗。 */
  mode: 'window' | 'backlog'
  coupon_id: number | null
  coupon_code: string
  email: string
  user_expired_at: number
  sent_at: number
  converted: boolean
}

export type WinbackStats = {
  total_sent: number
  window_sent: number
  backlog_sent: number
  converted: number
  conversion_rate: number
}

/** dry-run 预演结果（本轮将发送的数量估算）。 */
export type WinbackPreview = {
  window_sent: number
  backlog_sent: number
  skipped: number
  errors: number
  dry_run: boolean
}

export type WinbackLogsParams = {
  email?: string
  mode?: string
  tier?: number
  current?: number
  pageSize?: number
}

/** GET /winback/fetch — 召回记录（标准分页信封）。 */
export async function fetchWinbackLogs(params: WinbackLogsParams) {
  return getPaginated<WinbackLog>('/winback/fetch', params)
}

/** GET /winback/stats — 汇总统计。 */
export async function fetchWinbackStats() {
  return get<WinbackStats>('/winback/stats')
}

/** POST /winback/preview — 按当前已保存配置 dry-run 估算影响范围。 */
export async function previewWinback() {
  return post<WinbackPreview>('/winback/preview')
}
