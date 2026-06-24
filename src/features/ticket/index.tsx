import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Eye, Search } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TICKET_REPLY_STATUS_MAP,
  TICKET_STATUS_CLOSED,
  TICKET_STATUS_MAP,
  TICKET_STATUS_OPENING,
  fetchTickets,
} from './api'
import { TicketDetailDrawer } from './components/ticket-detail-drawer'

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

const route = getRouteApi('/_authenticated/ticket/')

export function TicketPage() {
  const { status: initStatus } = route.useSearch()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string>(initStatus ?? 'all')
  const [search, setSearch] = useState('')
  const [email, setEmail] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page, pageSize, statusFilter, email],
    queryFn: () =>
      fetchTickets({
        current: page,
        pageSize,
        status: statusFilter === 'all' ? undefined : Number(statusFilter),
        email: email || undefined,
      }),
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / pageSize))

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
            <p className='text-muted-foreground'>查看与回复用户工单。</p>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setPage(1)
              setStatusFilter(v)
            }}
          >
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部状态</SelectItem>
              <SelectItem value={String(TICKET_STATUS_OPENING)}>
                {TICKET_STATUS_MAP[TICKET_STATUS_OPENING]}
              </SelectItem>
              <SelectItem value={String(TICKET_STATUS_CLOSED)}>
                {TICKET_STATUS_MAP[TICKET_STATUS_CLOSED]}
              </SelectItem>
            </SelectContent>
          </Select>
          <form
            className='flex gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
              setEmail(search.trim())
            }}
          >
            <Input
              placeholder='按用户邮箱精确查询'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='max-w-xs'
            />
            <Button type='submit' variant='secondary'>
              <Search className='size-4' /> 查询
            </Button>
          </form>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>主题</TableHead>
                <TableHead>用户</TableHead>
                <TableHead className='w-20'>级别</TableHead>
                <TableHead className='w-24'>回复状态</TableHead>
                <TableHead className='w-20'>状态</TableHead>
                <TableHead className='w-40'>更新时间</TableHead>
                <TableHead className='w-20 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.id}</TableCell>
                    <TableCell className='font-medium'>{t.subject}</TableCell>
                    <TableCell className='text-xs'>
                      {t.user?.email ?? t.user_id}
                    </TableCell>
                    <TableCell>{t.level ?? '-'}</TableCell>
                    <TableCell>
                      {t.reply_status != null
                        ? TICKET_REPLY_STATUS_MAP[t.reply_status] ??
                          t.reply_status
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === TICKET_STATUS_CLOSED
                            ? 'outline'
                            : 'secondary'
                        }
                      >
                        {TICKET_STATUS_MAP[t.status] ?? t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {time(t.updated_at)}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        title='详情'
                        onClick={() => setDetailId(t.id)}
                      >
                        <Eye className='size-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className='h-24 text-center'>
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

      <TicketDetailDrawer
        open={detailId != null}
        onOpenChange={(o) => !o && setDetailId(null)}
        ticketId={detailId}
      />
    </>
  )
}
