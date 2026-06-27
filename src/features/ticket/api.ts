import { get, post } from '@/lib/api-client'

/** 工单状态，对应 Ticket::$statusMap。 */
export const TICKET_STATUS_MAP: Record<number, string> = {
  0: '开启',
  1: '关闭',
}
export const TICKET_STATUS_OPENING = 0
export const TICKET_STATUS_CLOSED = 1

/** 回复状态，对应 Ticket::REPLY_STATUS_*。 */
export const TICKET_REPLY_STATUS_MAP: Record<number, string> = {
  0: '待回复',
  1: '已回复',
}

/**
 * 工单优先级（level，后端整数 0/1/2）。对齐原版：
 * 低优先=default(深色)、中优先=secondary(灰)、高优先=destructive(红)。
 */
export const TICKET_LEVEL_META: Record<
  number,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  0: { label: '低优先', variant: 'default' },
  1: { label: '中优先', variant: 'secondary' },
  2: { label: '高优先', variant: 'destructive' },
}

export type TicketUser = {
  id: number
  email: string
  [key: string]: unknown
}

/** v2_ticket 表（列表用，含 user）。 */
export type Ticket = {
  id: number
  user_id: number
  subject: string
  level: string | null
  status: number
  reply_status: number | null
  last_reply_user_id: number | null
  created_at: number
  updated_at: number
  user?: TicketUser | null
}

/** v2_ticket_message 表。is_from_admin/is_from_user 为后端 append 属性。 */
export type TicketMessage = {
  id: number
  ticket_id: number
  user_id: number
  message: string
  created_at: number
  updated_at: number
  is_from_user?: boolean
  is_from_admin?: boolean
  user?: TicketUser | null
}

/** fetch(id) 返回的工单详情，含 messages 与 user。 */
export type TicketDetail = Ticket & {
  messages: TicketMessage[]
}

export type TicketFetchParams = {
  current?: number
  pageSize?: number
  status?: number
  /** 数组，对应后端 whereIn(reply_status)。 */
  reply_status?: number[]
  email?: string
}

/**
 * fetchTickets 的返回信封：TicketController::fetchTickets 直接 `response(['data','total'])`，
 * 不是 Laravel 分页对象（无 current_page/last_page）。
 */
export type TicketListResult = {
  data: Ticket[]
  total: number
}

/** GET/POST /ticket/fetch（路由为 any）— 分页工单列表。 */
export function fetchTickets(params: TicketFetchParams) {
  return get<TicketListResult>('/ticket/fetch', params as Record<string, unknown>)
}

/** GET/POST /ticket/fetch?id= — 单工单详情（含消息）。 */
export function fetchTicketDetail(id: number) {
  return get<TicketDetail>('/ticket/fetch', { id })
}

/**
 * GET /ticket/show/{id} — 完整会话。TicketController::show 以路由参数 id 入参，
 * 返回 Ticket::with('user', 'messages.user')，比 fetch?id 多 eager-load 每条
 * 消息的 user（含 email），可在气泡里显示具体发件人。
 * 注意：AdminRoute 当前未注册 show 路由（仅 fetch/reply/close），该 demo 后端
 * 可能 404；按源码契约书写，联调以 fetchTicketDetail 兜底。
 */
export function fetchTicketShow(id: number) {
  return get<TicketDetail>(`/ticket/show/${id}`)
}

/** POST /ticket/reply — 管理员回复工单。 */
export function replyTicket(id: number, message: string) {
  return post<boolean>('/ticket/reply', { id, message })
}

/** POST /ticket/close — 关闭工单。 */
export function closeTicket(id: number) {
  return post<boolean>('/ticket/close', { id })
}
