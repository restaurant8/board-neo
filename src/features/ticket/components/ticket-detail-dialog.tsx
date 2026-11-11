import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Mail, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleServerError } from '@/lib/handle-server-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { UserEmailLink } from '@/components/user-email-link'
import {
  TICKET_LEVEL_META,
  TICKET_STATUS_CLOSED,
  type TicketDetail,
  closeTicket,
  fetchTicketDetail,
  fetchTicketShow,
  replyTicket,
} from '../api'

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function LevelBadge({ level }: { level: string | number | null }) {
  if (level == null || level === '') return null
  const meta = TICKET_LEVEL_META[Number(level)]
  if (!meta) return null
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

function StatusBadge({ data }: { data: TicketDetail }) {
  if (data.status === TICKET_STATUS_CLOSED)
    return <Badge variant='default'>已关闭</Badge>
  return data.reply_status === 1 ? (
    <Badge variant='secondary'>已回复</Badge>
  ) : (
    <Badge variant='destructive'>待回复</Badge>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: number | null
}

export function TicketDetailDialog({ open, onOpenChange, ticketId }: Props) {
  const queryClient = useQueryClient()
  // 回复草稿。组件在 index 里以 key={ticketId} 挂载，切换工单自动重置，无需 effect。
  const [reply, setReply] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    // 优先用 show 拉完整会话（含每条消息的 user）；该后端未注册 show 路由时
    // 回退到 fetch?id（同样返回完整 messages，仅缺每条消息的 user）。
    queryFn: async (): Promise<TicketDetail> => {
      try {
        return await fetchTicketShow(ticketId as number)
      } catch {
        return await fetchTicketDetail(ticketId as number)
      }
    },
    enabled: open && ticketId != null,
  })

  const replyMutation = useMutation({
    mutationFn: (message: string) => replyTicket(ticketId as number, message),
    onSuccess: () => {
      toast.success('已回复')
      setReply('')
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: handleServerError,
  })

  const closeMutation = useMutation({
    mutationFn: () => closeTicket(ticketId as number),
    onSuccess: () => {
      toast.success('工单已关闭')
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: handleServerError,
  })

  const isClosed = data?.status === TICKET_STATUS_CLOSED

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-2xl'>
        <DialogHeader className='space-y-2 border-b p-4 pe-12 text-start'>
          <div className='flex flex-wrap items-center gap-2'>
            <DialogTitle className='min-w-0 text-lg [overflow-wrap:anywhere]'>
              {data ? data.subject : '工单详情'}
            </DialogTitle>
            {data && <StatusBadge data={data} />}
            {data && <LevelBadge level={data.level} />}
            {data && !isClosed && (
              <Button
                variant='outline'
                size='sm'
                className='ms-auto'
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate()}
              >
                <XCircle className='size-4' /> 关闭工单
              </Button>
            )}
          </div>
          <DialogDescription className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
            {data && (
              <>
                <span className='inline-flex items-center gap-1'>
                  <Mail className='size-3.5' />
                  <UserEmailLink
                    email={data.user?.email}
                    fallback={data.user_id}
                    onNavigate={() => onOpenChange(false)}
                  />
                </span>
                <span className='inline-flex items-center gap-1'>
                  <Clock className='size-3.5' />
                  创建于 {time(data.created_at)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* 用原生滚动而不是 Radix ScrollArea：对话框只有 max-height（高度不确定），ScrollArea 视口的
            height:100% 会退化成 auto，长消息把视口撑出对话框、盖住下面的输入框并拦截点击。 */}
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4'>
          {isLoading ? (
            <p className='text-muted-foreground py-8 text-center'>加载中...</p>
          ) : (
            <div className='flex flex-col gap-3 py-4'>
              {(data?.messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    m.is_from_admin
                      ? 'bg-primary text-primary-foreground self-end'
                      : 'bg-muted self-start'
                  )}
                >
                  <div className='mb-1 text-xs opacity-70'>
                    {m.is_from_admin ? (
                      '管理员'
                    ) : (
                      <UserEmailLink
                        email={m.user?.email}
                        fallback='用户'
                        onNavigate={() => onOpenChange(false)}
                      />
                    )}
                    <span className='ms-2'>{time(m.created_at)}</span>
                  </div>
                  <div className='whitespace-pre-wrap [overflow-wrap:anywhere]'>
                    {m.message}
                  </div>
                </div>
              ))}
              {data && data.messages.length === 0 && (
                <p className='text-muted-foreground py-8 text-center'>暂无消息</p>
              )}
            </div>
          )}
        </div>

        <div className='space-y-2 border-t p-4'>
          {isClosed ? (
            <p className='text-muted-foreground text-center text-sm'>
              工单已关闭，无法继续回复。
            </p>
          ) : (
            <>
              <Textarea
                rows={3}
                className='max-h-40 overflow-y-auto'
                placeholder='输入回复内容...'
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className='flex justify-end'>
                <Button
                  disabled={!reply.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate(reply.trim())}
                >
                  <Send className='size-4' /> 发送回复
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
