import { get, post } from '@/lib/api-client'

export type ExternalNodeRule = {
  from: string
  to: string
  mode?: 'text' | 'regex'
  case_sensitive?: boolean
}

export type ExternalDnsZone = {
  zone_id: string
  remark: string
  domain: string
}

export type ExternalPullProxySettings = {
  enabled: boolean
  host: string
  port: number
  username: string
  password_configured: boolean
}

export type ExternalProxyMode = 'inherit' | 'direct' | 'socks5'

export type ExternalNodeSource = {
  id: number
  name: string
  type: 'subscription' | 'manual'
  secret_configured: boolean
  subscription_url: string | null
  manual_uri: string | null
  user_agent: string
  proxy_mode: ExternalProxyMode
  proxy_host: string | null
  proxy_port: number | null
  proxy_username: string | null
  proxy_password_configured: boolean
  group_ids: number[]
  enabled: boolean
  dns_alias_enabled: boolean
  dns_cloudflare_zone_id: string | null
  dns_alias_domain: string | null
  auto_sync: boolean
  sync_interval_minutes: number
  next_sync_at: number | null
  sort: number
  name_prefix: string | null
  name_suffix: string | null
  name_template: string | null
  name_override: string | null
  host_override: string | null
  name_rules: ExternalNodeRule[]
  host_label_mappings: ExternalNodeRule[]
  host_rules: ExternalNodeRule[]
  last_sync_at: number | null
  last_sync_status: 'pending' | 'success' | 'failed' | null
  consecutive_failures: number
  last_sync_error: string | null
  node_count: number
  last_skipped_count: number
  created_at: number
  updated_at: number
}

export type ExternalNode = {
  id: number
  source_id: number
  type: string
  name: string
  host: string
  port: number
  original_name: string
  original_host: string
  dns_alias_host: string | null
  dns_target: string | null
  sort: number
  updated_at: number
}

export type ExternalNodeSourcePayload = {
  id?: number
  async_sync?: boolean
  name: string
  type: 'subscription' | 'manual'
  subscription_url?: string
  manual_uri?: string
  user_agent: string
  proxy_mode: ExternalProxyMode
  proxy_host?: string
  proxy_port?: number
  proxy_username?: string
  proxy_password?: string
  group_ids: number[]
  enabled: boolean
  dns_alias_enabled: boolean
  dns_cloudflare_zone_id?: string
  dns_alias_domain?: string
  auto_sync: boolean
  sync_interval_minutes: number
  sort: number
  name_prefix?: string
  name_suffix?: string
  name_template?: string
  name_override?: string
  host_override?: string
  name_rules: ExternalNodeRule[]
  host_label_mappings: ExternalNodeRule[]
  host_rules: ExternalNodeRule[]
}

export type ExternalNodeSourcesResult = {
  sources: ExternalNodeSource[]
  user_agent_presets: Record<string, string>
  pull_proxy: ExternalPullProxySettings
  dns_zones: ExternalDnsZone[]
}

export type ExternalNodeSyncResult = {
  queued?: boolean
  node_count: number
  skipped_count: number
  synced_at: number | null
}

export type ExternalProxyTestPayload = {
  source_id?: number
  subscription_url: string
  user_agent: string
  proxy_mode: ExternalProxyMode
  proxy_host?: string
  proxy_port?: number
  proxy_username?: string
  proxy_password?: string
}

export function fetchExternalNodeSources() {
  return get<ExternalNodeSourcesResult>('/server/external/fetch')
}

export function fetchExternalNodes(sourceId: number) {
  return get<ExternalNode[]>('/server/external/nodes', {
    source_id: sourceId,
  })
}

export function saveExternalNodeSource(payload: ExternalNodeSourcePayload) {
  return post<{ source: ExternalNodeSource; sync: ExternalNodeSyncResult }>(
    '/server/external/save',
    payload
  )
}

export function syncExternalNodeSource(id: number) {
  return post<ExternalNodeSyncResult>('/server/external/sync', {
    id,
    async_sync: true,
  })
}

export function syncAllExternalNodeSources() {
  return post<{
    queued_count: number
    dispatch_failed_count: number
    failed: Array<{ id: number; name: string; error: string }>
  }>('/server/external/syncAll')
}

export function saveExternalPullProxy(payload: {
  enabled: boolean
  host?: string
  port?: number
  username?: string
  password?: string
  clear_password?: boolean
}) {
  return post<ExternalPullProxySettings>('/server/external/saveProxy', payload)
}

export function testExternalPullProxy(payload: ExternalProxyTestPayload) {
  return post<{ bytes: number; elapsed_ms: number; via_proxy: boolean }>(
    '/server/external/testProxy',
    payload
  )
}

export function dropExternalNodeSource(id: number) {
  return post<boolean>('/server/external/drop', { id })
}
