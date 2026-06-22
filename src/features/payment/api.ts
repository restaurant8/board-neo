import { get, post } from '@/lib/api-client'

/** v2_payment 表字段。手续费金额字段以「分」存储。 */
export type Payment = {
  id: number
  uuid: string
  payment: string
  name: string
  icon: string | null
  /** 网关配置，结构由具体网关决定。fetch 时已 makeVisible。 */
  config: Record<string, unknown> | null
  notify_domain: string | null
  /** 固定手续费，单位：分。 */
  handling_fee_fixed: number | null
  /** 百分比手续费，0-100。 */
  handling_fee_percent: number | null
  enable: boolean
  sort: number | null
  /** fetch 计算返回的回调地址。 */
  notify_url?: string
  created_at: number
  updated_at: number
}

/**
 * getPaymentForm 返回的单个表单字段定义（PaymentService::form 规范化后）。
 */
export type PaymentFormField = {
  type: string
  label: string
  placeholder?: string
  description?: string
  /** 当前配置值或默认值。 */
  value?: unknown
  /** select 类型可选项。 */
  options?: Record<string, string> | string[]
}

export type PaymentSavePayload = {
  id?: number
  name: string
  icon?: string | null
  payment: string
  config: Record<string, unknown>
  notify_domain?: string | null
  handling_fee_fixed?: number | null
  handling_fee_percent?: number | null
}

/** GET /payment/fetch — 全部支付方式（按 sort 升序）。 */
export function fetchPayments() {
  return get<Payment[]>('/payment/fetch')
}

/** GET /payment/getPaymentMethods — 可用网关名称列表。 */
export function getPaymentMethods() {
  return get<string[]>('/payment/getPaymentMethods')
}

/**
 * POST /payment/getPaymentForm — 指定网关的配置表单定义。
 * key 为配置字段名，value 为字段描述。
 */
export function getPaymentForm(payment: string, id?: number) {
  return post<Record<string, PaymentFormField>>('/payment/getPaymentForm', {
    payment,
    id,
  })
}

/** POST /payment/save — 新增（无 id）或更新（有 id）。 */
export function savePayment(payload: PaymentSavePayload) {
  return post<boolean>('/payment/save', payload)
}

/** POST /payment/drop — 删除。 */
export function dropPayment(id: number) {
  return post<boolean>('/payment/drop', { id })
}

/** POST /payment/show — 切换启用状态。 */
export function togglePayment(id: number) {
  return post<boolean>('/payment/show', { id })
}

/** POST /payment/sort — 按传入 id 顺序持久化排序。 */
export function sortPayments(ids: number[]) {
  return post<boolean>('/payment/sort', { ids })
}
