import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, Sigma } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchTrafficDiagnostics } from './api'

function fmtBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${u[i]}`
}

const RANGES = [
  { label: '今日', days: 0 },
  { label: '近 7 天', days: 7 },
  { label: '近 30 天', days: 30 },
]

export function TrafficStatPage() {
  const [days, setDays] = useState(7)
  const [mode, setMode] = useState<'all' | 'privacy' | 'diagnostic'>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const range = useMemo(() => {
    const end = Math.floor(Date.now() / 1000)
    const start =
      days === 0
        ? Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)
        : end - days * 86400
    return { start, end }
  }, [days])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['traffic-diag', range.start, range.end, mode, keyword, page],
    queryFn: () =>
      fetchTrafficDiagnostics({
        start_time: range.start,
        end_time: range.end,
        mode,
        server_keyword: keyword || undefined,
        order_by: 'total',
        order_dir: 'desc',
        page,
        page_size: 20,
      }),
  })

  const summary = data?.summary ?? { u: 0, d: 0, total: 0 }
  const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / 20))

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>流量统计</h2>
          <p className='text-muted-foreground'>
            节点、类别、域名维度的流量明细。数据由「系统配置 → 服务器 →
            流量统计模式」开启后采集；隐私模式不含主域名，授权诊断模式含主域名。
          </p>
        </div>

        {/* 汇总 */}
        <div className='grid grid-cols-3 gap-3'>
          <Card className='flex-row items-center justify-between p-4'>
            <div>
              <div className='text-muted-foreground text-sm'>上行</div>
              <div className='text-xl font-bold'>{fmtBytes(summary.u)}</div>
            </div>
            <ArrowUpFromLine className='size-5 text-sky-500' />
          </Card>
          <Card className='flex-row items-center justify-between p-4'>
            <div>
              <div className='text-muted-foreground text-sm'>下行</div>
              <div className='text-xl font-bold'>{fmtBytes(summary.d)}</div>
            </div>
            <ArrowDownToLine className='size-5 text-emerald-500' />
          </Card>
          <Card className='flex-row items-center justify-between p-4'>
            <div>
              <div className='text-muted-foreground text-sm'>总计</div>
              <div className='text-xl font-bold'>{fmtBytes(summary.total)}</div>
            </div>
            <Sigma className='size-5 text-amber-500' />
          </Card>
        </div>

        {/* 工具栏 */}
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex gap-1'>
            {RANGES.map((r) => (
              <Button
                key={r.days}
                size='sm'
                variant={days === r.days ? 'default' : 'outline'}
                onClick={() => {
                  setDays(r.days)
                  setPage(1)
                }}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <Select
            value={mode}
            onValueChange={(v) => {
              setMode(v as typeof mode)
              setPage(1)
            }}
          >
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部</SelectItem>
              <SelectItem value='privacy'>隐私统计</SelectItem>
              <SelectItem value='diagnostic'>授权诊断</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder='搜索节点名称/ID...'
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            className='max-w-xs'
          />
        </div>

        {/* 明细表 */}
        <div className='overflow-hidden rounded-md border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-muted-foreground'>
              <tr>
                <th className='p-3 text-start font-normal'>节点</th>
                <th className='p-3 text-start font-normal'>类别</th>
                {mode === 'diagnostic' && (
                  <th className='p-3 text-start font-normal'>主域名</th>
                )}
                <th className='p-3 text-end font-normal'>上行</th>
                <th className='p-3 text-end font-normal'>下行</th>
                <th className='p-3 text-end font-normal'>合计</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className='h-24 text-center'>
                    加载中...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td
                    colSpan={6}
                    className='text-muted-foreground h-24 text-center'
                  >
                    暂无数据（需在「系统配置 → 服务器」开启流量统计模式，或该后端未启用此功能）。
                  </td>
                </tr>
              ) : data && data.list.length > 0 ? (
                data.list.map((row, i) => (
                  <tr key={`${row.server_id}-${row.category}-${i}`} className='border-t'>
                    <td className='p-3'>{row.server_name || `#${row.server_id}`}</td>
                    <td className='p-3'>
                      <Badge variant='outline'>{row.category || '其它'}</Badge>
                    </td>
                    {mode === 'diagnostic' && (
                      <td className='text-muted-foreground p-3'>
                        {row.main_domain || '—'}
                      </td>
                    )}
                    <td className='p-3 text-end'>{fmtBytes(row.u)}</td>
                    <td className='p-3 text-end'>{fmtBytes(row.d)}</td>
                    <td className='p-3 text-end font-medium'>
                      {fmtBytes(row.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className='text-muted-foreground h-24 text-center'
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {lastPage > 1 && (
          <div className='flex items-center justify-end gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <span className='text-muted-foreground text-sm'>
              {page} / {lastPage}
            </span>
            <Button
              size='sm'
              variant='outline'
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        )}
      </Main>
    </>
  )
}
