import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type StatRecordType, fetchStatRecord } from '../api'

const TABS: { key: StatRecordType; label: string; field: string }[] = [
  { key: 'paid_total', label: '收款金额', field: 'paid_total' },
  { key: 'commission_total', label: '佣金发放', field: 'commission_total' },
  { key: 'register_count', label: '注册量', field: 'register_count' },
]

type RangeMode = 'today' | '7' | '15' | '30' | 'custom'

const RANGE_OPTIONS: { value: RangeMode; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: '7', label: '近 7 天' },
  { value: '15', label: '近 15 天' },
  { value: '30', label: '近 30 天' },
  { value: 'custom', label: '自定义' },
]

const DAY = 86400
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}
function fmtDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
/** date input(yyyy-mm-dd) ↔ unix 秒(当地 0 点) */
function dateToTs(v: string) {
  return v ? Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000) : 0
}
function tsToDate(ts: number) {
  const d = new Date(ts * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function IncomeTrendChart() {
  const [type, setType] = useState<StatRecordType>('paid_total')
  const [mode, setMode] = useState<RangeMode>('7')
  const today = startOfToday()
  const [customStart, setCustomStart] = useState(tsToDate(today - 6 * DAY))
  const [customEnd, setCustomEnd] = useState(tsToDate(today))
  const active = TABS.find((t) => t.key === type)!

  const range = useMemo(() => {
    const end = today + DAY // 上界开区间(明天 0 点)
    if (mode === 'today') return { start_date: today, end_date: end }
    if (mode === 'custom') {
      const s = dateToTs(customStart) || today
      const e = (dateToTs(customEnd) || today) + DAY
      return { start_date: s, end_date: e }
    }
    const days = Number(mode)
    return { start_date: today - (days - 1) * DAY, end_date: end }
  }, [mode, customStart, customEnd, today])

  const { data, isLoading } = useQuery({
    queryKey: ['stat-record', type, range.start_date, range.end_date],
    queryFn: () => fetchStatRecord(type, range),
  })

  const chartData = (data ?? []).map((r) => ({
    date: fmtDate(r.record_at),
    value: Number((r as Record<string, unknown>)[active.field] ?? 0),
  }))

  return (
    <Card className='col-span-full'>
      <CardHeader className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>趋势统计</CardTitle>
          <div className='flex flex-wrap items-center gap-2'>
            <Select value={mode} onValueChange={(v) => setMode(v as RangeMode)}>
              <SelectTrigger className='h-8 w-28'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === 'custom' && (
              <>
                <Input
                  type='date'
                  className='h-8 w-36'
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className='text-muted-foreground text-sm'>~</span>
                <Input
                  type='date'
                  className='h-8 w-36'
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </>
            )}
          </div>
        </div>
        <Tabs value={type} onValueChange={(v) => setType(v as StatRecordType)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='bg-muted/40 h-72 animate-pulse rounded-md' />
        ) : chartData.length === 0 ? (
          <div className='text-muted-foreground flex h-72 items-center justify-center text-sm'>
            暂无数据
          </div>
        ) : (
          <ResponsiveContainer width='100%' height={288}>
            <AreaChart data={chartData} margin={{ left: 0, right: 12, top: 8 }}>
              <defs>
                <linearGradient id='incomeFill' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='var(--primary)' stopOpacity={0.4} />
                  <stop offset='95%' stopColor='var(--primary)' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
              <XAxis dataKey='date' tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} width={48} fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
                labelStyle={{ color: 'var(--foreground)' }}
              />
              <Area
                type='monotone'
                dataKey='value'
                name={active.label}
                stroke='var(--primary)'
                fill='url(#incomeFill)'
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
