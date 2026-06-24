import { useQuery } from '@tanstack/react-query'
import { Cpu, Eye } from 'lucide-react'
import { getQueueStats } from '@/features/system/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/** 仪表盘「作业详情」卡片：Horizon 队列处理概况（对齐官方）。 */
export function JobDetailCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: getQueueStats,
    refetchInterval: 15000,
  })

  const failedJobs = data?.failedJobs ?? 0
  const retention = data?.periods?.failedJobs ?? 0
  const maxRuntimeQueue = data?.queueWithMaxRuntime || 'N/A'
  const processes = data?.processes ?? 0
  const up = data?.status ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Cpu className='size-5' /> 作业详情
        </CardTitle>
        <CardDescription>队列处理详细信息</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-6'>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <div className='text-muted-foreground flex items-center gap-1 text-sm'>
              7日报错数量
            </div>
            <div className='mt-1 flex items-center gap-2'>
              <span className='text-2xl font-bold text-destructive'>
                {isLoading ? '—' : failedJobs}
              </span>
              <Eye className='text-muted-foreground size-4' />
            </div>
            <div className='text-muted-foreground text-xs'>
              保留 {retention} 小时
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-sm'>最长运行队列</div>
            <div className='mt-1 text-2xl font-bold'>0s</div>
            <div className='text-muted-foreground text-xs'>
              {isLoading ? '—' : maxRuntimeQueue}
            </div>
          </div>
        </div>

        <div>
          <div className='text-muted-foreground mb-2 flex items-center justify-between text-sm'>
            <span>活跃进程</span>
            <span className='font-medium'>{isLoading ? '—' : processes}</span>
          </div>
          <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
            <div
              className={up ? 'bg-foreground h-full' : 'bg-muted-foreground h-full'}
              style={{ width: processes > 0 ? '100%' : '0%' }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
