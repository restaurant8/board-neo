import { get } from '@/lib/api-client'

export type DiagRow = {
  server_id: number
  server_name: string
  category: string
  main_domain: string
  u: number
  d: number
  total: number
}

export type DiagResult = {
  list: DiagRow[]
  total: number
  page: number
  page_size: number
  summary: { u: number; d: number; total: number }
  filters: {
    servers: Array<{ id: number; name: string }>
    categories: string[]
    domains: string[]
  }
}

export type DiagParams = {
  start_time?: number
  end_time?: number
  mode?: 'all' | 'privacy' | 'diagnostic'
  server_keyword?: string
  category?: string
  main_domain?: string
  order_by?: 'total' | 'u' | 'd'
  order_dir?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

/**
 * GET /stat/getTrafficDiagnostics — 节点/类别/域名流量明细。
 * 该接口直接返回 `{ data: {...} }`（非标准信封），故手动取内层 data。
 * 数据由「流量统计模式」开启后采集；privacy 不含主域名，diagnostic 含主域名。
 */
export async function fetchTrafficDiagnostics(params: DiagParams) {
  // 大表聚合可能较慢，单独放宽超时，避免默认 30s 提前中断导致空白
  const r = await get<{ data: DiagResult }>(
    '/stat/getTrafficDiagnostics',
    params,
    { timeout: 120000 }
  )
  return r.data
}

/* -------------------------------------------------------------------------- */
/*                            用户流量审计 (getUserTrafficAudit)               */
/* -------------------------------------------------------------------------- */

/**
 * 用户流量审计单行。后端 `getUserTrafficAudit` 在节点维度（getTrafficDiagnostics）
 * 之外，额外把数据下钻到「用户 × 源IP × 目的地」粒度：每行带 user_id/user_email、
 * source_ip、destination（目的地）、destination_ip、destination_port、network、
 * report_count（上报条数）、首/末记录时间。
 */
export type UserAuditRow = {
  user_id: number
  user_email: string
  server_id: number
  server_type: string
  server_name: string
  mode: string
  source_ip: string
  category: string
  main_domain: string
  destination_ip: string
  destination: string
  destination_port: number
  network: string
  first_record_at: number
  last_record_at: number
  report_count: number
  u: number
  d: number
  total: number
}

export type UserAuditResult = {
  list: UserAuditRow[]
  total: number
  page: number
  page_size: number
  summary: { u: number; d: number; total: number }
  filters: {
    servers: Array<{ id: number; type: string; name: string }>
    users: Array<{ id: number; email: string; uuid: string }>
    categories: string[]
    domains: string[]
    source_ips: string[]
    destinations: string[]
  }
}

export type UserAuditParams = {
  start_time?: number
  end_time?: number
  user_id?: number
  server_id?: number
  user_keyword?: string
  server_keyword?: string
  mode?: 'all' | 'privacy' | 'diagnostic'
  category?: string
  main_domain?: string
  source_ip_keyword?: string
  destination?: string
  order_by?: 'total' | 'u' | 'd'
  order_dir?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

/**
 * GET /stat/getUserTrafficAudit — 用户流量审计明细。
 *
 * 与 getTrafficDiagnostics 的区别：
 * - getTrafficDiagnostics 读 `v2_stat_server_traffic`，按 节点×类别(×主域名) 聚合，
 *   是「节点维度」的流量统计；不含用户、源IP、目的地。
 * - getUserTrafficAudit 读 `v2_user_traffic_audit`，按 用户×节点×源IP×类别×主域名×
 *   目的地×端口×网络 聚合，是「用户维度」的明细审计；默认 mode=diagnostic。
 *   额外返回 user_email、source_ip、destination(_ip/_port)、network、report_count、
 *   首/末记录时间。
 *
 * 同样返回 `{ data: {...} }` 非标准信封，手动取内层 data。
 */
export async function fetchUserTrafficAudit(params: UserAuditParams) {
  // 大表聚合可能较慢，单独放宽超时，避免默认 30s 提前中断导致空白
  const r = await get<{ data: UserAuditResult }>(
    '/stat/getUserTrafficAudit',
    params,
    { timeout: 120000 }
  )
  return r.data
}
