import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type BulkScope, type UserFilter, type UserSort, sendMail } from '../api'

// 与后端 UserController@sendMail 注入的变量一致
const AVAILABLE_VARS = [
  '{{app.name}}',
  '{{app.url}}',
  '{{now}}',
  '{{user.id}}',
  '{{user.email}}',
  '{{user.uuid}}',
  '{{user.plan_name}}',
  '{{user.expired_at}}',
  '{{user.transfer_enable}}',
  '{{user.transfer_used}}',
  '{{user.transfer_left}}',
]

const SYSTEM_NOTICE_SUBJECT = '【{{app.name}}】系统通知（{{now}}）'
const SYSTEM_NOTICE_CONTENT =
  '尊敬的用户 {{user.email}} 您好：\n\n这里是来自 {{app.name}} 的系统通知。\n\n如有问题请访问：{{app.url}}\n'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 当前筛选条件；为空则发送全部。 */
  filter?: UserFilter[]
  /** 当前多选的用户 id；非空时默认按选中发送。 */
  selectedIds?: number[]
  /** 当前列表排序（仅 filtered 范围随请求传递）。 */
  sort?: UserSort[]
}

export function UserSendMailDialog({
  open,
  onOpenChange,
  filter,
  selectedIds,
  sort,
}: Props) {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')

  const selectedCount = selectedIds?.length ?? 0
  const hasFilter = !!filter && filter.length > 0
  const defaultScope: BulkScope =
    selectedCount > 0 ? 'selected' : hasFilter ? 'filtered' : 'all'
  const [scope, setScope] = useState<BulkScope>(defaultScope)

  useEffect(() => {
    if (open) setScope(defaultScope)
  }, [open, defaultScope])

  const mutation = useMutation({
    mutationFn: () =>
      sendMail({
        subject,
        content,
        scope,
        user_ids: scope === 'selected' ? selectedIds : undefined,
        filter: scope === 'filtered' ? filter : undefined,
        sort: scope === 'filtered' ? sort?.[0]?.id : undefined,
        sort_type:
          scope === 'filtered' && sort?.[0]
            ? sort[0].desc
              ? 'DESC'
              : 'ASC'
            : undefined,
      }),
    onSuccess: () => {
      toast.success('邮件发送成功')
      onOpenChange(false)
      setSubject('')
      setContent('')
    },
    onError: handleServerError,
  })

  const submitting = mutation.isPending

  const handleConfirm = () => {
    if (!subject || !content) {
      toast.error('请填写所有必填字段')
      return
    }
    if (scope === 'selected' && selectedCount === 0) {
      toast.error('请先选择用户')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden border-border/50 p-0 shadow-none sm:rounded-xl'>
        <DialogHeader className='flex-shrink-0 border-b px-6 pb-4 pt-6'>
          <DialogTitle className='text-lg tracking-tight'>发送邮件</DialogTitle>
          <DialogDescription className='text-xs opacity-70'>
            向所选或已筛选的用户发送邮件
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto bg-background'>
          <div className='space-y-4 px-6 py-4 text-sm'>
            <div className='space-y-2'>
              <label className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
                发送范围
              </label>
              <Select value={scope} onValueChange={(v) => setScope(v as BulkScope)}>
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='selected' disabled={selectedCount === 0}>
                    仅选中（{selectedCount}）
                  </SelectItem>
                  <SelectItem value='filtered' disabled={!hasFilter}>
                    筛选后的用户
                  </SelectItem>
                  <SelectItem value='all'>全部用户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <label
                htmlFor='subject'
                className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'
              >
                主题
              </label>
              <Input
                id='subject'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder='例如：系统通知（支持占位符）'
                className='h-9 font-mono text-xs'
              />
              <p className='font-mono text-[10px] leading-relaxed opacity-70'>
                支持占位符：{'{{key}}'} 或 {'{{key|默认值}}'}
                （未知变量会原样保留）
              </p>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-3'>
                <label
                  htmlFor='content'
                  className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'
                >
                  内容
                </label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-8 font-mono text-[10px]'
                  onClick={() => {
                    setSubject(SYSTEM_NOTICE_SUBJECT)
                    setContent(SYSTEM_NOTICE_CONTENT)
                  }}
                  disabled={submitting}
                >
                  填入系统通知模板
                </Button>
              </div>
              <Textarea
                id='content'
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className='min-h-[220px] font-mono text-xs'
                placeholder='请输入邮件正文（可使用占位符）'
              />
              <p className='font-mono text-[10px] leading-relaxed opacity-70'>
                content 默认按纯文本处理（会转义），不支持 HTML 富文本。
              </p>
            </div>
            <div className='rounded-md border bg-muted/10 p-3'>
              <div className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
                可用变量
              </div>
              <div className='mt-2 font-mono text-[10px] leading-relaxed opacity-80'>
                {AVAILABLE_VARS.join(' ')}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className='flex-shrink-0 border-t px-6 py-4'>
          <div className='flex w-full items-center justify-between gap-3'>
            <div className='flex items-center gap-2' />
            <div className='flex items-center gap-3'>
              <Button
                type='button'
                variant='ghost'
                onClick={() => onOpenChange(false)}
                className='h-8 px-4 text-xs font-bold'
                disabled={submitting}
              >
                取消
              </Button>
              <Button
                type='button'
                onClick={handleConfirm}
                className='h-8 px-8 text-xs font-bold'
                disabled={submitting}
              >
                <Send className='h-4 w-4' />
                {submitting ? '发送中...' : '发送'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
