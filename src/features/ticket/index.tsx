import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, X } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TICKET_LEVEL_META,
  TICKET_STATUS_CLOSED,
  TICKET_STATUS_OPENING,
  type Ticket,
  closeTicket,
  fetchTickets,
} from './api'
import { TicketDetailDialog } from './components/ticket-detail-dialog'

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

/** 优先级徽章（对齐原版：低=深色 / 中=灰 / 高=红）。 */
function LevelBadge({ level }: { level: string | number | null }) {
  if (level == null || level === '') return <span className='text-muted-foreground'>-</span>
  const meta = TICKET_LEVEL_META[Number(level)]
  if (!meta) return <span>{String(level)}</span>
  return (
    <Badge variant={meta.variant} className='whitespace-nowrap'>
      {meta.label}
    </Badge>
  )
}

/** 状态徽章：已关闭 / 已回复 / 待回复（对齐原版颜色）。 */
function StatusBadge({ t }: { t: Ticket }) {
  if (t.status === TICKET_STATUS_CLOSED)
    return <Badge variant='outline'>已关闭</Badge>
  return t.reply_status === 1 ? (
    <Badge variant='secondary'>已回复</Badge>
  ) : (
    <Badge variant='destructive'>待回复</Badge>
  )
}

const route = getRouteApi('/_authenticated/ticket/')

export function TicketPage() {
  const queryClient = useQueryClient()
  const { status: initStatus } = route.useSearch()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  // 状态切换：处理中(0) / 已关闭(1)，默认处理中
  const initStatusNum = initStatus != null ? Number(initStatus) : NaN
  const [status, setStatus] = useState<number>(
    initStatusNum === TICKET_STATUS_CLOSED
      ? TICKET_STATUS_CLOSED
      : TICKET_STATUS_OPENING
  )
  const [detailId, setDetailId] = useState<number | null>(null)
  const [closing, setClosing] = useState<Ticket | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page, pageSize, status],
    queryFn: () => fetchTickets({ current: page, pageSize, status }),
  })

  const closeMutation = useMutation({
    mutationFn: (id: number) => closeTicket(id),
    onSuccess: () => {
      toast.success('工单已关闭')
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setClosing(null)
    },
    onError: handleServerError,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / pageSize))

  const switchStatus = (s: number) => {
    setPage(1)
    setStatus(s)
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>工单管理</h2>
            <p className='text-muted-foreground'>
              在这里可以查看用户工单，包括查看、回复、关闭等操作。
            </p>
          </div>
        </div>

        {/* 处理中 / 已关闭 切换（对齐原版） */}
        <div className='flex flex-wrap items-center gap-2'>
          <div className='bg-muted inline-flex items-center rounded-md p-0.5'>
            <Button
              size='sm'
              variant={status === TICKET_STATUS_OPENING ? 'default' : 'ghost'}
              className='h-7'
              onClick={() => switchStatus(TICKET_STATUS_OPENING)}
            >
              处理中
            </Button>
            <Button
              size='sm'
              variant={status === TICKET_STATUS_CLOSED ? 'default' : 'ghost'}
              className='h-7'
              onClick={() => switchStatus(TICKET_STATUS_CLOSED)}
            >
              已关闭
            </Button>
          </div>
        </div>

        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-20'>工单号</TableHead>
                <TableHead>主题</TableHead>
                <TableHead className='w-24'>优先级</TableHead>
                <TableHead className='w-24'>状态</TableHead>
                <TableHead className='w-40'>最后更新</TableHead>
                <TableHead className='w-40'>创建时间</TableHead>
                <TableHead className='w-24 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className='font-medium'>{t.id}</TableCell>
                    <TableCell className='font-medium'>{t.subject}</TableCell>
                    <TableCell>
                      <LevelBadge level={t.level} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge t={t} />
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {time(t.updated_at)}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {time(t.created_at)}
                    </TableCell>
                    <TableCell className='text-end'>
                      <div className='flex items-center justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          title='详情'
                          onClick={() => setDetailId(t.id)}
                        >
                          <Eye className='size-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          title='关闭工单'
                          disabled={t.status === TICKET_STATUS_CLOSED}
                          onClick={() => setClosing(t)}
                        >
                          <X className='size-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className='h-24 text-center'>
                    暂无工单
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-sm'>
            共 {total} 条，第 {page} / {lastPage} 页
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </Main>

      <TicketDetailDialog
        key={detailId ?? 'none'}
        open={detailId != null}
        onOpenChange={(o) => !o && setDetailId(null)}
        ticketId={detailId}
      />

      <ConfirmDialog
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        title='确认关闭工单'
        desc={`确定关闭工单「${closing?.subject}」吗？关闭后用户将无法继续回复。`}
        confirmText='关闭工单'
        destructive
        isLoading={closeMutation.isPending}
        handleConfirm={() => closing && closeMutation.mutate(closing.id)}
      />
    </>
  )
}
