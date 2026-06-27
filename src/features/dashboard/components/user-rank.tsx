import { useQuery } from '@tanstack/react-query'
import { Activity, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchTrafficRank } from '../api'
import { RankRow } from './server-rank'
import { TimeRangeSelect, useTimeRange } from './time-range'

export function UserRank() {
  const timeRange = useTimeRange('today')
  const { start_date, end_date } = timeRange.range

  const { data } = useQuery({
    queryKey: ['userTrafficRank', start_date, end_date],
    queryFn: () =>
      fetchTrafficRank({
        type: 'user',
        start_time: start_date,
        end_time: end_date,
      }),
    refetchInterval: 30000,
  })

  const rows = (data?.data ?? []).slice(0, 10)
  const max = rows[0]?.value || 1

  return (
    <Card>
      <CardHeader className='flex-none pb-2'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle className='flex items-center text-base font-medium'>
            <Users className='mr-2 h-4 w-4' />
            用户流量排行
          </CardTitle>
          <div className='flex min-w-0 items-center gap-1'>
            <TimeRangeSelect {...timeRange} />
            <Activity className='h-4 w-4 flex-shrink-0 text-muted-foreground' />
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex-1'>
        {rows.length ? (
          <ScrollArea className='h-[400px] pr-4'>
            <div className='space-y-3'>
              {rows.map((e) => (
                <RankRow key={e.id} item={e} max={max} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className='flex h-[400px] items-center justify-center'>
            <div className='animate-pulse'>加载中...</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
