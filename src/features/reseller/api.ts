import { get, post } from '@/lib/api-client'
import { type Paginated } from '@/lib/api-types'

export type ResellerBrand = {
  app_name?: string
  app_description?: string
  logo?: string
  app_url?: string
  support_url?: string
  docs_url?: string
}

export type ResellerSite = {
  id: number
  name: string
  domain: string | null
  status: number
  owner_user_id: number
  owner_email: string | null
  brand: ResellerBrand | null
  user_count: number
  order_count: number
  created_at: number
  updated_at: number
}

export type ResellerSavePayload = {
  id?: number
  name: string
  domain?: string | null
  status?: number
  owner_email?: string
  owner_user_id?: number
  brand?: ResellerBrand | null
}

/** GET /reseller/fetch — full list of sites with owner email + counts. */
export function fetchResellerSites() {
  return get<ResellerSite[]>('/reseller/fetch')
}

/** POST /reseller/save — create (no id) or update (with id). Returns site id. */
export function saveResellerSite(payload: ResellerSavePayload) {
  return post<number>('/reseller/save', payload)
}

/** POST /reseller/show — toggle enabled/disabled. */
export function toggleResellerSite(id: number) {
  return post<boolean>('/reseller/show', { id })
}

/** POST /reseller/drop — delete site. */
export function dropResellerSite(id: number) {
  return post<boolean>('/reseller/drop', { id })
}

export type ResellerApplication = {
  id: number
  user_id: number
  user_email: string | null
  desired_name: string
  desired_domain: string | null
  contact: string | null
  remark: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_remark: string | null
  site_id: number | null
  created_at: number
}

export type ReviewPayload = {
  id: number
  action: 'approve' | 'reject'
  domain?: string | null
  review_remark?: string | null
}

/** GET /reseller/applications — 成为站长申请列表，可按状态过滤。 */
export function fetchResellerApplications(status?: string) {
  return get<ResellerApplication[]>(
    '/reseller/applications',
    status ? { status } : undefined
  )
}

/** POST /reseller/application/review — 审批：approve 通过建站 / reject 拒绝。 */
export function reviewResellerApplication(payload: ReviewPayload) {
  return post<number | boolean>('/reseller/application/review', payload)
}

export type ResellerPricePeriod = {
  period: string
  main_price: number // 主站价（分）
  floor_price: number | null // 底价（分）
  retail_price: number | null // 零售价（分）
  enabled: boolean
}

export type ResellerPricePlan = {
  id: number
  name: string
  exclusive: boolean
  periods: ResellerPricePeriod[]
}

export type ResellerSavePricePayload = {
  site_id: number
  plan_id: number
  period: string
  floor_price: number
  retail_price?: number
  enabled?: boolean
}

/** GET /reseller/prices?site_id= — 某分站的定价矩阵（套餐×周期，底价/零售/上架）。 */
export function fetchResellerPrices(siteId: number) {
  return get<{ plans: ResellerPricePlan[] }>('/reseller/prices', {
    site_id: siteId,
  })
}

/** POST /reseller/prices/save — 设置某(分站,套餐,周期)的底价与上架。 */
export function saveResellerPrice(payload: ResellerSavePricePayload) {
  return post<boolean>('/reseller/prices/save', payload)
}

export type AdminSettlement = {
  id: number
  site_id: number
  site_name: string | null
  owner_email: string | null
  order_id: number
  order_amount: number
  floor_amount: number
  profit_amount: number
  status: string
  created_at: number
}

export type SettlementSummary = {
  platform_revenue: number // 平台底价收入（分，仅 confirmed）
  reseller_profit: number // 站长利润（分）
  gross: number // 流水总额（分）
}

export type AdminSettlementsResponse = Paginated<AdminSettlement> & {
  summary: SettlementSummary
}

/** GET /reseller/settlements — 全部分站结算流水 + 汇总（可按 site_id/status 过滤）。 */
export function fetchAdminSettlements(params: {
  current?: number
  pageSize?: number
  site_id?: number
  status?: string
}) {
  return get<AdminSettlementsResponse>('/reseller/settlements', params)
}

export type ResellerDashboard = {
  sites: { total: number; enabled: number }
  users: number
  orders: number
  pending_applications: number
  revenue: {
    gross: number
    platform: number
    reseller_profit: number
    refunded: number
  }
  top_sites: {
    site_id: number
    site_name: string
    owner_email: string | null
    order_count: number
    gross: number
    platform: number
    profit: number
  }[]
}

/** GET /reseller/dashboard — 分销数据看板（全局指标 + 分站收入排行）。 */
export function fetchResellerDashboard() {
  return get<ResellerDashboard>('/reseller/dashboard')
}

export type ResellerTier = {
  threshold: number // 累计销量门槛（元）
  discount: number // 成本折扣百分比（100=原价，90=9折）
}

/** GET /reseller/tiers — 销量阶梯（成本折扣）配置 + 提现冷静期天数。 */
export function fetchResellerTiers() {
  return get<{ tiers: ResellerTier[]; cooldown_days: number }>(
    '/reseller/tiers'
  )
}

/** POST /reseller/tiers/save — 保存销量阶梯配置 + 提现冷静期。 */
export function saveResellerTiers(tiers: ResellerTier[], cooldownDays: number) {
  return post<boolean>('/reseller/tiers/save', {
    tiers,
    cooldown_days: cooldownDays,
  })
}
