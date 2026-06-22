import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  type MailTemplateListItem,
  getMailTemplate,
  resetMailTemplate,
  saveMailTemplate,
  testMailTemplate,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: MailTemplateListItem | null
}

export function MailTemplateEditDialog({ open, onOpenChange, template }: Props) {
  const queryClient = useQueryClient()
  const name = template?.name
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [testEmail, setTestEmail] = useState('')

  const { data: detail, isLoading } = useQuery({
    queryKey: ['mail-template', name],
    queryFn: () => getMailTemplate(name!),
    enabled: open && !!name,
  })

  useEffect(() => {
    if (detail) {
      setSubject(detail.subject)
      setContent(detail.content)
    }
  }, [detail])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mail-templates'] })
    queryClient.invalidateQueries({ queryKey: ['mail-template', name] })
  }

  const saveMutation = useMutation({
    mutationFn: () => saveMailTemplate({ name: name!, subject, content }),
    onSuccess: () => {
      toast.success('模板已保存')
      invalidate()
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const resetMutation = useMutation({
    mutationFn: () => resetMailTemplate(name!),
    onSuccess: () => {
      toast.success('已重置为默认模板')
      invalidate()
    },
    onError: handleServerError,
  })

  const testMutation = useMutation({
    mutationFn: () => testMailTemplate(name!, testEmail || undefined),
    onSuccess: () => toast.success('测试邮件已发送'),
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>编辑邮件模板 - {template?.label}</DialogTitle>
          <DialogDescription>
            使用 {'{{变量}}'} 占位符，保存后将覆盖默认模板。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : (
          <div className='grid max-h-[60vh] gap-4 overflow-y-auto pr-1'>
            <div className='flex flex-wrap gap-1'>
              {detail?.required_vars.map((x) => (
                <Badge key={x} variant='default'>{`{{${x}}}`}</Badge>
              ))}
              {detail?.optional_vars.map((x) => (
                <Badge key={x} variant='secondary'>{`{{${x}}}`}</Badge>
              ))}
            </div>
            <div className='grid gap-2'>
              <Label>邮件标题</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className='grid gap-2'>
              <Label>邮件内容（HTML）</Label>
              <Textarea
                rows={16}
                className='font-mono text-xs'
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>测试收件邮箱（留空发送至当前管理员）</Label>
              <div className='flex gap-2'>
                <Input
                  placeholder='test@example.com'
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  variant='outline'
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  <Send className='size-4' /> 测试
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className='gap-2 sm:justify-between'>
          <Button
            variant='outline'
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending || !detail?.customized}
          >
            <RotateCcw className='size-4' /> 重置默认
          </Button>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
