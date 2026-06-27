import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw, Timer, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getQueueStats } from '@/features/system/api'

/** 仪表盘「队列状态」卡片：Horizon 队列实时运行状态（对齐原版）。 */
export function QueueStatusCard() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: getQueueStats,
    refetchInterval: 15000,
  })

  const status = data?.status ?? false
  const recent = data?.recentJobs ?? 0
  const periodRecent = data?.periods?.recentJobs ?? 0
  const perMin = data?.jobsPerMinute ?? 0
  // 对齐原版：近期任务数 / 周期内任务数 * 100；每分钟处理量缺最大吞吐分母时，有量即满。
  const recentPct =
    periodRecent > 0
      ? Math.min((recent / periodRecent) * 100, 100)
      : recent > 0
        ? 100
        : 0
  const perMinPct = perMin > 0 ? 100 : 0
  const waitObj = data?.wait
  const wait =
    waitObj && typeof waitObj === 'object'
      ? Math.max(
          0,
          ...Object.values(waitObj as Record<string, number>).map(
            (v) => Number(v) || 0
          )
        )
      : 0

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between space-y-0'>
        <div className='space-y-1.5'>
          <CardTitle className='flex items-center gap-2'>
            <Timer className='h-5 w-5' /> 队列状态
          </CardTitle>
          <CardDescription>当前队列运行状态</CardDescription>
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          title='刷新'
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ['queue-stats'] })
          }
        >
          <RefreshCw className='h-4 w-4' />
        </Button>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='flex items-center justify-between rounded-lg bg-muted/50 p-3'>
            <div className='flex items-center gap-2'>
              {status ? (
                <CheckCircle2 className='h-5 w-5 text-emerald-500' />
              ) : (
                <XCircle className='text-destructive h-5 w-5' />
              )}
              <div>
                <p className='text-sm font-medium'>运行状态</p>
                <p className='text-muted-foreground text-xs'>
                  当前等待时间: {wait} 秒
                </p>
              </div>
            </div>
            <Badge variant={status ? 'secondary' : 'destructive'}>
              {status ? '正常' : '异常'}
            </Badge>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2 rounded-lg bg-muted/50 p-3'>
              <p className='text-muted-foreground text-sm'>近期任务数</p>
              <p className='text-2xl font-bold'>{isLoading ? '—' : recent}</p>
              <div className='bg-muted h-1 w-full overflow-hidden rounded-full'>
                <div
                  className='bg-primary h-full'
                  style={{ width: `${recentPct}%` }}
                />
              </div>
            </div>
            <div className='space-y-2 rounded-lg bg-muted/50 p-3'>
              <p className='text-muted-foreground text-sm'>每分钟处理量</p>
              <p className='text-2xl font-bold'>{isLoading ? '—' : perMin}</p>
              <div className='bg-muted h-1 w-full overflow-hidden rounded-full'>
                <div
                  className='bg-primary h-full'
                  style={{ width: `${perMinPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
