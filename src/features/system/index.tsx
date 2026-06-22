import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getAuditLog,
  getHorizonFailedJobs,
  getQueueMasters,
  getQueueStats,
  getQueueWorkload,
  getSystemStatus,
} from './api'

function fmtTime(t: number | string | null | undefined): string {
  if (t == null || t === '') return '—'
  const ms = typeof t === 'number' ? (t < 1e12 ? t * 1000 : t) : Date.parse(t)
  if (Number.isNaN(ms)) return String(t)
  return new Date(ms).toLocaleString('zh-CN')
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Badge>{label}正常</Badge>
  ) : (
    <Badge variant='destructive'>{label}异常</Badge>
  )
}

function StatCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-muted-foreground text-sm font-medium'>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className='text-2xl font-bold'>{value}</CardContent>
    </Card>
  )
}

export function SystemPage() {
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: getSystemStatus,
    refetchInterval: 15000,
  })
  const { data: stats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: getQueueStats,
    refetchInterval: 15000,
  })
  const { data: workload } = useQuery({
    queryKey: ['queue-workload'],
    queryFn: getQueueWorkload,
    refetchInterval: 15000,
  })
  const { data: masters } = useQuery({
    queryKey: ['queue-masters'],
    queryFn: getQueueMasters,
    refetchInterval: 15000,
  })
  const { data: failed, isLoading: failedLoading } = useQuery({
    queryKey: ['horizon-failed'],
    queryFn: () => getHorizonFailedJobs(1, 20),
  })
  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => getAuditLog({ current: page, page_size: pageSize }),
  })

  const auditLastPage = audit ? Math.max(1, Math.ceil(audit.total / pageSize)) : 1

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>系统状态</h2>
          <p className='text-muted-foreground'>系统健康、队列统计、失败任务与审计日志。</p>
        </div>

        {/* 系统健康 */}
        <div className='flex flex-wrap items-center gap-3'>
          {status && (
            <>
              <StatusBadge ok={status.schedule} label='定时任务' />
              <StatusBadge ok={status.horizon} label='Horizon' />
              <span className='text-muted-foreground text-sm'>
                上次调度：{fmtTime(status.schedule_last_runtime)}
              </span>
            </>
          )}
        </div>

        {/* 队列统计 */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard title='每分钟任务数' value={stats?.jobsPerMinute ?? '—'} />
          <StatCard title='近期任务' value={stats?.recentJobs ?? '—'} />
          <StatCard title='失败任务' value={stats?.failedJobs ?? '—'} />
          <StatCard title='进程数' value={stats?.processes ?? '—'} />
        </div>

        {/* 主管进程 (Horizon masters) */}
        {masters && masters.length > 0 && (
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-muted-foreground text-sm'>主管进程：</span>
            {masters.map((m) => (
              <Badge
                key={m.name}
                variant={m.status === 'paused' ? 'destructive' : 'secondary'}
              >
                {m.name} · {m.status}
              </Badge>
            ))}
          </div>
        )}

        <Tabs defaultValue='workload' className='w-full'>
          <TabsList>
            <TabsTrigger value='workload'>队列负载</TabsTrigger>
            <TabsTrigger value='failed'>失败任务</TabsTrigger>
            <TabsTrigger value='audit'>审计日志</TabsTrigger>
          </TabsList>

          {/* 队列负载 */}
          <TabsContent value='workload' className='pt-4'>
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>队列</TableHead>
                    <TableHead className='w-28'>长度</TableHead>
                    <TableHead className='w-28'>等待(秒)</TableHead>
                    <TableHead className='w-28'>进程</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workload && workload.length > 0 ? (
                    workload.map((w) => (
                      <TableRow key={w.name}>
                        <TableCell className='font-medium'>{w.name}</TableCell>
                        <TableCell>{w.length}</TableCell>
                        <TableCell>{w.wait}</TableCell>
                        <TableCell>{w.processes ?? '—'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className='h-24 text-center'>暂无队列负载</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* 失败任务 */}
          <TabsContent value='failed' className='pt-4'>
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务</TableHead>
                    <TableHead className='w-32'>队列</TableHead>
                    <TableHead className='w-44'>失败时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className='h-24 text-center'>加载中...</TableCell>
                    </TableRow>
                  ) : failed && failed.data.length > 0 ? (
                    failed.data.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className='font-medium'>{j.name ?? j.id}</TableCell>
                        <TableCell>{j.queue ?? '—'}</TableCell>
                        <TableCell>{fmtTime(j.failed_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className='h-24 text-center'>暂无失败任务</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* 审计日志 */}
          <TabsContent value='audit' className='pt-4'>
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-16'>ID</TableHead>
                    <TableHead>管理员</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>URI</TableHead>
                    <TableHead className='w-44'>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className='h-24 text-center'>加载中...</TableCell>
                    </TableRow>
                  ) : audit && audit.data.length > 0 ? (
                    audit.data.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.id}</TableCell>
                        <TableCell>{a.admin?.email ?? a.admin_id}</TableCell>
                        <TableCell>{a.action ?? '—'}</TableCell>
                        <TableCell className='max-w-xs truncate' title={a.uri}>
                          {a.method ? (
                            <Badge variant='secondary' className='me-1'>{a.method}</Badge>
                          ) : null}
                          {a.uri ?? '—'}
                        </TableCell>
                        <TableCell>{fmtTime(a.created_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className='h-24 text-center'>暂无日志</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className='flex items-center justify-between pt-3'>
              <span className='text-muted-foreground text-sm'>
                共 {audit?.total ?? 0} 条，第 {page}/{auditLastPage} 页
              </span>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= auditLastPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
