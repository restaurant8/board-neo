import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  Copy,
  Cpu,
  ExternalLink,
  Eye,
  HardDrive,
  KeyRound,
  Link2,
  MemoryStick,
  Network,
  RotateCw,
  Unlink,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { getNodes, updateNode } from '@/features/server-manage/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  type Machine,
  fetchMachineHistory,
  fetchMachineNodes,
  getInstallCommand,
  getMachineToken,
  resetMachineToken,
} from '../api'
import { fmtAgo, fmtBytes, fmtSpeed, isOnline, pct, readLoad } from '../format'

type Props = {
  machine: Machine | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddNode?: (machine: Machine) => void
}

const RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
]

function Metric({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  percent?: number
}) {
  return (
    <div className='grid gap-1'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        {icon}
        {label}
        <span className='text-foreground ms-auto font-medium'>{value}</span>
      </div>
      {percent != null && (
        <div className='bg-muted h-1.5 w-full overflow-hidden rounded-full'>
          <div
            className='bg-primary h-full rounded-full'
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function MachineDetailDrawer({
  machine,
  open,
  onOpenChange,
  onAddNode,
}: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [hours, setHours] = useState(6)
  const [token, setToken] = useState<string | null>(null)
  const [command, setCommand] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  const id = machine?.id ?? 0
  const load = readLoad(machine?.load_status ?? null)
  const online = isOnline(machine?.last_seen_at)

  const { data: history } = useQuery({
    queryKey: ['machine-history', id, hours],
    queryFn: () => fetchMachineHistory(id, { range_hours: hours }),
    enabled: open && id > 0,
    refetchInterval: open ? 30000 : false,
  })

  const { data: nodes } = useQuery({
    queryKey: ['machine-nodes', id],
    queryFn: () => fetchMachineNodes(id),
    enabled: open && id > 0,
  })

  const tokenMutation = useMutation({
    mutationFn: () => getMachineToken(id),
    onSuccess: (r) => setToken(r.token),
    onError: handleServerError,
  })
  const resetTokenMutation = useMutation({
    mutationFn: () => resetMachineToken(id),
    onSuccess: (r) => {
      setToken(r.token)
      toast.success('Token 已重置，旧 token 已失效')
    },
    onError: handleServerError,
  })
  const installMutation = useMutation({
    mutationFn: () => getInstallCommand(id),
    onSuccess: (r) => setCommand(r.command),
    onError: handleServerError,
  })

  const refreshNodes = () => {
    queryClient.invalidateQueries({ queryKey: ['machine-nodes', id] })
    queryClient.invalidateQueries({ queryKey: ['machines'] })
  }

  // 切换节点激活（enabled）
  const toggleMutation = useMutation({
    mutationFn: (n: { id: number; enabled: boolean }) =>
      updateNode({ id: n.id, enabled: n.enabled }),
    onSuccess: refreshNodes,
    onError: handleServerError,
  })

  // 取消关联（machine_id 置空）
  const unlinkMutation = useMutation({
    mutationFn: (nodeId: number) => updateNode({ id: nodeId, machine_id: null }),
    onSuccess: () => {
      toast.success('已取消关联')
      refreshNodes()
    },
    onError: handleServerError,
  })

  // 关联已有节点（machine_id 指向当前机器）
  const linkMutation = useMutation({
    mutationFn: (nodeId: number) => updateNode({ id: nodeId, machine_id: id }),
    onSuccess: () => {
      toast.success('已关联节点')
      refreshNodes()
    },
    onError: handleServerError,
  })

  // 可关联的节点：尚未绑定任何机器（machine_id 为空）
  const { data: linkableNodes } = useQuery({
    queryKey: ['linkable-nodes'],
    queryFn: getNodes,
    enabled: linkOpen,
    select: (list) => list.filter((s) => s.machine_id == null),
  })

  const chartData = (history ?? []).map((h) => ({
    t: new Date(h.recorded_at * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    CPU: Number((h.cpu ?? 0).toFixed(1)),
    MEM: pct(h.mem_used, h.mem_total),
    DISK: pct(h.disk_used, h.disk_total),
  }))

  if (!machine) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            {machine.name}
          </SheetTitle>
        </SheetHeader>

        <div className='grid gap-4 px-4 pb-8'>
          {/* 概览 */}
          <div className='rounded-lg border p-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary'>SID:{machine.id}</Badge>
              {online ? (
                <Badge className='border-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
                  在线
                </Badge>
              ) : (
                <Badge variant='destructive'>离线</Badge>
              )}
              <span className='text-muted-foreground text-sm'>
                CPU {(load.cpu ?? 0).toFixed(1)}%
              </span>
              <div className='ms-auto flex gap-2'>
                <Button size='sm' onClick={() => onAddNode?.(machine)}>
                  新增节点到此服务器 <ArrowRight className='size-4' />
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    onOpenChange(false)
                    navigate({ to: '/server/manage' })
                  }}
                >
                  前往节点管理
                </Button>
              </div>
            </div>
            <div className='text-muted-foreground mt-2 text-sm'>
              最后心跳：{fmtAgo(machine.last_seen_at)} · 节点数：
              {machine.servers_count}
              {machine.notes ? ` · ${machine.notes}` : ''}
            </div>
          </div>

          {/* 负载趋势 */}
          <div className='rounded-lg border p-4'>
            <div className='mb-2 flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <Activity className='size-4' /> 负载趋势
              </div>
              <div className='flex gap-1'>
                {RANGES.map((r) => (
                  <Button
                    key={r.hours}
                    size='sm'
                    variant={hours === r.hours ? 'default' : 'ghost'}
                    className='h-7 px-2 text-xs'
                    onClick={() => setHours(r.hours)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className='h-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray='3 3' opacity={0.2} />
                  <XAxis dataKey='t' fontSize={10} minTickGap={24} />
                  <YAxis fontSize={10} domain={[0, 100]} unit='%' width={36} />
                  <Tooltip />
                  <Line
                    type='monotone'
                    dataKey='CPU'
                    stroke='#0ea5e9'
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    type='monotone'
                    dataKey='MEM'
                    stroke='#f59e0b'
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    type='monotone'
                    dataKey='DISK'
                    stroke='#ef4444'
                    dot={false}
                    strokeWidth={1.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 负载指标 */}
          <div className='grid gap-3 rounded-lg border p-4'>
            <div className='text-sm font-medium'>负载</div>
            <Metric
              icon={<Cpu className='size-3.5' />}
              label='CPU'
              value={`${(load.cpu ?? 0).toFixed(1)}%`}
              percent={load.cpu ?? 0}
            />
            <Metric
              icon={<MemoryStick className='size-3.5' />}
              label='内存'
              value={`${fmtBytes(load.mem?.used)} / ${fmtBytes(load.mem?.total)}`}
              percent={pct(load.mem?.used, load.mem?.total)}
            />
            <Metric
              icon={<HardDrive className='size-3.5' />}
              label='磁盘'
              value={`${fmtBytes(load.disk?.used)} / ${fmtBytes(load.disk?.total)}`}
              percent={pct(load.disk?.used, load.disk?.total)}
            />
            <Metric
              icon={<Network className='size-3.5' />}
              label='网络速度'
              value={`↓${fmtSpeed(load.net?.in_speed)} ↑${fmtSpeed(load.net?.out_speed)}`}
            />
          </div>

          {/* 服务器 Token */}
          <div className='grid gap-2 rounded-lg border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <KeyRound className='size-4' /> 服务器 Token
            </div>
            <p className='text-muted-foreground text-xs'>
              此 Token 用于 xboard-node 向面板认证，请妥善保管。
            </p>
            {token && (
              <code className='bg-muted block rounded p-2 text-xs break-all'>
                {token}
              </code>
            )}
            <div className='flex gap-2'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => tokenMutation.mutate()}
                disabled={tokenMutation.isPending}
              >
                <Eye className='size-4' /> 查看 Token
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => resetTokenMutation.mutate()}
                disabled={resetTokenMutation.isPending}
              >
                <RotateCw className='size-4' /> 重置 Token
              </Button>
            </div>
          </div>

          {/* 安装命令 */}
          <div className='grid gap-2 rounded-lg border p-4'>
            <div className='text-sm font-medium'>安装 xboard-node</div>
            <p className='text-muted-foreground text-xs'>
              在目标服务器上执行此命令，即可用 machine mode 安装 xboard-node
              并接入当前服务器记录。
            </p>
            {command ? (
              <>
                <code className='bg-muted block rounded p-2 text-xs break-all'>
                  {command}
                </code>
                <Button
                  size='sm'
                  variant='outline'
                  className='w-fit'
                  onClick={() => {
                    navigator.clipboard?.writeText(command)
                    toast.success('已复制安装命令')
                  }}
                >
                  <Copy className='size-4' /> 复制安装命令
                </Button>
              </>
            ) : (
              <Button
                size='sm'
                variant='outline'
                className='w-fit'
                onClick={() => installMutation.mutate()}
                disabled={installMutation.isPending}
              >
                获取安装命令
              </Button>
            )}
          </div>

          {/* 关联节点 */}
          <div className='grid gap-2 rounded-lg border p-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='text-sm font-medium'>关联节点</div>
              <Badge variant='secondary'>{nodes?.length ?? 0} 个节点</Badge>
              <Badge variant='outline'>
                {(nodes ?? []).filter((n) => n.enabled).length} 个已激活
              </Badge>
              <div className='ms-auto flex items-center gap-1'>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 px-2 text-xs'
                  onClick={() => setLinkOpen(true)}
                >
                  <Link2 className='size-4' /> 关联已有节点
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 px-2 text-xs'
                  onClick={() => {
                    onOpenChange(false)
                    navigate({ to: '/server/manage' })
                  }}
                >
                  前往节点管理 <ArrowRight className='size-4' />
                </Button>
              </div>
            </div>
            <div className='overflow-hidden rounded border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 text-muted-foreground'>
                  <tr>
                    <th className='p-2 text-start font-normal'>名称</th>
                    <th className='p-2 text-start font-normal'>类型</th>
                    <th className='p-2 text-start font-normal'>地址</th>
                    <th className='p-2 text-start font-normal'>已激活</th>
                    <th className='p-2 text-end font-normal'></th>
                  </tr>
                </thead>
                <tbody>
                  {nodes && nodes.length > 0 ? (
                    nodes.map((n) => (
                      <tr key={n.id} className='border-t'>
                        <td className='p-2'>
                          <button
                            type='button'
                            className='hover:text-primary inline-flex items-center gap-1 text-start'
                            title='前往节点管理'
                            onClick={() => {
                              onOpenChange(false)
                              navigate({ to: '/server/manage' })
                            }}
                          >
                            {n.name}
                            <ExternalLink className='size-3 opacity-60' />
                          </button>
                        </td>
                        <td className='p-2'>
                          <Badge variant='outline'>{n.type}</Badge>
                        </td>
                        <td className='text-muted-foreground p-2'>
                          {n.host}
                          {n.port ? `:${n.port}` : ''}
                        </td>
                        <td className='p-2'>
                          <Switch
                            checked={Boolean(n.enabled)}
                            disabled={toggleMutation.isPending}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                id: n.id,
                                enabled: checked,
                              })
                            }
                          />
                        </td>
                        <td className='p-2 text-end'>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-7'
                            title='取消关联'
                            disabled={unlinkMutation.isPending}
                            onClick={() => unlinkMutation.mutate(n.id)}
                          >
                            <Unlink className='size-4' />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className='text-muted-foreground p-4 text-center'
                      >
                        暂无关联节点
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SheetContent>

      {/* 关联已有节点 */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>关联已有节点</DialogTitle>
          </DialogHeader>
          <div className='max-h-80 overflow-y-auto'>
            {linkableNodes && linkableNodes.length > 0 ? (
              <div className='grid gap-1'>
                {linkableNodes.map((s) => (
                  <div
                    key={s.id}
                    className='hover:bg-muted/50 flex items-center gap-2 rounded px-2 py-1.5 text-sm'
                  >
                    <Badge variant='outline'>{s.type}</Badge>
                    <span className='truncate'>{s.name}</span>
                    <span className='text-muted-foreground ms-auto flex items-center gap-2 text-xs'>
                      {s.host}
                      {s.port ? `:${s.port}` : ''}
                    </span>
                    <Button
                      size='sm'
                      variant='outline'
                      className='h-7 px-2 text-xs'
                      disabled={linkMutation.isPending}
                      onClick={() => linkMutation.mutate(s.id)}
                    >
                      <Link2 className='size-4' /> 关联
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground py-6 text-center text-sm'>
                没有可关联的空闲节点（未绑定机器的节点）。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setLinkOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
