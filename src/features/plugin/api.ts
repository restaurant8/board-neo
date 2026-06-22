import { get, post } from '@/lib/api-client'

/**
 * NOTE: PluginController returns bare `{ data: ... }` / `{ message: ... }`
 * payloads (no Xboard `status` envelope), so the api-client interceptor does
 * NOT unwrap them. The helpers below therefore receive the raw body and unwrap
 * `.data` manually.
 */

export type PluginType = {
  value: string
  label: string
  description: string
  icon: string
}

export type Plugin = {
  code: string
  name: string
  version: string
  description: string
  author: string
  type: string
  is_installed: boolean
  is_enabled: boolean
  is_protected: boolean
  can_be_deleted: boolean
  config: Record<string, PluginConfigField> | unknown[]
  readme: string
  need_upgrade: boolean
  admin_menus?: unknown
  admin_crud?: unknown
}

/** A single field definition inside a plugin's config schema. */
export type PluginConfigField = {
  type?: string
  label?: string
  description?: string
  default?: unknown
  value?: unknown
  options?: Record<string, string> | Array<{ value: string; label: string }>
  placeholder?: string
}

/** GET /plugin/types — available plugin categories. */
export async function getPluginTypes() {
  const body = await get<{ data: PluginType[] }>('/plugin/types')
  return body.data
}

/** GET /plugin/getPlugins — list all plugins (optionally by type). */
export async function getPlugins(type?: string) {
  const body = await get<{ data: Plugin[] }>(
    '/plugin/getPlugins',
    type ? { type } : undefined
  )
  return body.data
}

/** POST /plugin/install */
export function installPlugin(code: string) {
  return post('/plugin/install', { code })
}

/** POST /plugin/uninstall */
export function uninstallPlugin(code: string) {
  return post('/plugin/uninstall', { code })
}

/** POST /plugin/enable */
export function enablePlugin(code: string) {
  return post('/plugin/enable', { code })
}

/** POST /plugin/disable */
export function disablePlugin(code: string) {
  return post('/plugin/disable', { code })
}

/** POST /plugin/upgrade */
export function upgradePlugin(code: string) {
  return post('/plugin/upgrade', { code })
}

/** POST /plugin/delete */
export function deletePlugin(code: string) {
  return post('/plugin/delete', { code })
}

/** POST /plugin/upload — upload a zip plugin package (multipart). */
export function uploadPlugin(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return post('/plugin/upload', fd)
}

/** GET /plugin/config — current config values for a plugin. */
export async function getPluginConfig(code: string) {
  const body = await get<{ data: Record<string, PluginConfigField> }>(
    '/plugin/config',
    { code }
  )
  return body.data
}

/** POST /plugin/config — update plugin config (key→value map). */
export function updatePluginConfig(code: string, config: Record<string, unknown>) {
  return post('/plugin/config', { code, config })
}
