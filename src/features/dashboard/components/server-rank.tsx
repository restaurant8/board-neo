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

export function ServerRank() {
  const timeRange = useTimeRange('today')
  const { start_date, end_date } = timeRange.range

  const { data, isLoading } = useQuery({
    queryKey: ['traffic-rank', 'node', start_date, end_date],
    // 后端 getTrafficRank 入参为 start_time/end_time（unix 秒，整数）；
    // useTimeRange 产出的 start_date/end_date 即秒级，直接映射。
    queryFn: () =>
      fetchTrafficRank({
        type: 'node',
        start_time: start_date,
        end_time: end_date,
      }),
  })

  // 接口已限制为前 10，这里再兜底切一次。
  const rows = (data?.data ?? []).slice(0, 10)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-2'>
        <CardTitle>节点流量排行</CardTitle>
        <TimeRangeSelect {...timeRange} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>#</TableHead>
              <TableHead>节点</TableHead>
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
              rows.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className='text-muted-foreground'>{i + 1}</TableCell>
                  <TableCell className='font-medium'>{s.name}</TableCell>
                  <TableCell className='text-end'>
                    <div className='flex flex-col items-end'>
                      <span
                        className={cn(
                          'inline-flex items-center text-xs',
                          s.change >= 0 ? 'text-emerald-600' : 'text-destructive'
                        )}
                      >
                        {s.change >= 0 ? (
                          <ArrowUpRight className='size-3' />
                        ) : (
                          <ArrowDownRight className='size-3' />
                        )}
                        {formatPercent(s.change)}
                      </span>
                      <span className='font-medium'>{formatBytes(s.value)}</span>
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
