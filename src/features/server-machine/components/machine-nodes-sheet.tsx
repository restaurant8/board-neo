import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Machine,
  fetchMachineHistory,
  fetchMachineNodes,
} from '../api'

function fmtBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = Math.max(bytes, 0)
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${Math.round(v * 100) / 100} ${units[i]}`
}

function fmtTime(ts: number | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

type Props = {
  machine: Machine | null
  onOpenChange: (open: boolean) => void
}

export function MachineNodesSheet({ machine, onOpenChange }: Props) {
  const open = !!machine
  const machineId = machine?.id

  const { data: nodes, isLoading: nodesLoading } = useQuery({
    queryKey: ['machine-nodes', machineId],
    queryFn: () => fetchMachineNodes(machineId!),
    enabled: open && machineId != null,
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['machine-history', machineId],
    queryFn: () => fetchMachineHistory(machineId!, { limit: 30 }),
    enabled: open && machineId != null,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>{machine?.name} · 节点与负载</SheetTitle>
          <SheetDescription>
            该机器下的关联节点列表与最近负载历史。
          </SheetDescription>
        </SheetHeader>

        <div className='flex flex-col gap-6 px-4 pb-6'>
          <section>
            <h3 className='mb-2 text-sm font-semibold'>关联节点</h3>
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>地址</TableHead>
                    <TableHead className='w-16'>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodesLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className='h-16 text-center'>
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : nodes && nodes.length > 0 ? (
                    nodes.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className='font-medium'>{n.name}</TableCell>
                        <TableCell>
                          <Badge variant='secondary'>{n.type}</Badge>
                        </TableCell>
                        <TableCell className='font-mono text-xs'>
                          {n.host}
                          {n.port ? `:${n.port}` : ''}
                        </TableCell>
                        <TableCell>
                          {n.enabled ? (
                            <Badge>启用</Badge>
                          ) : (
                            <Badge variant='secondary'>停用</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className='h-16 text-center text-muted-foreground'
                      >
                        暂无节点
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section>
            <h3 className='mb-2 text-sm font-semibold'>负载历史（最近 30 条）</h3>
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>内存</TableHead>
                    <TableHead>磁盘</TableHead>
                    <TableHead>网络 ↓/↑</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className='h-16 text-center'>
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : history && history.length > 0 ? (
                    history.map((h, i) => (
                      <TableRow key={`${h.recorded_at}-${i}`}>
                        <TableCell className='whitespace-nowrap text-xs'>
                          {fmtTime(h.recorded_at)}
                        </TableCell>
                        <TableCell className='text-xs'>
                          {Math.round(h.cpu)}%
                        </TableCell>
                        <TableCell className='text-xs'>
                          {fmtBytes(h.mem_used)} / {fmtBytes(h.mem_total)}
                        </TableCell>
                        <TableCell className='text-xs'>
                          {fmtBytes(h.disk_used)} / {fmtBytes(h.disk_total)}
                        </TableCell>
                        <TableCell className='whitespace-nowrap text-xs'>
                          {fmtBytes(h.net_in_speed)}/s ·{' '}
                          {fmtBytes(h.net_out_speed)}/s
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='h-16 text-center text-muted-foreground'
                      >
                        暂无负载数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
