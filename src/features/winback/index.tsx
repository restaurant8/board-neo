import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, UserCheck } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  type WinbackLogsParams,
  fetchWinbackLogs,
  fetchWinbackStats,
} from './api'

const PER_PAGE = 20
const ALL = '__all__'

const MODE_MAP: Record<string, string> = {
  window: '窗口触发',
  backlog: '存量清洗',
}

function formatTime(ts: number) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

function StatsCards() {
  const { data } = useQuery({
    queryKey: ['winback-stats'],
    queryFn: fetchWinbackStats,
  })
  const items = [
    { label: '累计发送', value: data?.total_sent ?? '-' },
    { label: '窗口触发', value: data?.window_sent ?? '-' },
    { label: '存量清洗', value: data?.backlog_sent ?? '-' },
    { label: '已转化', value: data?.converted ?? '-' },
    {
      label: '转化率',
      value: data != null ? `${data.conversion_rate}%` : '-',
    },
  ]
  return (
    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
      {items.map((it) => (
        <Card key={it.label} className='gap-2 py-4'>
          <CardHeader className='px-4'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>
              {it.label}
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4'>
            <div className='text-2xl font-bold'>{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function WinbackPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<WinbackLogsParams>({})
  const [draft, setDraft] = useState({ email: '', mode: ALL })

  const { data, isLoading } = useQuery({
    queryKey: ['winback-logs', filters, page],
    queryFn: () =>
      fetchWinbackLogs({ ...filters, current: page, pageSize: PER_PAGE }),
  })

  function applyFilters() {
    setPage(1)
    setFilters({
      email: draft.email.trim() || undefined,
      mode: draft.mode === ALL ? undefined : draft.mode,
    })
  }

  const logs = data?.data ?? []
  const total = data?.total ?? 0
  const lastPage = data?.last_page ?? 1

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
            <h2 className='text-2xl font-bold tracking-tight'>流失召回</h2>
            <p className='text-muted-foreground'>
              查看召回邮件发送记录与转化效果。发送规则在 系统设置 → 流失召回 中配置。
            </p>
          </div>
        </div>

        <StatsCards />

        <div className='flex flex-wrap items-end gap-2 rounded-md border p-3'>
          <div className='grid gap-1'>
            <span className='text-muted-foreground text-xs'>用户邮箱</span>
            <Input
              className='h-9 w-48'
              placeholder='邮箱模糊搜索'
              value={draft.email}
              onChange={(e) =>
                setDraft((d) => ({ ...d, email: e.target.value }))
              }
            />
          </div>
          <div className='grid gap-1'>
            <span className='text-muted-foreground text-xs'>触发模式</span>
            <Select
              value={draft.mode}
              onValueChange={(v) => setDraft((d) => ({ ...d, mode: v }))}
            >
              <SelectTrigger className='h-9 w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部模式</SelectItem>
                <SelectItem value='window'>窗口触发</SelectItem>
                <SelectItem value='backlog'>存量清洗</SelectItem>
              </SelectContent>
            </Select>
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
                <TableHead>层级</TableHead>
                <TableHead>模式</TableHead>
                <TableHead>优惠码</TableHead>
                <TableHead>转化</TableHead>
                <TableHead>发送时间</TableHead>
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
                      <div className='font-medium'>{log.email}</div>
                      <div className='text-muted-foreground text-xs'>
                        ID {log.user_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary'>过期 {log.tier} 天</Badge>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {MODE_MAP[log.mode] ?? log.mode}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {log.coupon_code || '-'}
                    </TableCell>
                    <TableCell>
                      {log.converted ? (
                        <Badge className='bg-emerald-600 text-white hover:bg-emerald-600'>
                          <UserCheck className='size-3' /> 已回归
                        </Badge>
                      ) : (
                        <span className='text-muted-foreground text-xs'>-</span>
                      )}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs whitespace-nowrap'>
                      {formatTime(log.sent_at)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='text-muted-foreground h-24 text-center'
                  >
                    暂无召回记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 ? (
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              共 {total} 条，第 {page}/{lastPage} 页
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
        ) : null}
      </Main>
    </>
  )
}
