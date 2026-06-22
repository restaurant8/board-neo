import { get, post } from '@/lib/api-client'

export type Notice = {
  id: number
  title: string
  content: string
  img_url: string | null
  tags: string[] | null
  show: number
  popup: number
  sort: number | null
  created_at: number
  updated_at: number
}

export type NoticeSavePayload = {
  id?: number
  title: string
  content: string
  img_url?: string | null
  tags?: string[] | null
  show?: number
  popup?: number
}

/** GET /notice/fetch — returns full list ordered by sort,id. */
export function fetchNotices() {
  return get<Notice[]>('/notice/fetch')
}

/** POST /notice/save — create (no id) or update (with id). */
export function saveNotice(payload: NoticeSavePayload) {
  return post<boolean>('/notice/save', payload)
}

/** POST /notice/show — toggle visibility. */
export function toggleNoticeShow(id: number) {
  return post<boolean>('/notice/show', { id })
}

/** POST /notice/drop — delete. */
export function dropNotice(id: number) {
  return post<boolean>('/notice/drop', { id })
}

/** POST /notice/sort — persist order; ids = array in desired order. */
export function sortNotices(ids: number[]) {
  return post<boolean>('/notice/sort', { ids })
}
