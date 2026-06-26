import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cpu, Eye } from 'lucide-react'
import { getHorizonFailedJobs, getQueueStats } from '@/features/system/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function fmt(ts?: number) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

/** 仪表盘「作业详情」卡片：Horizon 队列处理概况（对齐官方）。 */
export function JobDetailCard() {
  const [failedOpen, setFailedOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: getQueueStats,
    refetchInterval: 15000,
  })

  const { data: failed, isLoading: failedLoading } = useQuery({
    queryKey: ['horizon-failed-jobs'],
    queryFn: () => getHorizonFailedJobs(1, 50),
    enabled: failedOpen,
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
              <button
                type='button'
                title='查看报错详情'
                className='text-muted-foreground hover:text-foreground'
                onClick={() => setFailedOpen(true)}
              >
                <Eye className='size-4' />
              </button>
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

      <Dialog open={failedOpen} onOpenChange={setFailedOpen}>
        <DialogContent className='flex max-h-[85vh] w-[95vw] max-w-4xl flex-col gap-3 sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>失败任务详情</DialogTitle>
            <DialogDescription>
              近 7 日队列失败作业（共 {failed?.total ?? 0} 条）。
            </DialogDescription>
          </DialogHeader>
          <div className='overflow-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-40'>队列 / 任务</TableHead>
                  <TableHead className='w-40'>失败时间</TableHead>
                  <TableHead>异常</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className='h-24 text-center'>
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : (failed?.data?.length ?? 0) > 0 ? (
                  failed!.data.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className='align-top text-xs'>
                        <div className='font-medium'>{j.name ?? j.id}</div>
                        <div className='text-muted-foreground'>{j.queue}</div>
                      </TableCell>
                      <TableCell className='align-top text-xs'>
                        {fmt(j.failed_at)}
                      </TableCell>
                      <TableCell className='align-top'>
                        <pre className='max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs'>
                          {j.exception ?? '-'}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className='h-24 text-center'>
                      暂无失败任务
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
