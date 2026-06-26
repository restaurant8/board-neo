/**
 * 前端自更新：调用站点根目录的 `update.php`（与本前端同源，需服务器支持 PHP）。
 * - check：比对当前已部署版本与 board-neo dist-standalone 分支最新 commit。
 * - apply：让 update.php 下载最新 dist 并覆盖当前站点目录。
 * 鉴权用密钥（与 update.php 里的 UPDATE_TOKEN 一致），存在浏览器本地。
 */

const ENDPOINT = '/update.php'
const TOKEN_KEY = 'bn_update_token'

export function getUpdateToken(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) ?? ''
}
export function setUpdateToken(token: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export type CheckUpdateResult = {
  current_version: string
  latest_version: string
  has_update: boolean
  published_at?: string
  message?: string
}

export type ExecuteUpdateResult = {
  success: boolean
  version?: string
}

async function call<T>(action: 'check' | 'apply', method: 'GET' | 'POST'): Promise<T> {
  const token = getUpdateToken()
  const res = await fetch(
    `${ENDPOINT}?action=${action}&token=${encodeURIComponent(token)}`,
    { method }
  )
  let json: Record<string, unknown> = {}
  try {
    json = await res.json()
  } catch {
    throw new Error(`更新接口返回异常（HTTP ${res.status}）；请确认 update.php 已部署在站点根目录。`)
  }
  if (!res.ok || json.error) {
    throw new Error(String(json.error ?? `请求失败（HTTP ${res.status}）`))
  }
  return json as T
}

/** GET /update.php?action=check — 检查 board-neo 前端是否有新版本。 */
export function checkUpdate() {
  return call<CheckUpdateResult>('check', 'GET')
}

/** POST /update.php?action=apply — 下载最新 dist 覆盖当前站点。 */
export function executeUpdate() {
  return call<ExecuteUpdateResult>('apply', 'POST')
}
