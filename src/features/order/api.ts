import { post } from '@/lib/api-client'
import { type Paginated } from '@/lib/api-types'

/** 订单状态，对应后端 Order::$statusMap。 */
export const ORDER_STATUS_MAP: Record<number, string> = {
  0: '待支付',
  1: '开通中',
  2: '已取消',
  3: '已完成',
  4: '已折抵',
}

/** 订单类型，对应后端 Order::$typeMap。 */
export const ORDER_TYPE_MAP: Record<number, string> = {
  1: '新购',
  2: '续费',
  3: '升级',
  4: '流量重置',
}

/** 佣金状态。 */
export const COMMISSION_STATUS_MAP: Record<number, string> = {
  0: '待确认',
  1: '发放中',
  2: '已发放',
  3: '无效',
}

/**
 * 订阅周期（旧版周期键）。后端 OrderController::detail / fetch 会把内部周期
 * 通过 PlanService::getLegacyPeriod 转回这些 *_price 键；assign 接口入参也用这些键。
 */
export const PERIOD_MAP: Record<string, string> = {
  month_price: '月付',
  quarter_price: '季付',
  half_year_price: '半年付',
  year_price: '年付',
  two_year_price: '两年付',
  three_year_price: '三年付',
  onetime_price: '一次性',
  reset_price: '流量重置包',
}

/**
 * 旧版周期键 → 数据库内部 period 值（whereIn 过滤时需用内部值）。
 * 对应后端 Plan::LEGACY_PERIOD_MAPPING。
 */
export const PERIOD_LEGACY_TO_INTERNAL: Record<string, string> = {
  month_price: 'monthly',
  quarter_price: 'quarterly',
  half_year_price: 'half_yearly',
  year_price: 'yearly',
  two_year_price: 'two_yearly',
  three_year_price: 'three_yearly',
  onetime_price: 'onetime',
  reset_price: 'reset_traffic',
}

export type PlanBrief = {
  id: number
  name: string
}

/** v2_order 表字段（金额均以「分」存储，展示时 /100）。 */
export type Order = {
  id: number
  user_id: number
  plan_id: number
  payment_id: number | null
  /** 旧版周期键，如 month_price。 */
  period: string | null
  trade_no: string
  total_amount: number
  handling_amount: number | null
  balance_amount: number | null
  surplus_credit: number | null
  surplus_amount: number | null
  discount_amount: number | null
  type: number
  status: number
  surplus_order_ids: number[] | null
  coupon_id: number | null
  commission_status: number | null
  invite_user_id: number | null
  commission_balance: number | null
  commission_rate: number | null
  actual_commission_balance: number | null
  paid_at: number | null
  callback_no: string | null
  created_at: number
  updated_at: number
  plan?: PlanBrief | null
  /** 订单来源：null=主站，否则为分站名 */
  site_name?: string | null
}

export type OrderUser = {
  id: number
  email: string
}

/** OrderController::detail 返回，含关联模型。 */
export type OrderDetail = Order & {
  user?: OrderUser | null
  invite_user?: OrderUser | null
  commission_log?: unknown[]
  surplus_orders?: Order[]
}

export type OrderFetchParams = {
  current?: number
  pageSize?: number
  is_commission?: boolean
  /** [{ id, value }]，value 支持 "eq:xx" 等操作符或数组。 */
  filter?: Array<{ id: string; value: unknown }>
  sort?: Array<{ id: string; desc: boolean }>
}

export type OrderAssignPayload = {
  plan_id: number
  email: string
  /** 单位：分。 */
  total_amount: number
  period: string
}

/**
 * POST /order/fetch — 分页列表（路由为 any，可 POST）。
 * 用 POST 以可靠地传递嵌套的 filter / sort 数组（GET query 序列化不稳定）。
 */
export function fetchOrders(params: OrderFetchParams) {
  return post<Paginated<Order>>('/order/fetch', params)
}

/** POST /order/detail — 订单详情。 */
export function fetchOrderDetail(id: number) {
  return post<OrderDetail>('/order/detail', { id })
}

/** POST /order/update — 目前仅支持更新 commission_status。 */
export function updateOrder(payload: {
  trade_no: string
  commission_status: number
}) {
  return post<boolean>('/order/update', payload)
}

/** POST /order/assign — 手动为用户分配订单。 */
export function assignOrder(payload: OrderAssignPayload) {
  return post<string>('/order/assign', payload)
}

/** POST /order/paid — 标记待支付订单为已支付。 */
export function markOrderPaid(trade_no: string) {
  return post<boolean>('/order/paid', { trade_no })
}

/** POST /order/cancel — 取消待支付订单。 */
export function cancelOrder(trade_no: string) {
  return post<boolean>('/order/cancel', { trade_no })
}
