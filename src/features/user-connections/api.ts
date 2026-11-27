import { get } from '@/lib/api-client'

export type OnlineConnectionOrderBy =
  | 'connections'
  | 'risk'
  | 'devices'
  | 'nodes'
  | 'last_seen_at'

export type RiskLevel = 'critical' | 'warning' | 'low' | 'normal'

export type RiskFilterLevel = 'any_risk' | RiskLevel

export type RiskRuleCode =
  | 'high_concurrency'
  | 'dense_per_ip'
  | 'multi_region'
  | 'device_over_limit'
  | 'multi_node_fanout'
  | 'shared_client_ip'

export type RiskReason = {
  code: RiskRuleCode
  level: 'critical' | 'warning' | 'low'
  label: string
  detail: string
}

export type OnlineConnSummary = {
  /** 当前实时在线用户数（有并发连接或活跃设备的去重用户数）。 */
  online_users: number
  /** 全站已归属到单用户的 TCP/UDP 并发连接总数（仅计已上报真实并发数的节点）。 */
  total_user_connections: number
  /** 节点 metrics 上报的 active_connections 总和。 */
  total_node_connections: number
  /** 全站实时在线客户端 IP 总数（按用户去重累加）。 */
  total_online_ips: number
  /** 当前承载活跃连接/设备的节点数。 */
  active_nodes: number
  /** 当前达到或超过套餐设备数限制的用户数。 */
  over_limit_users: number
  /** 风控告警用户总数（高危 + 预警）。 */
  risk_users: number
  /** 高危用户数（risk_score >= 70）。 */
  critical_risk_users: number
  /** 预警用户数（35 <= risk_score < 70）。 */
  warning_risk_users: number
  /** 当前跨城市同时在线用户数。 */
  multi_region_users: number
  /** 当前存在多账号共用的客户端 IP 数量。 */
  shared_ip_groups: number
  /** 仅连在旧节点（未上报真实逐用户并发数）的在线用户数。 */
  unreported_users: number
  /** 是否已有节点上报真实单用户并发连接数（user_conns 字段）。 */
  has_connection_report: boolean
}

export type OnlineNodeStat = {
  id: number
  parent_id: number | null
  name: string
  type: string
  is_online: number
  online_users: number
  user_connections: number
  active_connections: number
  effective_connections: number
  connections_reported: boolean
  online_ips: number
}

export type OnlineNodeIp = {
  ip: string
  location: string
  shared_users: number
  last_seen_at: number
}

export type OnlineUserNodeDetail = {
  server_id: number
  server_name: string
  server_type: string
  is_online: number
  connections_reported: boolean
  partial_connections_reported: boolean
  connections: number | null
  ip_count: number
  ips: OnlineNodeIp[]
  updated_at: number
}

export type OnlineUserIpItem = {
  ip: string
  city: string
  location: string
  shared_users: number
  node_ids: number[]
  last_seen_at: number
}

export type OnlineConnectionRow = {
  user_id: number
  user_email: string
  plan_id: number | null
  plan_name: string | null
  plan_speed_limit: number | null
  group_id: number | null
  group_name: string | null
  site_id: number | null
  site_name: string | null
  banned: number
  device_limit: number | null
  speed_limit: number | null
  connections_reported: boolean
  partial_connections_reported: boolean
  filtered_connections_reported: boolean
  total_connections: number | null
  filtered_connections: number | null
  avg_connections_per_ip: number | null
  online_devices: number
  online_region_count: number
  online_cities: string[]
  is_over_limit: boolean
  node_count: number
  risk_score: number
  risk_level: RiskLevel
  risk_reasons: RiskReason[]
  last_seen_at: number
  nodes: OnlineUserNodeDetail[]
  ips: OnlineUserIpItem[]
}

export type OnlineConnectionsResult = {
  summary: OnlineConnSummary
  nodes: OnlineNodeStat[]
  list: OnlineConnectionRow[]
  total: number
  page: number
  page_size: number
}

export type OnlineConnectionsParams = {
  keyword?: string
  /** 精确客户端 IP 反查（严格相等，不模糊匹配前缀）。 */
  ip?: string
  server_id?: number
  site_id?: string
  min_connections?: number
  only_over_limit?: 0 | 1
  risk_level?: RiskFilterLevel
  risk_rule?: RiskRuleCode
  order_by?: OnlineConnectionOrderBy
  order_dir?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export const RISK_RULE_LABELS: Record<RiskRuleCode, string> = {
  high_concurrency: '极端 / 高并发连接',
  dense_per_ip: '单 IP 密集连接',
  multi_region: '跨城异地同时在线',
  device_over_limit: '套餐设备超限',
  multi_node_fanout: '多节点并发扇出',
  shared_client_ip: '同客户端 IP 串号',
}

/** GET /user/onlineConnections — 实时单用户并发连接数 + 在线设备 IP + 所连节点明细 + 风控评估。 */
export function fetchOnlineConnections(params: OnlineConnectionsParams) {
  const clean: Record<string, unknown> = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) clean[k] = v
  })
  return get<OnlineConnectionsResult>('/user/onlineConnections', clean)
}
