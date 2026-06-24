import { get } from '@/lib/api-client'

export type TrafficTriple = {
  upload: number
  download: number
  total: number
}

/** GET /stat/getStats — 综合统计（含增长率、在线、流量）。金额单位：分。 */
export type Stats = {
  todayIncome: number
  dayIncomeGrowth: number
  currentMonthIncome: number
  lastMonthIncome: number
  monthIncomeGrowth: number
  lastMonthIncomeGrowth: number
  currentMonthCommissionPayout: number
  lastMonthCommissionPayout: number
  commissionGrowth: number
  commissionPendingTotal: number
  currentMonthNewUsers: number
  totalUsers: number
  activeUsers: number
  userGrowth: number
  onlineUsers: number
  onlineDevices: number
  ticketPendingTotal: number
  onlineNodes: number
  todayTraffic: TrafficTriple
  monthTraffic: TrafficTriple
  totalTraffic: TrafficTriple
}

// 注意：getStats/getOverride/getStatRecord/getTrafficRank 控制器直接返回
// 数组（非 $this->success 信封），api-client 不会解包，故需手动取内层。
export async function fetchStats() {
  const res = await get<{ data: Stats }>('/stat/getStats')
  return res.data
}

/** GET /stat/getOverride — 概览（与 getStats 部分重叠，金额单位：分）。 */
export type Override = {
  month_income: number
  month_register_total: number
  ticket_pending_total: number
  commission_pending_total: number
  day_income: number
  last_month_income: number
  commission_month_payout: number
  commission_last_month_payout: number
  online_nodes: number
  online_devices: number
  online_users: number
  today_traffic: TrafficTriple
  month_traffic: TrafficTriple
  total_traffic: TrafficTriple
}

export async function fetchOverride() {
  const res = await get<{ data: Override }>('/stat/getOverride')
  return res.data
}

/**
 * GET /stat/getStatRecord — 趋势记录。type:
 * - paid_total（收款金额，已 /100 元）
 * - commission_total（佣金金额，已 /100 元）
 * - register_count（注册量，读 register_count 字段）
 * 返回 v2_stat 行数组（record_at 秒级）。
 */
export type StatRecord = {
  id: number
  record_at: number
  record_type: string
  paid_total: number
  paid_count: number
  commission_total: number
  commission_count: number
  register_count: number
  [key: string]: unknown
}

export type StatRecordType = 'paid_total' | 'commission_total' | 'register_count'

export async function fetchStatRecord(
  type: StatRecordType,
  range?: { start_date?: number; end_date?: number }
) {
  const res = await get<{ data: StatRecord[] }>('/stat/getStatRecord', {
    type,
    ...(range?.start_date ? { start_date: range.start_date } : {}),
    ...(range?.end_date ? { end_date: range.end_date } : {}),
  })
  return res.data ?? []
}

/** GET /stat/getServerLastRank — 当日节点实时流量排行（StatisticalService::getServerRank）。 */
export type ServerRankItem = {
  server_name: string
  server_id: number
  server_type: string
  u: number
  d: number
  total: number
}

export function fetchServerLastRank() {
  return get<ServerRankItem[]>('/stat/getServerLastRank')
}

/** GET /stat/getServerYesterdayRank — 昨日节点流量排行。 */
export function fetchServerYesterdayRank() {
  return get<ServerRankItem[]>('/stat/getServerYesterdayRank')
}

/**
 * GET /stat/getTrafficRank — 节点/用户流量排行（近 7 天，带环比）。
 * 注意：此接口为信封 data 直接为 { timestamp, data:[...] }，
 * api-client 解包后返回该对象（其内层仍有 data 字段）。
 */
export type TrafficRankItem = {
  id: string
  name: string
  value: number
  previousValue: number
  change: number
  timestamp: string
}

export type TrafficRankResult = {
  timestamp: string
  data: TrafficRankItem[]
}

export function fetchTrafficRank(params: {
  type: 'node' | 'user'
  start_time?: number
  end_time?: number
}) {
  return get<TrafficRankResult>('/stat/getTrafficRank', params)
}
