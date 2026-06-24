import { get, post } from '@/lib/api-client'

/** 后端 Server::VALID_TYPES */
export const SERVER_TYPES = [
  'shadowsocks',
  'vmess',
  'vless',
  'trojan',
  'hysteria',
  'tuic',
  'anytls',
  'socks',
  'naive',
  'http',
  'mieru',
] as const
export type ServerType = (typeof SERVER_TYPES)[number]

export const SERVER_TYPE_LABEL: Record<ServerType, string> = {
  shadowsocks: 'Shadowsocks',
  vmess: 'VMess',
  vless: 'VLESS',
  trojan: 'Trojan',
  hysteria: 'Hysteria',
  tuic: 'TUIC',
  anytls: 'AnyTLS',
  socks: 'Socks',
  naive: 'Naive',
  http: 'HTTP',
  mieru: 'Mieru',
}

/** 权限组精简对象（getNodes 注入的 groups[]） */
export type NodeGroup = { id: number; name: string }

/**
 * 节点对象。protocol_settings 因协议而异，用宽松 Record 表示。
 * 字段与 Server 模型 / ServerService::getAllServers 的 append 一致。
 */
export type Server = {
  id: number
  type: ServerType
  name: string
  host: string
  port: string | number
  server_port: number | null
  parent_id: number | null
  machine_id: number | null
  group_ids: number[] | null
  route_ids: number[] | null
  tags: string[] | null
  ips: string[] | null
  excludes: string[] | null
  show: boolean
  enabled: boolean
  rate: string | number
  rate_time_enable: boolean
  rate_time_ranges: Array<{ start: string; end: string; rate: number }> | null
  sort: number | null
  protocol_settings: Record<string, unknown> | null
  custom_outbounds: unknown[] | null
  custom_routes: unknown[] | null
  cert_config: Record<string, unknown> | null
  dns_auto_sync: boolean
  dns_cloudflare_zone_id: string | null
  code: string | null
  u: number | null
  d: number | null
  transfer_enable: number | null
  created_at: number
  updated_at: number
  // getNodes / getAllServers 注入的只读字段
  groups?: NodeGroup[]
  parent?: Server | null
  install_command?: string | null
  online?: number
  online_conn?: number
  is_online?: number
  available_status?: number
  last_check_at?: number | null
  last_push_at?: number | null
  load_status?: unknown
  metrics?: unknown
}

/** save 提交体。protocol_settings 因协议不同，由弹窗按 type 组装。 */
export type ServerSavePayload = {
  id?: number
  type: ServerType
  name: string
  host: string
  port: string | number
  server_port: string | number
  rate: string | number
  show?: number | boolean
  enabled?: boolean
  group_ids?: number[] | null
  route_ids?: number[] | null
  parent_id?: number | null
  machine_id?: number | null
  tags?: string[] | null
  excludes?: number[] | null
  ips?: string[] | null
  rate_time_enable?: boolean
  rate_time_ranges?: Array<{ start: string; end: string; rate: number }> | null
  dns_auto_sync?: boolean
  dns_cloudflare_zone_id?: string | null
  transfer_enable?: number | null
  code?: string | null
  cert_config?: Record<string, unknown> | null
  custom_outbounds?: unknown[] | null
  custom_routes?: unknown[] | null
  protocol_settings?: Record<string, unknown>
  [key: string]: unknown
}

/** GET /server/manage/getNodes — 返回全部节点（按 sort 升序）。 */
export function getNodes() {
  return get<Server[]>('/server/manage/getNodes')
}

/** POST /server/manage/save — 新建（无 id）或更新（带 id）整节点。 */
export function saveNode(payload: ServerSavePayload) {
  return post<boolean>('/server/manage/save', payload)
}

/**
 * POST /server/manage/update — 局部更新（仅 show / enabled / machine_id）。
 * 用于列表内开关切换。
 */
export function updateNode(payload: {
  id: number
  show?: number
  enabled?: boolean
  machine_id?: number | null
}) {
  return post<boolean>('/server/manage/update', payload)
}

/** POST /server/manage/drop — 删除单个节点。 */
export function dropNode(id: number) {
  return post<boolean>('/server/manage/drop', { id })
}

/** POST /server/manage/copy — 复制节点（副本默认隐藏、清空流量）。 */
export function copyNode(id: number) {
  return post<boolean>('/server/manage/copy', { id })
}

/** POST /server/manage/sort — 持久化排序，入参 [{id, order}]。 */
export function sortNodes(items: Array<{ id: number; order: number }>) {
  return post<boolean>('/server/manage/sort', items)
}

/** POST /server/manage/batchDelete — 批量删除。 */
export function batchDeleteNodes(ids: number[]) {
  return post<boolean>('/server/manage/batchDelete', { ids })
}

/** POST /server/manage/batchUpdate — 批量更新 show / enabled / machine_id。 */
export function batchUpdateNodes(payload: {
  ids: number[]
  show?: number
  enabled?: boolean
  machine_id?: number | null
}) {
  return post<boolean>('/server/manage/batchUpdate', payload)
}

/** POST /server/manage/resetTraffic — 重置单节点流量。 */
export function resetTraffic(id: number) {
  return post<boolean>('/server/manage/resetTraffic', { id })
}

/** POST /server/manage/batchResetTraffic — 批量重置流量。 */
export function batchResetTraffic(ids: number[]) {
  return post<boolean>('/server/manage/batchResetTraffic', { ids })
}

/** GET /server/manage/installCommand — 获取节点安装命令。 */
export function getInstallCommand(id: number) {
  return get<{ command: string }>('/server/manage/installCommand', { id })
}

/** GET /server/manage/generateEchKey — 生成 ECH 密钥对。 */
export function generateEchKey(publicName?: string) {
  return get<{ key: string; config: string }>(
    '/server/manage/generateEchKey',
    publicName ? { public_name: publicName } : undefined
  )
}
