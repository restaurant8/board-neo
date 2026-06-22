import { get, post } from '@/lib/api-client'

/** 机器列表项（fetch）。load_status 为后端上报的负载快照（结构不定）。 */
export type Machine = {
  id: number
  name: string
  notes: string | null
  is_active: boolean | number
  last_seen_at: number | null
  load_status: Record<string, unknown> | null
  servers_count: number
  created_at: number
  updated_at: number
}

export type MachineSavePayload = {
  id?: number
  name: string
  notes?: string | null
  is_active?: boolean
}

/** save 新建时返回的内容（编辑时仅返回 true）。 */
export type MachineCreateResult = {
  id: number
  token: string
  install_command: string
}

/** 机器下的节点（nodes）。 */
export type MachineNode = {
  id: number
  name: string
  type: string
  host: string
  port: number | null
  show: number
  enabled: number
  sort: number | null
}

/** 负载历史一条记录（history）。 */
export type LoadHistoryPoint = {
  cpu: number
  mem_total: number
  mem_used: number
  disk_total: number
  disk_used: number
  net_in_speed: number
  net_out_speed: number
  recorded_at: number
}

/** 升级状态对象（随每个 backend 返回，也用于 upgradeStatus 轮询）。 */
export type UpgradeStatus = {
  status:
    | 'dispatched'
    | 'started'
    | 'restarting'
    | 'success'
    | 'skipped'
    | 'failed'
    | string
  updated_at?: number
  to_version?: string
  error?: string
} | null

/** 后端进程（backends）。机器模式一台机器一个进程；单节点模式每节点一个进程。 */
export type Backend = {
  type: 'machine' | 'node'
  id: number
  name: string
  host: string
  ips: string[]
  is_active: boolean
  online: boolean
  last_seen_at: number | null
  nodes_count: number
  version: string
  build_time: string
  commit: string
  kernel: string
  arch: string
  load_status: Record<string, unknown> | null
  upgrade: UpgradeStatus
}

export type BackendsResult = {
  backends: Backend[]
  download_base: string
}

/** GitHub 最新发布版本（latestVersion）。 */
export type LatestVersion = {
  repo: string
  latest: {
    version: string
    name: string
    html_url: string
    published_at: string
  } | null
}

export type UpgradeTarget = { type: 'machine' | 'node'; id: number }

export type UpgradeStatusItem = {
  type: 'machine' | 'node'
  id: number
  status: UpgradeStatus
}

/** GET /server/machine/fetch — 机器列表（含关联节点数）。 */
export function fetchMachines() {
  return get<Machine[]>('/server/machine/fetch')
}

/** POST /server/machine/save — 无 id 新建（返回 token/安装命令），有 id 更新（返回 true）。 */
export function saveMachine(payload: MachineSavePayload) {
  return post<MachineCreateResult | boolean>('/server/machine/save', payload)
}

/** POST /server/machine/drop — 删除机器（自动解除关联节点）。 */
export function dropMachine(id: number) {
  return post<boolean>('/server/machine/drop', { id })
}

/** POST /server/machine/resetToken — 重置 token，返回新 token。 */
export function resetMachineToken(id: number) {
  return post<{ token: string }>('/server/machine/resetToken', { id })
}

/** GET /server/machine/getToken — 获取机器 token。 */
export function getMachineToken(id: number) {
  return get<{ token: string }>('/server/machine/getToken', { id })
}

/** GET /server/machine/installCommand — 一键安装命令。 */
export function getInstallCommand(id: number) {
  return get<{ command: string }>('/server/machine/installCommand', { id })
}

/** GET /server/machine/nodes — 机器下节点列表。 */
export function fetchMachineNodes(machineId: number) {
  return get<MachineNode[]>('/server/machine/nodes', { machine_id: machineId })
}

/** GET /server/machine/history — 机器负载历史。 */
export function fetchMachineHistory(
  machineId: number,
  params?: { limit?: number; range_hours?: number }
) {
  return get<LoadHistoryPoint[]>('/server/machine/history', {
    machine_id: machineId,
    ...params,
  })
}

/** GET /server/machine/backends — 所有运行中后端进程 + 下载源。 */
export function fetchBackends() {
  return get<BackendsResult>('/server/machine/backends')
}

/** GET /server/machine/latestVersion — 查询节点二进制最新发布版本（可能为 null）。 */
export function fetchLatestVersion() {
  return get<LatestVersion>('/server/machine/latestVersion')
}

/** POST /server/machine/upgrade — 下发升级（按后端去重）。 */
export function upgradeBackends(payload: {
  all?: boolean
  targets?: UpgradeTarget[]
  version?: string
  download_base?: string
}) {
  return post<{ dispatched: number }>('/server/machine/upgrade', payload)
}

/** POST /server/machine/restart — 下发重启（按后端去重）。 */
export function restartBackends(payload: {
  all?: boolean
  targets?: UpgradeTarget[]
}) {
  return post<{ dispatched: number }>('/server/machine/restart', payload)
}

/** POST /server/machine/upgradeStatus — 轮询升级状态。 */
export function fetchUpgradeStatus(targets: UpgradeTarget[]) {
  return post<UpgradeStatusItem[]>('/server/machine/upgradeStatus', { targets })
}
