import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type OnMount } from '@monaco-editor/react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { fetchConfig } from '@/features/config/api'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getMailTemplate,
  listMailTemplates,
  resetMailTemplate,
  saveMailTemplate,
  testMailTemplate,
} from '../api'
import { mailTemplateText as text } from '../i18n'
import {
  MailTemplateEditor,
  type TemplateDraft,
  type VarMeta,
} from './mail-template-editor'

type EditorHandle = Parameters<OnMount>[0]

/** i18n shim: board-neo is zh-CN only, so resolve keys against the static map. */
const t = (key: string) => text[key] ?? key

/** Build the variable metadata (说明 / 示例值) keyed by placeholder name. */
function buildVarMeta(siteUrl: string): VarMeta {
  const url = siteUrl || 'https://example.com'
  return {
    name: { desc: '站点名称', sample: 'XBoard' },
    url: { desc: '站点网址', sample: url },
    code: { desc: '验证码', sample: '123456' },
    content: { desc: '通知正文', sample: '这是一封测试通知邮件。' },
    link: { desc: '登录链接', sample: `${url}/login?token=test` },
  }
}

export function MailTemplateManager() {
  const queryClient = useQueryClient()

  // Empty = no explicit selection yet; falls back to the first template below.
  const [selectedName, setSelectedName] = useState('')
  // Per-template editable drafts (subject/content/dirty), keyed by template name.
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({})
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const seeded = useRef(new Set<string>())
  const editorRef = useRef<EditorHandle | null>(null)

  const { data: list = [], isLoading: listLoading } = useQuery({
    queryKey: ['mail-template', 'list'],
    queryFn: listMailTemplates,
  })

  // {{url}} 示例值用「站点设置-站点网址」(app_url)，不是后台地址
  const { data: siteConfig } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })
  const siteUrl =
    siteConfig?.site?.app_url ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const varMeta = useMemo(() => buildVarMeta(siteUrl), [siteUrl])

  // Effective active tab: explicit selection, else the first available template.
  const activeName =
    selectedName || (list.length > 0 ? list[0].name : '')

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['mail-template', 'detail', activeName],
    queryFn: () => getMailTemplate(activeName),
    enabled: !!activeName,
  })

  // Seed a draft from the freshly-fetched detail (once per template).
  useEffect(() => {
    if (detail && !seeded.current.has(detail.name)) {
      seeded.current.add(detail.name)
      setDrafts((prev) => ({
        ...prev,
        [detail.name]: {
          subject: detail.subject,
          content: detail.content,
          dirty: false,
        },
      }))
    }
  }, [detail])

  const draft = drafts[activeName]
  const isDirty = draft?.dirty ?? false

  const setField = useCallback(
    (field: 'subject' | 'content', value: string) => {
      setDrafts((prev) => ({
        ...prev,
        [activeName]: { ...prev[activeName], [field]: value, dirty: true },
      }))
    },
    [activeName]
  )

  // Tab switch guard: if the current template is dirty, confirm before leaving.
  const requestSwitch = useCallback(
    (name: string) => {
      if (isDirty) {
        setPendingSwitch(name)
        setDiscardOpen(true)
      } else {
        setSelectedName(name)
      }
    },
    [isDirty]
  )

  const confirmDiscard = useCallback(() => {
    if (pendingSwitch) {
      seeded.current.delete(activeName)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[activeName]
        return next
      })
      setSelectedName(pendingSwitch)
      setPendingSwitch(null)
    }
    setDiscardOpen(false)
  }, [pendingSwitch, activeName])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mail-template', 'list'] })
    queryClient.invalidateQueries({
      queryKey: ['mail-template', 'detail', activeName],
    })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      saveMailTemplate({
        name: activeName,
        subject: draft!.subject,
        content: draft!.content,
      }),
    onSuccess: () => {
      setDrafts((prev) => ({
        ...prev,
        [activeName]: { ...prev[activeName], dirty: false },
      }))
      seeded.current.delete(activeName)
      invalidate()
      toast.success(t('email_template.save_success'))
    },
    onError: handleServerError,
  })

  const resetMutation = useMutation({
    mutationFn: () => resetMailTemplate(activeName),
    onSuccess: () => {
      seeded.current.delete(activeName)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[activeName]
        return next
      })
      invalidate()
      toast.success(t('email_template.reset_success'))
      setResetOpen(false)
    },
    onError: handleServerError,
  })

  const testMutation = useMutation({
    mutationFn: () => testMailTemplate(activeName, testEmail || undefined),
    onSuccess: () => {
      toast.success(t('email_template.test_success'))
      setTestOpen(false)
    },
    onError: handleServerError,
  })

  // Insert `{{name}}` at the editor cursor (or append if no live editor).
  const insertPlaceholder = useCallback(
    (name: string) => {
      const token = `{{${name}}}`
      const editor = editorRef.current
      if (editor) {
        const selection = editor.getSelection()
        if (selection) {
          editor.executeEdits('insert-placeholder', [
            { range: selection, text: token, forceMoveMarkers: true },
          ])
          editor.focus()
          setField('content', editor.getValue())
          return
        }
      }
      setField('content', (draft?.content ?? '') + token)
    },
    [draft, setField]
  )

  if (listLoading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-muted-foreground text-sm'>
          {t('common.loading')}
        </div>
      </div>
    )
  }

  const current = list.find((x) => x.name === activeName)

  return (
    <div className='space-y-4'>
      <Tabs value={activeName} onValueChange={requestSwitch} className='w-full'>
        <TabsList>
          {list.map((item) => (
            <TabsTrigger
              key={item.name}
              value={item.name}
              className='gap-1.5 text-xs'
            >
              {item.label}
              {item.customized && (
                <Badge
                  variant='secondary'
                  className='px-1 py-0 text-[10px]'
                >
                  {t('email_template.customized')}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {list.map((item) => (
          <TabsContent key={item.name} value={item.name} className='mt-4'>
            {activeName === item.name && (
              <MailTemplateEditor
                detail={detail}
                draft={draft}
                isLoading={detailLoading && !draft}
                isDirty={isDirty}
                isSaving={saveMutation.isPending}
                isTesting={testMutation.isPending}
                isCustomized={current?.customized ?? false}
                editorRef={editorRef}
                varMeta={varMeta}
                onSubjectChange={(v) => setField('subject', v)}
                onContentChange={(v) => setField('content', v)}
                onSave={() => saveMutation.mutate()}
                onReset={() => setResetOpen(true)}
                onTest={() => setTestOpen(true)}
                onInsertPlaceholder={insertPlaceholder}
                t={t}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Discard-on-switch confirmation */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('email_template.discard_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('email_template.discard_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingSwitch(null)
                setDiscardOpen(false)
              }}
            >
              {t('email_template.cancel')}
            </AlertDialogCancel>
            <Button onClick={confirmDiscard}>
              {t('email_template.discard_confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset-to-default confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('email_template.reset_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('email_template.reset_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('email_template.cancel')}</AlertDialogCancel>
            <Button onClick={() => resetMutation.mutate()}>
              {t('email_template.reset_confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send-test dialog */}
      <AlertDialog open={testOpen} onOpenChange={setTestOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('email_template.test_dialog_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('email_template.test_dialog_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='py-2'>
            <Input
              type='email'
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={t('email_template.test_email_placeholder')}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('email_template.cancel')}</AlertDialogCancel>
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {t(
                testMutation.isPending
                  ? 'email_template.sending'
                  : 'email_template.send_test'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
