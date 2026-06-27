import { get, post, getPaginated } from '@/lib/api-client'
import { type Paginated } from '@/lib/api-types'

export type PlanBrief = {
  id: number
  name: string
}

export type UserBrief = {
  id: number
  email: string
}

/**
 * v2_user 行（经 UserController::transformUserData 转换）：
 * - balance / commission_balance 已 /100（元）
 * - subscribe_url 已附加
 * - total_used = u + d（fetch 里 selectRaw 出来）
 */
export type User = {
  id: number
  email: string
  plan_id: number | null
  group_id: number | null
  invite_user_id: number | null
  /** 流量上行（字节）。 */
  u: number
  /** 流量下行（字节）。 */
  d: number
  /** 总流量配额（字节）。 */
  transfer_enable: number
  total_used?: number
  /** 到期时间（秒级时间戳），null = 长期有效。 */
  expired_at: number | null
  /** 余额（元）。 */
  balance: number
  /** 佣金余额（元）。 */
  commission_balance: number
  commission_rate: number | null
  commission_type: number
  discount: number | null
  speed_limit: number | null
  device_limit: number | null
  is_admin: number
  is_staff: number
  banned: number
  remarks: string | null
  token: string
  uuid: string
  subscribe_url?: string
  /** 在线设备数（v2_user.online_count）。 */
  online_count?: number
  /** 最后在线时间戳（秒），0 = 从未在线（v2_user.t）。 */
  t?: number
  /** 最后登录时间戳（秒）。 */
  last_login_at?: number | null
  /** 最后登录 IP（整数形式存储）。 */
  last_login_ip?: number | null
  created_at: number
  updated_at: number
  plan?: PlanBrief | null
  invite_user?: UserBrief | null
  group?: { id: number; name: string } | null
  /** 订阅类记录的去重归属地数量（>1 视为异地）。fetch 注入。 */
  subscribe_locations?: number
  /** 连接类记录的去重归属地数量（>1 视为异地）。fetch 注入。 */
  connect_locations?: number
}

/** 过滤条件项：value 支持 "eq:1"、"like" 默认模糊、数组（in）。 */
export type UserFilter = { id: string; value: unknown; logic?: 'and' | 'or' }
export type UserSort = { id: string; desc: boolean }

export type UserFetchParams = {
  current?: number
  pageSize?: number
  filter?: UserFilter[]
  sort?: UserSort[]
}

/** GET/POST /user/fetch — 分页用户列表（路由 any）。 */
export function fetchUsers(params: UserFetchParams) {
  return getPaginated<User>('/user/fetch', params as Record<string, unknown>)
}

/** GET /user/getUserInfoById — 单用户详情（含 invite_user）。 */
export function getUserInfoById(id: number) {
  return get<User>('/user/getUserInfoById', { id })
}

/** UserUpdate 请求类允许的字段（以 Controller 为准）。 */
export type UserUpdatePayload = {
  id: number
  email?: string
  /** 留空表示不修改。 */
  password?: string
  /** 字节。 */
  transfer_enable?: number
  expired_at?: number | null
  banned?: boolean
  plan_id?: number | null
  commission_rate?: number | null
  discount?: number | null
  is_admin?: boolean
  is_staff?: boolean
  u?: number
  d?: number
  /** 元（Controller 内 *100）。 */
  balance?: number
  commission_type?: number
  /** 元（Controller 内 *100）。 */
  commission_balance?: number
  remarks?: string | null
  speed_limit?: number | null
  device_limit?: number | null
  /** 设置邀请人邮箱，传空则清除邀请人。 */
  invite_user_email?: string
}

/** POST /user/update — 更新用户。 */
export function updateUser(payload: UserUpdatePayload) {
  return post<boolean>('/user/update', payload)
}

/** 批量操作范围。 */
export type BulkScope = 'selected' | 'filtered' | 'all'

/** POST /user/ban — 封禁（按范围）。 */
export function banUsers(params: {
  scope?: BulkScope
  user_ids?: number[]
  filter?: UserFilter[]
}) {
  return post<boolean>('/user/ban', params)
}

/** POST /user/resetSecret — 重置订阅 token/uuid。 */
export function resetSecret(id: number) {
  return post<boolean>('/user/resetSecret', { id })
}

/** POST /user/setInviteUser — 设置邀请人。 */
export function setInviteUser(id: number, invite_user_email: string) {
  return post<boolean>('/user/setInviteUser', { id, invite_user_email })
}

/** POST /user/destroy — 删除用户及关联数据。 */
export function destroyUser(id: number) {
  return post<boolean>('/user/destroy', { id })
}

export type GeneratePayload = {
  email_prefix?: string
  email_suffix: string
  password?: string
  plan_id?: number | null
  expired_at?: number | null
  generate_count?: number
  /** 为真时后端直接以 CSV 流下载（不返回 JSON 列表）。 */
  download_csv?: boolean
}

export type GeneratedUser = {
  email: string
  password: string
  expired_at: string
  uuid: string
  created_at: string
  subscribe_url: string
}

/** POST /user/generate — 生成用户（返回 JSON 列表）。 */
export function generateUsers(payload: GeneratePayload) {
  return post<GeneratedUser[]>('/user/generate', payload)
}

export type SendMailPayload = {
  subject: string
  content: string
  scope?: BulkScope
  user_ids?: number[]
  filter?: UserFilter[]
}

/** POST /user/sendMail — 群发邮件。 */
export function sendMail(payload: SendMailPayload) {
  return post<boolean>('/user/sendMail', payload)
}

// ----- 使用记录（usageRecords / clearUsageRecords）-----

export type UsageRecordType = 'connect' | 'subscribe'
export type UsageOrderBy = 'record_at' | 'online' | 'count'
export type UsageOrderDir = 'asc' | 'desc'

export type UsageRecord = {
  id: number
  user_id: number
  user_email: string | null
  online_ip_count: number
  type: UsageRecordType
  ip: string
  location: string | null
  server_id: number
  server_name: string
  ua: string | null
  first_at: number
  record_at: number
  count: number
}

export type UsageRecordsResult = {
  data: UsageRecord[]
  total: number
  page: number
  page_size: number
}

export type UsageRecordsParams = {
  user_id?: number
  keyword?: string
  type?: UsageRecordType | ''
  ip?: string
  start_time?: number
  end_time?: number
  order_by?: UsageOrderBy
  order_dir?: UsageOrderDir
  page?: number
  page_size?: number
}

/** GET /user/usageRecords — 用户连接/订阅真实 IP 记录（自定义分页结构）。 */
export function fetchUsageRecords(params: UsageRecordsParams) {
  const clean: Record<string, unknown> = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) clean[k] = v
  })
  return get<UsageRecordsResult>('/user/usageRecords', clean)
}

export type ClearUsageParams = {
  user_id?: number
  keyword?: string
  type?: UsageRecordType | ''
  ip?: string
  start_time?: number
  end_time?: number
}

/** POST /user/clearUsageRecords — 按筛选清除使用记录，无条件则清空全部。 */
export function clearUsageRecords(params: ClearUsageParams) {
  const clean: Record<string, unknown> = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) clean[k] = v
  })
  return post<{ deleted: number }>('/user/clearUsageRecords', clean)
}

// ----- 分配订单（OrderController::assign，复用 order 模块语义）-----

/**
 * 订阅周期键（旧版 *_price），assign 接口入参用这些键。
 * 与 order 模块 PERIOD_MAP 保持一致。
 */
export const ASSIGN_PERIOD_MAP: Record<string, string> = {
  month_price: '月付',
  quarter_price: '季付',
  half_year_price: '半年付',
  year_price: '年付',
  two_year_price: '两年付',
  three_year_price: '三年付',
  onetime_price: '一次性',
  reset_price: '流量重置包',
}

export type AssignOrderPayload = {
  email: string
  plan_id: number
  /** 周期键，如 month_price。 */
  period: string
  /** 单位：分。 */
  total_amount: number
}

/** POST /order/assign — 为指定用户分配订单（返回 trade_no）。 */
export function assignOrder(payload: AssignOrderPayload) {
  return post<string>('/order/assign', payload)
}

// ----- TA的订单（OrderController::fetch 按 user_id 过滤）-----

export const ORDER_STATUS_MAP: Record<number, string> = {
  0: '待支付',
  1: '开通中',
  2: '已取消',
  3: '已完成',
  4: '已折抵',
}

export type UserOrder = {
  id: number
  trade_no: string
  plan_id: number
  /** 旧版周期键。 */
  period: string | null
  /** 分。 */
  total_amount: number
  type: number
  status: number
  created_at: number
  plan?: PlanBrief | null
}

/** GET /order/fetch — 按 user_id 过滤该用户订单。 */
export function fetchUserOrders(userId: number, current = 1, pageSize = 20) {
  return getPaginated<UserOrder>('/order/fetch', {
    current,
    pageSize,
    filter: [{ id: 'user_id', value: `eq:${userId}` }],
  })
}

// ----- TA的邀请（UserController::fetch 按 invite_user_id 过滤）-----

export type InvitedUser = {
  id: number
  email: string
  created_at: number
  expired_at: number | null
  banned: number
  plan?: PlanBrief | null
}

/** GET /user/fetch — 按 invite_user_id 过滤该用户邀请的下级。 */
export function fetchInvitedUsers(userId: number, current = 1, pageSize = 20) {
  return getPaginated<InvitedUser>('/user/fetch', {
    current,
    pageSize,
    filter: [{ id: 'invite_user_id', value: `eq:${userId}` }],
  })
}

// ----- TA的流量记录（StatController::getStatUser）-----

/** v2_stat_user 行（每日流量聚合）。 */
export type StatUserRecord = {
  id: number
  user_id: number
  /** 上行（字节）。 */
  u: number
  /** 下行（字节）。 */
  d: number
  /** 记录时间（秒级时间戳）。 */
  record_at: number
}

/** getStatUser 返回结构（非标准信封：{ data, total }）。 */
export type StatUserResult = {
  data: StatUserRecord[]
  total: number
}

/**
 * GET /stat/getStatUser — 按 user_id 的每日流量记录。
 * 返回非标准信封 { data, total }，api-client 不会拆包，原样返回。
 */
export function fetchUserTraffic(userId: number, page = 1, pageSize = 20) {
  return get<StatUserResult>('/stat/getStatUser', {
    user_id: userId,
    page,
    pageSize,
  })
}

// ----- 重置流量（TrafficResetController::resetUser）-----

/** POST /traffic-reset/reset-user — 手动重置用户流量。 */
export function resetUserTraffic(userId: number, reason?: string) {
  return post<{ user_id: number; email: string }>(
    '/traffic-reset/reset-user',
    { user_id: userId, reason: reason || undefined }
  )
}

// ----- 套餐下拉（来自 PlanController::fetch）-----

export type Plan = {
  id: number
  name: string
  group_id: number
}

/** GET /plan/fetch — 套餐列表（用于编辑/筛选下拉）。 */
export function fetchPlans() {
  return get<Plan[]>('/plan/fetch')
}

export type { Paginated }
