import { get, post } from '@/lib/api-client'

/** Item from GET /mail/template/list. */
export type MailTemplateListItem = {
  name: string
  label: string
  customized: boolean
  subject: string | null
  updated_at: number | null
}

/** Detail from GET /mail/template/get. */
export type MailTemplateDetail = {
  name: string
  label: string
  required_vars: string[]
  optional_vars: string[]
  customized: boolean
  subject: string
  content: string
}

/** GET /mail/template/list — all known templates with customization state. */
export function listMailTemplates() {
  return get<MailTemplateListItem[]>('/mail/template/list')
}

/** GET /mail/template/get — full template (custom or default fallback). */
export function getMailTemplate(name: string) {
  return get<MailTemplateDetail>('/mail/template/get', { name })
}

/** POST /mail/template/save — upsert a customized template. */
export function saveMailTemplate(payload: {
  name: string
  subject: string
  content: string
}) {
  return post<boolean>('/mail/template/save', payload)
}

/** POST /mail/template/reset — delete customization, revert to default. */
export function resetMailTemplate(name: string) {
  return post<boolean>('/mail/template/reset', { name })
}

/** POST /mail/template/test — send a test email using the template. */
export function testMailTemplate(name: string, email?: string) {
  return post<boolean>('/mail/template/test', { name, email })
}
