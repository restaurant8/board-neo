import { get, post } from '@/lib/api-client'

/**
 * 订阅周期键（Plan::getAvailablePeriods 的 key）。价格存于 plan.prices 这个
 * map 中，单位为「元」（PlanSave::passedValidation 用 round($price, 2) 存浮点元，
 * 非分）。
 */
export const PLAN_PERIODS = [
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
  'two_yearly',
  'three_yearly',
  'onetime',
  'reset_traffic',
] as const

export type PlanPeriod = (typeof PLAN_PERIODS)[number]

/** 周期中文名，对应 Plan::getAvailablePeriods()[*]['name']。 */
export const PLAN_PERIOD_NAMES: Record<PlanPeriod, string> = {
  monthly: '月付',
  quarterly: '季付',
  half_yearly: '半年付',
  yearly: '年付',
  two_yearly: '两年付',
  three_yearly: '三年付',
  onetime: '一次性',
  reset_traffic: '流量重置包',
}

/** 流量重置方式，对应 Plan::getResetTrafficMethods()。null = 跟随系统。 */
export const RESET_TRAFFIC_METHODS: Array<{
  value: number | null
  label: string
}> = [
  { value: null, label: '跟随系统设置' },
  { value: 0, label: '每月1号' },
  { value: 1, label: '按月重置' },
  { value: 2, label: '不重置' },
  { value: 3, label: '每年1月1日' },
  { value: 4, label: '按年重置' },
]

export type PlanGroupBrief = {
  id: number
  name: string
}

/** v2_plan 表。prices 为周期→价格（元）的 map；transfer_enable 存 GB（见下）。 */
export type Plan = {
  id: number
  name: string
  group_id: number | null
  /** 流量配额。注意：DB 存字节，但 fetch 直接返回 DB 原值（无转换）。 */
  transfer_enable: number
  speed_limit: number | null
  show: boolean
  renew: boolean
  sell: boolean
  prices: Record<string, number> | null
  tags: string[] | null
  sort: number | null
  content: string | null
  reset_traffic_method: number | null
  capacity_limit: number | null
  device_limit: number | null
  created_at: number
  updated_at: number
  group?: PlanGroupBrief | null
  users_count?: number
  active_users_count?: number
}

/**
 * POST /plan/save 入参（PlanSave）。
 * - transfer_enable：单位 GB，整数（保存时后端不会再 *1073741824，直接存该值；
 *   force_update 分支才会乘以 1073741824 写入 user 表，故此处约定填 GB）。
 * - prices：周期→价格（元），留空的周期会被后端清理。
 */
export type PlanSavePayload = {
  id?: number
  name: string
  content?: string | null
  reset_traffic_method?: number | null
  transfer_enable: number
  prices?: Record<string, number>
  group_id?: number | null
  speed_limit?: number | null
  device_limit?: number | null
  capacity_limit?: number | null
  tags?: string[] | null
  /** 编辑时是否强制同步到该套餐下所有用户。 */
  force_update?: boolean
}

/** GET /plan/fetch — 套餐列表（按 sort 升序，含 group 与用户数）。 */
export function fetchPlans() {
  return get<Plan[]>('/plan/fetch')
}

/** POST /plan/save — 新建（无 id）或编辑（带 id）。 */
export function savePlan(payload: PlanSavePayload) {
  return post<boolean>('/plan/save', payload)
}

/** POST /plan/drop — 删除（该套餐下有订单/用户时后端会拒绝）。 */
export function dropPlan(id: number) {
  return post<boolean>('/plan/drop', { id })
}

/**
 * POST /plan/update — 仅更新 show / renew / sell 三个开关之一或多个。
 */
export function updatePlan(payload: {
  id: number
  show?: boolean
  renew?: boolean
  sell?: boolean
}) {
  return post<boolean>('/plan/update', payload)
}

/** POST /plan/sort — 按 ids 顺序重排 sort。 */
export function sortPlans(ids: number[]) {
  return post<boolean>('/plan/sort', { ids })
}
