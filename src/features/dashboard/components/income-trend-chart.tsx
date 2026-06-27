import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchOrderStat } from '../api'

// 原版收入概览：order 系列用主图表色，commission 系列用次图表色。
// （原版用 --primary/--secondary；本项目 --secondary 近白色不可见，改用 --chart-1/2。）
const COLORS = {
  income: 'var(--chart-1)',
  commission: 'var(--chart-2)',
}

const yuan = (cents: number) => (Number(cents ?? 0) / 100).toFixed(2)

function fmtDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

type TooltipEntry = { name?: string; value?: number; color?: string }
function ChartTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  mode: 'amount' | 'count'
}) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className='rounded-lg border bg-background p-3 shadow-sm'>
      <div className='mb-2 text-sm font-medium'>{label}</div>
      {payload.map((p, i) => (
        <div key={i} className='flex items-center gap-2 text-sm'>
          <div
            className='h-2 w-2 rounded-full'
            style={{ backgroundColor: p.color }}
          />
          <span className='text-muted-foreground'>{p.name}:</span>
          <span className='font-medium'>
            {mode === 'amount'
              ? `¥${yuan(Number(p.value))}`
              : `${Number(p.value)} 笔交易`}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 收入概览（对齐原版 dashboard:overview）。时间范围由全局选择器传入。 */
export function IncomeTrendChart() {
  const [mode, setMode] = useState<'amount' | 'count'>('amount')
  // 对齐原版收入概览：预设 30/90/180/365 天，默认 30 天；
  // 范围 = [今天 - N 天, 今天]（subDays(today, N) ~ today），格式 yyyy-MM-dd。
  const [rangeDays, setRangeDays] = useState('30')

  const { start, end } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const from = new Date(today)
    from.setDate(from.getDate() - Number(rangeDays))
    const p = (n: number) => String(n).padStart(2, '0')
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    return { start: ymd(from), end: ymd(today) }
  }, [rangeDays])

  const { data } = useQuery({
    queryKey: ['order-stat', start, end],
    queryFn: () => fetchOrderStat({ start_date: start, end_date: end }),
    refetchInterval: 30000,
  })

  const list = (data?.list ?? []).map((r) => ({ ...r, date: fmtDate(r.date) }))
  const summary = data?.summary

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>收入概览</CardTitle>
            <CardDescription>
              {summary?.start_date} 至 {summary?.end_date}
            </CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            <Select value={rangeDays} onValueChange={setRangeDays}>
              <SelectTrigger className='h-8 w-28'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='30'>近30天</SelectItem>
                <SelectItem value='90'>近90天</SelectItem>
                <SelectItem value='180'>近180天</SelectItem>
                <SelectItem value='365'>近1年</SelectItem>
              </SelectContent>
            </Select>
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as 'amount' | 'count')}
            >
              <TabsList>
                <TabsTrigger value='amount'>金额</TabsTrigger>
                <TabsTrigger value='count'>数量</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1'>
            <div className='text-sm text-muted-foreground'>总收入</div>
            <div className='text-2xl font-bold'>
              ¥{yuan(summary?.paid_total ?? 0)}
            </div>
            <div className='text-xs text-muted-foreground'>
              共 {summary?.paid_count ?? 0} 笔交易
            </div>
            <div className='text-xs text-muted-foreground'>
              平均订单金额: ¥{yuan(summary?.avg_paid_amount ?? 0)}
            </div>
          </div>
          <div className='space-y-1'>
            <div className='text-sm text-muted-foreground'>总佣金</div>
            <div className='text-2xl font-bold'>
              ¥{yuan(summary?.commission_total ?? 0)}
            </div>
            <div className='text-xs text-muted-foreground'>
              共 {summary?.commission_count ?? 0} 笔交易
            </div>
            <div className='text-xs text-muted-foreground'>
              佣金比例: {(summary?.commission_rate ?? 0).toFixed(2)}%
            </div>
          </div>
        </div>

        <div className='h-[400px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            {mode === 'amount' ? (
              <AreaChart
                data={list}
                margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id='incomeGradient' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor={COLORS.income} stopOpacity={0.2} />
                    <stop
                      offset='100%'
                      stopColor={COLORS.income}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id='commissionGradient'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='0%'
                      stopColor={COLORS.commission}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset='100%'
                      stopColor={COLORS.commission}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey='date'
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  tickFormatter={(t) => `¥${yuan(Number(t))}`}
                />
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  stroke='var(--border)'
                  opacity={0.3}
                />
                <Tooltip content={<ChartTooltip mode='amount' />} />
                <Area
                  type='monotone'
                  dataKey='paid_total'
                  name='订单金额'
                  stroke={COLORS.income}
                  fill='url(#incomeGradient)'
                  strokeWidth={2}
                />
                <Area
                  type='monotone'
                  dataKey='commission_total'
                  name='佣金金额'
                  stroke={COLORS.commission}
                  fill='url(#commissionGradient)'
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={list}
                margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey='date'
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  tickFormatter={(t) => `${Number(t)} 笔交易`}
                />
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  stroke='var(--border)'
                  opacity={0.3}
                />
                <Tooltip content={<ChartTooltip mode='count' />} />
                <Bar
                  dataKey='paid_count'
                  name='订单数量'
                  fill={COLORS.income}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey='commission_count'
                  name='佣金数量'
                  fill={COLORS.commission}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
