import { useState } from 'react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type StatRecordType, fetchStatRecord } from '../api'

const TABS: { key: StatRecordType; label: string; field: string }[] = [
  { key: 'paid_total', label: '收款金额', field: 'paid_total' },
  { key: 'commission_total', label: '佣金发放', field: 'commission_total' },
  { key: 'register_count', label: '注册量', field: 'register_count' },
]

function fmtDate(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 时间范围由仪表盘全局选择器（useTimeRange）传入。 */
export function IncomeTrendChart({
  range,
}: {
  range: { start_date: number; end_date: number }
}) {
  const [type, setType] = useState<StatRecordType>('paid_total')
  const active = TABS.find((t) => t.key === type)!

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
        <CardTitle>趋势统计</CardTitle>
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
