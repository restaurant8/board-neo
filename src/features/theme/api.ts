import { get, post } from '@/lib/api-client'

/** A single config field schema entry from a theme's config.json. */
export type ThemeConfigField = {
  label: string
  placeholder?: string
  field_name: string
  field_type: 'input' | 'textarea' | 'select' | string
  select_options?: Record<string, string>
  default_value?: string
}

/** A theme entry from getThemes (its config.json + injected flags). */
export type ThemeItem = {
  name: string
  description?: string
  version?: string
  images?: string[]
  background_url?: string
  configs?: ThemeConfigField[]
  can_delete?: boolean
  is_system?: boolean
}

/** GET /theme/getThemes — returns { themes: Record<name,config>, active }. */
export type GetThemesResult = {
  themes: Record<string, ThemeItem>
  active: string
}

export function getThemes() {
  return get<GetThemesResult>('/theme/getThemes')
}

/** POST /theme/upload — upload a zip theme package (multipart). */
export function uploadTheme(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return post<boolean>('/theme/upload', fd)
}

/** POST /theme/delete — delete a (user) theme by name. */
export function deleteTheme(name: string) {
  return post<boolean>('/theme/delete', { name })
}

/**
 * 激活主题 = 保存 `frontend_theme` 配置（对齐原版：后端无 theme/switchTheme 路由，
 * 原版通过 /config/save 写 frontend_theme 来切换当前前端主题）。
 */
export function switchTheme(name: string) {
  return post<boolean>('/config/save', { frontend_theme: name })
}

/** POST /theme/getThemeConfig — current saved values for a theme. */
export function getThemeConfig(name: string) {
  return post<Record<string, unknown>>('/theme/getThemeConfig', { name })
}

/** POST /theme/saveThemeConfig — persist config; returns merged config. */
export function saveThemeConfig(name: string, config: Record<string, unknown>) {
  return post<Record<string, unknown>>('/theme/saveThemeConfig', {
    name,
    config,
  })
}
