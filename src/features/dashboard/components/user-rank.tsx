import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchTrafficRank } from '../api'
import { formatBytes, formatPercent } from '../format'
import { TimeRangeSelect, useTimeRange } from './time-range'

export function UserRank() {
  const timeRange = useTimeRange('today')
  const { start_date, end_date } = timeRange.range

  const { data, isLoading } = useQuery({
    queryKey: ['traffic-rank', 'user', start_date, end_date],
    queryFn: () =>
      fetchTrafficRank({
        type: 'user',
        start_time: start_date,
        end_time: end_date,
      }),
  })

  const rows = (data?.data ?? []).slice(0, 10)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-2'>
        <CardTitle>用户流量排行</CardTitle>
        <TimeRangeSelect {...timeRange} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>#</TableHead>
              <TableHead>用户</TableHead>
              <TableHead className='text-end'>环比 / 流量</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className='text-muted-foreground'>{i + 1}</TableCell>
                  <TableCell className='max-w-[180px] truncate font-medium'>
                    {r.name}
                  </TableCell>
                  <TableCell className='text-end'>
                    <div className='flex flex-col items-end'>
                      <span
                        className={cn(
                          'inline-flex items-center text-xs',
                          r.change >= 0 ? 'text-emerald-600' : 'text-destructive'
                        )}
                      >
                        {r.change >= 0 ? (
                          <ArrowUpRight className='size-3' />
                        ) : (
                          <ArrowDownRight className='size-3' />
                        )}
                        {formatPercent(r.change)}
                      </span>
                      <span className='font-medium'>{formatBytes(r.value)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className='h-24 text-center'>
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
