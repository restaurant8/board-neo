import { useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowDownToLine, ArrowUpFromLine, Sigma } from 'lucide-react'
import { formatBytes } from '@/features/dashboard/format'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuditTable } from './components/audit-table'
import { DiagnosticsTable } from './components/diagnostics-table'

type Summary = { u: number; d: number; total: number }

const route = getRouteApi('/_authenticated/traffic-stat/')

const RANGES = [
  { label: '今日', days: 0 },
  { label: '近 7 天', days: 7 },
  { label: '近 30 天', days: 30 },
]

const EMPTY_SUMMARY: Summary = { u: 0, d: 0, total: 0 }

export function TrafficStatPage() {
  // 默认「今日」以减小大表聚合的首屏扫描量；需要更长区间可手动切换
  const [days, setDays] = useState(0)
  const [mode, setMode] = useState<'all' | 'privacy' | 'diagnostic'>('all')
  const [keyword, setKeyword] = useState('')
  const [userKeyword, setUserKeyword] = useState('')
  // tab 由 URL 驱动，便于侧栏「流量统计 / 流量审计」两个菜单直达对应页签
  const { tab: tabParam } = route.useSearch()
  const navigate = route.useNavigate()
  const tab: 'diagnostics' | 'audit' = tabParam ?? 'diagnostics'
  const setTab = (v: 'diagnostics' | 'audit') =>
    navigate({ search: (prev) => ({ ...prev, tab: v }) })

  // 各 tab 的汇总分开存，避免切换时串数据
  const [diagSummary, setDiagSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [auditSummary, setAuditSummary] = useState<Summary>(EMPTY_SUMMARY)

  const range = useMemo(() => {
    const end = Math.floor(Date.now() / 1000)
    const start =
      days === 0
        ? Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)
        : end - days * 86400
    return { start, end }
  }, [days])

  // 审计接口默认 diagnostic；当总模式为 all 时审计用 diagnostic 以拿到目的地维度
  const auditMode = mode === 'all' ? 'diagnostic' : mode

  const summary = tab === 'diagnostics' ? diagSummary : auditSummary

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
            节点、类别、域名维度的流量明细，以及用户维度的流量审计。数据由「系统配置
            → 服务器 →
            流量统计模式」开启后采集；隐私模式不含主域名，授权诊断模式含主域名与目的地。
          </p>
        </div>

        {/* 汇总 */}
        <div className='grid grid-cols-3 gap-3'>
          <Card className='flex-row items-center justify-between p-4'>
            <div>
              <div className='text-muted-foreground text-sm'>上行</div>
              <div className='text-xl font-bold'>{formatBytes(summary.u)}</div>
            </div>
            <ArrowUpFromLine className='size-5 text-sky-500' />
          </Card>
          <Card className='flex-row items-center justify-between p-4'>
            <div>
              <div className='text-muted-foreground text-sm'>下行</div>
              <div className='text-xl font-bold'>{formatBytes(summary.d)}</div>
            </div>
            <ArrowDownToLine className='size-5 text-emerald-500' />
          </Card>
          <Card className='flex-row items-center justify-between p-4'>
            <div>
              <div className='text-muted-foreground text-sm'>总计</div>
              <div className='text-xl font-bold'>
                {formatBytes(summary.total)}
              </div>
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
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as typeof mode)}
          >
            <SelectTrigger className='h-8 w-36'>
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
            onChange={(e) => setKeyword(e.target.value)}
            className='h-8 w-48'
          />
          {tab === 'audit' && (
            <Input
              placeholder='搜索用户邮箱/UID...'
              value={userKeyword}
              onChange={(e) => setUserKeyword(e.target.value)}
              className='h-8 w-48'
            />
          )}
        </div>

        {/* 明细表 */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className='flex flex-1 flex-col gap-4'
        >
          <TabsList className='w-fit'>
            <TabsTrigger value='diagnostics'>节点统计</TabsTrigger>
            <TabsTrigger value='audit'>用户审计</TabsTrigger>
          </TabsList>

          <TabsContent value='diagnostics' className='flex flex-1 flex-col'>
            <DiagnosticsTable
              range={range}
              mode={mode}
              keyword={keyword}
              onSummary={setDiagSummary}
            />
          </TabsContent>

          <TabsContent value='audit' className='flex flex-1 flex-col'>
            <AuditTable
              range={range}
              mode={auditMode}
              userKeyword={userKeyword}
              serverKeyword={keyword}
              onSummary={setAuditSummary}
            />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
