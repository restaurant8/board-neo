import { useEffect, useMemo, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import '@/lib/monaco-setup'
import { type MailTemplateDetail } from '../api'

/** Per-variable display metadata (说明 / 示例值) for the 占位符 table & live preview. */
export type VarMeta = Record<string, { desc: string; sample: string }>

/** A row's editable draft state (kept per-template by the parent). */
export type TemplateDraft = {
  subject: string
  content: string
  dirty: boolean
}

type EditorHandle = Parameters<OnMount>[0]

/** Substitute every `{{key}}` occurrence with its sample value. */
function fillPlaceholders(text: string, varMeta: VarMeta) {
  let out = text
  for (const [key, meta] of Object.entries(varMeta)) {
    out = out.split(`{{${key}}}`).join(meta.sample)
  }
  return out
}

/** Build the sandboxed preview document (placeholders replaced by sample values). */
function buildPreviewDoc(content: string, subject: string, varMeta: VarMeta) {
  const body = fillPlaceholders(content, varMeta)
  const title = fillPlaceholders(subject, varMeta)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}</style></head><body>${body}</body></html>`
}

type Props = {
  detail: MailTemplateDetail | undefined
  draft: TemplateDraft | undefined
  isLoading: boolean
  isDirty: boolean
  isSaving: boolean
  isTesting: boolean
  isCustomized: boolean
  editorRef: React.MutableRefObject<EditorHandle | null>
  varMeta: VarMeta
  onSubjectChange: (value: string) => void
  onContentChange: (value: string) => void
  onSave: () => void
  onReset: () => void
  onTest: () => void
  onInsertPlaceholder: (name: string) => void
  t: (key: string) => string
}

export function MailTemplateEditor({
  detail,
  draft,
  isLoading,
  isDirty,
  isSaving,
  isTesting,
  isCustomized,
  editorRef,
  varMeta,
  onSubjectChange,
  onContentChange,
  onSave,
  onReset,
  onTest,
  onInsertPlaceholder,
  t,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  const previewDoc = useMemo(
    () =>
      draft
        ? buildPreviewDoc(draft.content, draft.subject, varMeta)
        : '',
    [draft?.content, draft?.subject, varMeta] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    if (iframeRef.current && previewDoc) {
      iframeRef.current.srcdoc = previewDoc
    }
  }, [previewDoc])

  if (isLoading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-muted-foreground text-sm'>{t('common.loading')}</div>
      </div>
    )
  }

  if (!detail || !draft) return null

  const vars = [...detail.required_vars, ...detail.optional_vars]

  return (
    <div className='space-y-4'>
      <div className='text-muted-foreground bg-muted/50 rounded-md border p-3 text-sm'>
        {t('email_template.override_hint')}
      </div>

      <div className='space-y-2'>
        <Label>{t('email_template.subject')}</Label>
        <Input
          value={draft.subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder={t('email_template.subject_placeholder')}
        />
      </div>

      <div className='space-y-2'>
        <Label>{t('email_template.placeholders')}</Label>
        <div className='rounded-md border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-muted/50 border-b'>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('email_template.var_name')}
                </th>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('email_template.var_desc')}
                </th>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('email_template.var_sample')}
                </th>
                <th className='px-3 py-2 text-left font-medium' />
              </tr>
            </thead>
            <tbody>
              {vars.map((name) => {
                const meta = varMeta[name]
                return (
                  <tr key={name} className='border-b last:border-0'>
                    <td className='px-3 py-2 font-mono text-xs'>
                      {`{{${name}}}`}
                      {detail.required_vars.includes(name) && (
                        <Badge
                          variant='destructive'
                          className='ml-1.5 px-1 py-0 text-[10px]'
                        >
                          {t('email_template.required')}
                        </Badge>
                      )}
                    </td>
                    <td className='text-muted-foreground px-3 py-2'>
                      {meta?.desc ?? name}
                    </td>
                    <td className='text-muted-foreground px-3 py-2 font-mono text-xs'>
                      {meta?.sample ?? '-'}
                    </td>
                    <td className='px-3 py-2'>
                      <Badge
                        variant='outline'
                        className='cursor-pointer text-xs select-none'
                        onClick={() => onInsertPlaceholder(name)}
                      >
                        {t('email_template.insert')}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <div className='space-y-2'>
          <Label>{t('email_template.content')}</Label>
          <div className='overflow-hidden rounded-md border'>
            <Editor
              height='450px'
              defaultLanguage='html'
              theme={isDark ? 'vs-dark' : 'vs'}
              value={draft.content}
              onChange={(val) => onContentChange(val ?? '')}
              onMount={(editor) => {
                editorRef.current = editor
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                lineNumbers: 'on',
                fixedOverflowWidgets: true,
              }}
            />
          </div>
        </div>
        <div className='space-y-2'>
          <Label>{t('email_template.preview')}</Label>
          <div className='overflow-hidden rounded-md border bg-white'>
            <iframe
              ref={iframeRef}
              title='preview'
              sandbox='allow-same-origin'
              className='w-full border-0'
              style={{ height: '450px' }}
              srcDoc={previewDoc}
            />
          </div>
        </div>
      </div>

      <div className='flex items-center gap-3'>
        <Button onClick={onSave} disabled={!isDirty || isSaving}>
          {isSaving && <Loader2 className='size-4 animate-spin' />}
          {t('email_template.save')}
        </Button>
        <Button
          variant='outline'
          onClick={onTest}
          disabled={isDirty || isTesting}
          title={isDirty ? t('email_template.save_before_test') : ''}
        >
          {isTesting && <Loader2 className='size-4 animate-spin' />}
          {t('email_template.send_test')}
        </Button>
        {isCustomized && (
          <Button variant='destructive' onClick={onReset}>
            {t('email_template.reset')}
          </Button>
        )}
        {isDirty && (
          <span className='text-muted-foreground flex items-center gap-1.5 text-sm'>
            <span className='size-2 rounded-full bg-amber-500' />
            {t('email_template.unsaved')}
          </span>
        )}
      </div>
    </div>
  )
}
