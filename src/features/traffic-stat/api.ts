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
  const r = await get<{ data: DiagResult }>('/stat/getTrafficDiagnostics', params)
  return r.data
}
