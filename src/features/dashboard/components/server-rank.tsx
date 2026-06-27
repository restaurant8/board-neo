import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowDown, ArrowUp, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { type TrafficRankItem, fetchTrafficRank } from '../api'
import { formatBytes } from '../format'
import { TimeRangeSelect, useTimeRange } from './time-range'

export function ServerRank() {
  const timeRange = useTimeRange('today')
  const { start_date, end_date } = timeRange.range

  const { data } = useQuery({
    queryKey: ['nodeTrafficRank', start_date, end_date],
    queryFn: () =>
      fetchTrafficRank({
        type: 'node',
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
            <Network className='mr-2 h-4 w-4' />
            节点流量排行
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

export function RankRow({ item, max }: { item: TrafficRankItem; max: number }) {
  const up = item.change >= 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className='flex cursor-pointer items-center justify-between space-x-2 rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted/70'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center justify-between'>
              <span className='truncate text-sm font-medium'>{item.name}</span>
              <span
                className={cn(
                  'ml-2 flex items-center text-xs font-medium',
                  up ? 'text-green-600' : 'text-red-600'
                )}
              >
                {up ? (
                  <ArrowUp className='mr-1 h-3 w-3' />
                ) : (
                  <ArrowDown className='mr-1 h-3 w-3' />
                )}
                {Math.abs(item.change)}%
              </span>
            </div>
            <div className='mt-1 flex items-center gap-2'>
              <div className='h-2 flex-1 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full bg-primary transition-all'
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
              <span className='text-xs text-muted-foreground'>
                {formatBytes(item.value)}
              </span>
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side='right' className='space-y-2 p-4'>
        <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
          <span className='text-muted-foreground'>当前流量：</span>
          <span className='font-medium'>{formatBytes(item.value)}</span>
          <span className='text-muted-foreground'>上期流量：</span>
          <span className='font-medium'>{formatBytes(item.previousValue)}</span>
          <span className='text-muted-foreground'>变化率：</span>
          <span
            className={cn('font-medium', up ? 'text-green-600' : 'text-red-600')}
          >
            {up ? '+' : ''}
            {item.change}%
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
