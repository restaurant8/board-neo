import { get, post } from '@/lib/api-client'

export type ServerGroup = {
  id: number
  name: string
  /** withCount('users') 注入 */
  users_count?: number
  /** Controller 手动注入 server_count */
  server_count?: number
  created_at?: number
  updated_at?: number
}

export type ServerGroupSavePayload = {
  id?: number
  name: string
}

/** GET /server/group/fetch — 返回全部权限组（按 id 倒序），带 users_count / server_count。 */
export function fetchServerGroups() {
  return get<ServerGroup[]>('/server/group/fetch')
}

/** POST /server/group/save — 新建（无 id）或更新（带 id）。 */
export function saveServerGroup(payload: ServerGroupSavePayload) {
  return post<boolean>('/server/group/save', payload)
}

/** POST /server/group/drop — 删除（被节点/订阅/用户使用时后端拒绝）。 */
export function dropServerGroup(id: number) {
  return post<boolean>('/server/group/drop', { id })
}
