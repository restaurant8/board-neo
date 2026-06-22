import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleServerError } from '@/lib/handle-server-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  TICKET_STATUS_CLOSED,
  TICKET_STATUS_MAP,
  closeTicket,
  fetchTicketDetail,
  replyTicket,
} from '../api'

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: number | null
}

export function TicketDetailDrawer({ open, onOpenChange, ticketId }: Props) {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => fetchTicketDetail(ticketId as number),
    enabled: open && ticketId != null,
  })

  useEffect(() => {
    if (open) setReply('')
  }, [open, ticketId])

  const replyMutation = useMutation({
    mutationFn: (message: string) =>
      replyTicket(ticketId as number, message),
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>
            {data ? `#${data.id} ${data.subject}` : '工单详情'}
          </SheetTitle>
          <SheetDescription>
            {data ? (
              <>
                用户：{data.user?.email ?? data.user_id}　状态：
                <Badge variant={isClosed ? 'outline' : 'secondary'}>
                  {TICKET_STATUS_MAP[data.status] ?? data.status}
                </Badge>
                {data.level ? `　级别：${data.level}` : ''}
              </>
            ) : (
              '查看工单对话并回复。'
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className='flex-1 px-4'>
          {isLoading ? (
            <p className='py-8 text-center text-muted-foreground'>加载中...</p>
          ) : (
            <div className='flex flex-col gap-3 py-2'>
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
                    {m.is_from_admin ? '管理员' : '用户'}　{time(m.created_at)}
                  </div>
                  <div className='whitespace-pre-wrap break-words'>
                    {m.message}
                  </div>
                </div>
              ))}
              {data && data.messages.length === 0 && (
                <p className='py-8 text-center text-muted-foreground'>
                  暂无消息
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <SheetFooter className='gap-2'>
          {!isClosed && (
            <Textarea
              rows={3}
              placeholder='输入回复内容...'
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          )}
          <div className='flex justify-between gap-2'>
            <Button
              variant='outline'
              disabled={isClosed || closeMutation.isPending}
              onClick={() => closeMutation.mutate()}
            >
              <XCircle className='size-4' /> 关闭工单
            </Button>
            <Button
              disabled={isClosed || !reply.trim() || replyMutation.isPending}
              onClick={() => replyMutation.mutate(reply.trim())}
            >
              <Send className='size-4' /> 发送回复
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
