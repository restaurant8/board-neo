import { get, post } from '@/lib/api-client'

/** 常见语言选项（前端约定，后端只校验非空字符串）。 */
export const KNOWLEDGE_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'vi-VN', label: 'Tiếng Việt' },
  { value: 'fa-IR', label: 'فارسی' },
]

/** 列表项：fetch（不带 id）只 select 这些字段。 */
export type KnowledgeListItem = {
  id: number
  title: string
  category: string
  show: boolean
  updated_at: number
}

/** 详情：fetch?id= 返回完整 v2_knowledge 行（含 body/language）。 */
export type Knowledge = KnowledgeListItem & {
  language: string
  body: string
  sort: number | null
  created_at: number
}

/** POST /knowledge/save 入参（KnowledgeSave）。内容字段为 body。 */
export type KnowledgeSavePayload = {
  id?: number
  category: string
  language: string
  title: string
  body: string
  show?: boolean
}

/** GET /knowledge/fetch — 知识库列表（按 sort 升序）。 */
export function fetchKnowledge() {
  return get<KnowledgeListItem[]>('/knowledge/fetch')
}

/** GET /knowledge/fetch?id= — 单篇详情（含 body/language）。 */
export function fetchKnowledgeDetail(id: number) {
  return get<Knowledge>('/knowledge/fetch', { id })
}

/** GET /knowledge/getCategory — 已有分类名数组。 */
export function fetchKnowledgeCategories() {
  return get<string[]>('/knowledge/getCategory')
}

/** POST /knowledge/save — 新建（无 id）或编辑（带 id）。 */
export function saveKnowledge(payload: KnowledgeSavePayload) {
  return post<boolean>('/knowledge/save', payload)
}

/** POST /knowledge/show — 切换显隐（后端取反）。 */
export function toggleKnowledgeShow(id: number) {
  return post<boolean>('/knowledge/show', { id })
}

/** POST /knowledge/drop — 删除。 */
export function dropKnowledge(id: number) {
  return post<boolean>('/knowledge/drop', { id })
}

/** POST /knowledge/sort — 按 ids 顺序重排 sort。 */
export function sortKnowledge(ids: number[]) {
  return post<boolean>('/knowledge/sort', { ids })
}
