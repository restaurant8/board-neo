import { get, post } from '@/lib/api-client'

export type DnsZone = {
  zone_id: string
  remark: string
}

/** GET /server/dns/config 返回的全局 Cloudflare 配置。 */
export type DnsConfig = {
  api_token: string
  zones: DnsZone[]
  /** 兼容旧字段：第一个 zone 的 id。 */
  zone_id: string
  proxied: boolean
  ttl: number
}

/** 单个域名节点的 DNS 同步状态（nodes）。 */
export type DnsNode = {
  id: number
  name: string
  host: string
  dns_auto_sync: boolean
  zone_id: string
  last_ip: string | null
  last_host: string | null
  last_status: 'success' | 'waiting' | 'skipped' | 'failed' | string | null
  last_error: string | null
  last_at: number | null
}

/** POST /server/dns/node 保存后返回的最新同步结果。 */
export type SaveNodeResult = {
  sync: unknown
  last_ip: string | null
  last_status: string | null
  last_error: string | null
  last_at: number | null
}

export type DnsConfigPayload = {
  api_token?: string
  zones?: DnsZone[]
  proxied?: boolean
  ttl?: number
}

/** GET /server/dns/config — 读取全局 Cloudflare 配置。 */
export function fetchDnsConfig() {
  return get<DnsConfig>('/server/dns/config')
}

/** POST /server/dns/config — 保存全局 Cloudflare 配置。 */
export function saveDnsConfig(payload: DnsConfigPayload) {
  return post<boolean>('/server/dns/config', payload)
}

/** GET /server/dns/nodes — 域名节点列表（仅 host 为域名的节点）。 */
export function fetchDnsNodes() {
  return get<DnsNode[]>('/server/dns/nodes')
}

/** POST /server/dns/node — 保存单节点开关 / zone，并立即尝试同步一次。 */
export function saveDnsNode(payload: {
  id: number
  dns_auto_sync: boolean
  zone_id?: string
}) {
  return post<SaveNodeResult>('/server/dns/node', payload)
}
