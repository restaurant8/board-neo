import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, RefreshCw, Search } from 'lucide-react'
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
import { type LogsParams, fetchResetLogs } from './api'
import { ResetStatsCards } from './components/reset-stats-cards'
import { ResetUserDialog } from './components/reset-user-dialog'
import { UserHistoryDialog } from './components/user-history-dialog'

const PER_PAGE = 20
const ALL = '__all__'

// 与 TrafficResetLog 常量一致；用于筛选下拉。展示用列已有后端返回的 *_name。
const RESET_TYPES: { value: string; label: string }[] = [
  { value: 'monthly', label: '月度重置' },
  { value: 'first_day_month', label: '每月一号' },
  { value: 'yearly', label: '年度重置' },
  { value: 'first_day_year', label: '每年一号' },
  { value: 'manual', label: '手动' },
  { value: 'purchase', label: '购买' },
]
const SOURCES: { value: string; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'manual', label: '手动' },
  { value: 'api', label: 'API' },
  { value: 'cron', label: '定时任务' },
  { value: 'user_access', label: '用户访问' },
]

export function TrafficResetPage() {
  const [page, setPage] = useState(1)
  const [statsDays] = useState(30)
  const [resetOpen, setResetOpen] = useState(false)
  const [historyUserId, setHistoryUserId] = useState<number | null>(null)

  // 已应用的筛选（点击查询后才生效）。
  const [filters, setFilters] = useState<LogsParams>({})
  // 表单中的草稿值。
  const [draft, setDraft] = useState<{
    user_email: string
    reset_type: string
    trigger_source: string
    start_date: string
    end_date: string
  }>({
    user_email: '',
    reset_type: ALL,
    trigger_source: ALL,
    start_date: '',
    end_date: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['traffic-reset-logs', filters, page],
    queryFn: () =>
      fetchResetLogs({ ...filters, page, per_page: PER_PAGE }),
  })

  function applyFilters() {
    setPage(1)
    setFilters({
      user_email: draft.user_email.trim() || undefined,
      reset_type: draft.reset_type === ALL ? undefined : draft.reset_type,
      trigger_source:
        draft.trigger_source === ALL ? undefined : draft.trigger_source,
      start_date: draft.start_date || undefined,
      end_date: draft.end_date || undefined,
    })
  }

  const logs = data?.data ?? []
  const pagination = data?.pagination

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
            <h2 className='text-2xl font-bold tracking-tight'>流量重置</h2>
            <p className='text-muted-foreground'>
              查看流量重置统计与日志，并可手动重置指定用户。
            </p>
          </div>
          <Button onClick={() => setResetOpen(true)}>
            <RefreshCw className='size-4' /> 手动重置用户
          </Button>
        </div>

        <ResetStatsCards days={statsDays} />

        <div className='flex flex-wrap items-end gap-2 rounded-md border p-3'>
          <div className='grid gap-1'>
            <span className='text-xs text-muted-foreground'>用户邮箱</span>
            <Input
              className='h-9 w-48'
              placeholder='邮箱模糊搜索'
              value={draft.user_email}
              onChange={(e) =>
                setDraft((d) => ({ ...d, user_email: e.target.value }))
              }
            />
          </div>
          <div className='grid gap-1'>
            <span className='text-xs text-muted-foreground'>重置类型</span>
            <Select
              value={draft.reset_type}
              onValueChange={(v) => setDraft((d) => ({ ...d, reset_type: v }))}
            >
              <SelectTrigger className='h-9 w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部类型</SelectItem>
                {RESET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-1'>
            <span className='text-xs text-muted-foreground'>触发来源</span>
            <Select
              value={draft.trigger_source}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, trigger_source: v }))
              }
            >
              <SelectTrigger className='h-9 w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部来源</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-1'>
            <span className='text-xs text-muted-foreground'>开始日期</span>
            <Input
              type='date'
              className='h-9'
              value={draft.start_date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, start_date: e.target.value }))
              }
            />
          </div>
          <div className='grid gap-1'>
            <span className='text-xs text-muted-foreground'>结束日期</span>
            <Input
              type='date'
              className='h-9'
              value={draft.end_date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, end_date: e.target.value }))
              }
            />
          </div>
          <Button onClick={applyFilters}>
            <Search className='size-4' /> 查询
          </Button>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>重置前 → 重置后</TableHead>
                <TableHead>重置时间</TableHead>
                <TableHead className='text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.id}</TableCell>
                    <TableCell>
                      <div className='font-medium'>{log.user_email}</div>
                      <div className='text-xs text-muted-foreground'>
                        ID {log.user_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary'>{log.reset_type_name}</Badge>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {log.trigger_source_name}
                    </TableCell>
                    <TableCell className='text-xs'>
                      {log.old_traffic.formatted} → {log.new_traffic.formatted}
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                      {log.reset_time}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        title='查看该用户历史'
                        onClick={() => setHistoryUserId(log.user_id)}
                      >
                        <History className='size-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='h-24 text-center text-muted-foreground'
                  >
                    暂无重置日志
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {pagination ? (
          <div className='flex items-center justify-between'>
            <span className='text-sm text-muted-foreground'>
              共 {pagination.total} 条，第 {pagination.current_page}/
              {pagination.last_page} 页
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
                disabled={page >= pagination.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        ) : null}
      </Main>

      <ResetUserDialog open={resetOpen} onOpenChange={setResetOpen} />
      <UserHistoryDialog
        userId={historyUserId}
        onOpenChange={(o) => !o && setHistoryUserId(null)}
      />
    </>
  )
}
