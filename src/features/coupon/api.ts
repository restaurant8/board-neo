import { post, getPaginated } from '@/lib/api-client'

/** 优惠券类型，对应 CouponGenerate 规则 type in:1,2。 */
export const COUPON_TYPE_MAP: Record<number, string> = {
  1: '金额',
  2: '比例',
}

/** 列表「类型」列徽标文案，对齐原版 table.toolbar.types。 */
export const COUPON_TYPE_BADGE_MAP: Record<number, string> = {
  1: '按金额优惠',
  2: '按比例优惠',
}

export const COUPON_TYPE_AMOUNT = 1
export const COUPON_TYPE_PERCENT = 2

/** v2_coupon 表字段。type=1 时 value 以「分」存储；type=2 时为百分比整数。 */
export type Coupon = {
  id: number
  code: string
  name: string
  /** 1=金额 2=比例。 */
  type: number
  /** 金额(分) 或 比例(%)。 */
  value: number
  show: boolean
  /** 总可用次数，null=不限。 */
  limit_use: number | null
  /** 每用户可用次数，null=不限。 */
  limit_use_with_user: number | null
  /** 限定套餐 id，null=不限。 */
  limit_plan_ids: number[] | null
  /** 限定周期键（如 month_price）。 */
  limit_period: string[] | null
  started_at: number
  ended_at: number
  created_at: number
  updated_at: number
}

export type CouponFetchParams = {
  current?: number
  pageSize?: number
  filter?: Array<{ id: string; value: unknown }>
  sort?: Array<{ id: string; desc: boolean }>
}

/**
 * generate 接口入参（对应 CouponGenerate 验证规则）。
 * value：金额(分) 或 比例(%)。started_at/ended_at 为 unix 秒。
 * 传 generate_count 时为批量生成（后端返回 CSV，不走标准信封）。
 */
export type CouponGeneratePayload = {
  id?: number
  generate_count?: number | null
  name: string
  type: number
  value: number
  started_at: number
  ended_at: number
  limit_use?: number | null
  limit_use_with_user?: number | null
  limit_plan_ids?: number[] | null
  limit_period?: string[] | null
  code?: string
}

/** POST /coupon/fetch — 分页列表（路由 any，可 POST）。 */
export function fetchCoupons(params: CouponFetchParams) {
  return getPaginated<Coupon>('/coupon/fetch', params as Record<string, unknown>)
}

/**
 * POST /coupon/generate — 创建/编辑单张（无 generate_count），
 * 或批量生成（带 generate_count，注意后端直接 echo CSV）。
 */
export function generateCoupon(payload: CouponGeneratePayload) {
  return post<boolean>('/coupon/generate', payload)
}

/** POST /coupon/show — 切换显示状态。 */
export function toggleCouponShow(id: number) {
  return post<boolean>('/coupon/show', { id })
}

/** POST /coupon/update — 仅更新 show 字段。 */
export function updateCoupon(payload: { id: number; show?: boolean }) {
  return post<boolean>('/coupon/update', payload)
}

/** POST /coupon/drop — 删除。 */
export function dropCoupon(id: number) {
  return post<boolean>('/coupon/drop', { id })
}
