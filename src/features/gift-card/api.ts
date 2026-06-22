import { get, post, getPaginated } from '@/lib/api-client'

/** 礼品卡模板类型，对应 GiftCardTemplate::getTypeMap()。 */
export const GIFT_CARD_TYPE_MAP: Record<number, string> = {
  1: '通用礼品卡',
  2: '套餐礼品卡',
  3: '盲盒礼品卡',
}

/** 兑换码状态，对应 GiftCardCode::getStatusMap()。 */
export const GIFT_CODE_STATUS_MAP: Record<number, string> = {
  0: '未使用',
  1: '已使用',
  2: '已过期',
  3: '已禁用',
}

export const GIFT_CODE_STATUS_UNUSED = 0
export const GIFT_CODE_STATUS_USED = 1
export const GIFT_CODE_STATUS_EXPIRED = 2
export const GIFT_CODE_STATUS_DISABLED = 3

/** v2_gift_card_template 字段（templates 接口附带 codes_count / used_count）。 */
export type GiftCardTemplate = {
  id: number
  name: string
  description: string | null
  type: number
  type_name?: string
  /** 布尔状态。 */
  status: boolean
  conditions: Record<string, unknown> | null
  rewards: Record<string, unknown>
  limits: Record<string, unknown> | null
  special_config: Record<string, unknown> | null
  icon: string | null
  background_image: string | null
  theme_color: string | null
  sort: number
  admin_id: number
  created_at: number
  updated_at: number
  /** templates 接口附带的统计字段。 */
  codes_count?: number
  used_count?: number
}

/** codes 接口返回的兑换码行（已做投影/脱敏）。 */
export type GiftCardCode = {
  id: number
  template_id: number
  template_name: string
  code: string
  batch_id: string | null
  status: number
  status_name: string
  user_id: number | null
  /** 脱敏邮箱。 */
  user_email: string | null
  used_at: number | null
  expires_at: number | null
  usage_count: number
  max_usage: number
  created_at: number
}

/** usages 接口返回的使用记录行。 */
export type GiftCardUsage = {
  id: number
  code: string
  template_name: string
  user_email: string
  invite_user_email: string | null
  rewards_given: Record<string, unknown> | null
  invite_rewards: Record<string, unknown> | null
  multiplier_applied: number | null
  created_at: number
}

export type GiftCardStatistics = {
  total_stats: {
    templates_count: number
    active_templates_count: number
    codes_count: number
    used_codes_count: number
    usages_count: number
  }
  daily_usages: Array<{ date: string; count: number }>
  type_stats: Array<{ template_name: string; type_name: string; count: number }>
}

/** 分页参数：礼品卡接口用 page / per_page。 */
export type GiftPageParams = {
  page?: number
  per_page?: number
}

export type TemplateListParams = GiftPageParams & {
  type?: number
  status?: 0 | 1
}

export type CodeListParams = GiftPageParams & {
  template_id?: number
  batch_id?: string
  status?: number
}

export type UsageListParams = GiftPageParams & {
  template_id?: number
  user_id?: number
}

export type TemplatePayload = {
  id?: number
  name: string
  description?: string | null
  type: number
  status?: boolean
  conditions?: Record<string, unknown> | null
  rewards: Record<string, unknown>
  limits?: Record<string, unknown> | null
  special_config?: Record<string, unknown> | null
  icon?: string | null
  background_image?: string | null
  theme_color?: string | null
  sort?: number
}

export type GenerateCodesPayload = {
  template_id: number
  count: number
  prefix?: string
  expires_hours?: number
  max_usage?: number
}

// ---- 模板 ----

/** POST /gift-card/templates — 模板分页列表。 */
export function fetchTemplates(params: TemplateListParams) {
  return getPaginated<GiftCardTemplate>(
    '/gift-card/templates',
    params as Record<string, unknown>
  )
}

/** POST /gift-card/create-template。 */
export function createTemplate(payload: TemplatePayload) {
  return post<GiftCardTemplate>('/gift-card/create-template', payload)
}

/** POST /gift-card/update-template。 */
export function updateTemplate(payload: TemplatePayload & { id: number }) {
  return post<GiftCardTemplate>('/gift-card/update-template', payload)
}

/** POST /gift-card/delete-template。 */
export function deleteTemplate(id: number) {
  return post<boolean>('/gift-card/delete-template', { id })
}

/** GET /gift-card/types — 类型映射表。 */
export function fetchTypes() {
  return get<Record<number, string>>('/gift-card/types')
}

// ---- 兑换码 ----

/** POST /gift-card/generate-codes — 批量生成。 */
export function generateCodes(payload: GenerateCodesPayload) {
  return post<{ batch_id: string; count: number; message: string }>(
    '/gift-card/generate-codes',
    payload
  )
}

/** POST /gift-card/codes — 兑换码分页列表。 */
export function fetchCodes(params: CodeListParams) {
  return getPaginated<GiftCardCode>(
    '/gift-card/codes',
    params as Record<string, unknown>
  )
}

/** POST /gift-card/toggle-code — 启用/禁用。 */
export function toggleCode(id: number, action: 'enable' | 'disable') {
  return post<{ message: string }>('/gift-card/toggle-code', { id, action })
}

/** POST /gift-card/update-code — 更新过期时间/次数/状态。 */
export function updateCode(payload: {
  id: number
  expires_at?: number | null
  max_usage?: number
  status?: number
}) {
  return post<GiftCardCode>('/gift-card/update-code', payload)
}

/** POST /gift-card/delete-code。 */
export function deleteCode(id: number) {
  return post<{ message: string }>('/gift-card/delete-code', { id })
}

/** GET /gift-card/export-codes — 导出某批次 txt（返回纯文本）。 */
export function exportCodesUrl(batch_id: string) {
  return get<string>('/gift-card/export-codes', { batch_id })
}

// ---- 使用记录 ----

/** POST /gift-card/usages — 使用记录分页列表。 */
export function fetchUsages(params: UsageListParams) {
  return getPaginated<GiftCardUsage>(
    '/gift-card/usages',
    params as Record<string, unknown>
  )
}

// ---- 统计 ----

/** POST /gift-card/statistics。 */
export function fetchStatistics(params?: {
  start_date?: string
  end_date?: string
}) {
  return post<GiftCardStatistics>('/gift-card/statistics', params ?? {})
}
