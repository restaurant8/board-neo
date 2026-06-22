import { get, post } from '@/lib/api-client'

export type RouteAction = 'block' | 'direct' | 'dns' | 'proxy'

export type ServerRoute = {
  id: number
  remarks: string
  /** 匹配规则数组（域名/IP/GEO 等） */
  match: string[]
  action: RouteAction
  /** action 为 dns 时为目标 DNS；其它动作通常为空 */
  action_value: string | null
  created_at?: number
  updated_at?: number
}

export type ServerRouteSavePayload = {
  id?: number
  remarks: string
  match: string[]
  action: RouteAction
  action_value?: string | null
}

/**
 * GET /server/route/fetch — 返回全部路由规则。
 * 注意：该接口返回裸 `{ data: [...] }`（无标准信封），api-client 原样透传，
 * 故此处需手动取 `.data`。
 */
export async function fetchServerRoutes() {
  const res = await get<{ data: ServerRoute[] }>('/server/route/fetch')
  return res.data
}

/** POST /server/route/save — 新建（无 id）或更新（带 id）。 */
export function saveServerRoute(payload: ServerRouteSavePayload) {
  return post<boolean>('/server/route/save', payload)
}

/** POST /server/route/drop — 删除。返回裸 `{ data: true }`。 */
export function dropServerRoute(id: number) {
  return post<{ data: boolean }>('/server/route/drop', { id })
}
