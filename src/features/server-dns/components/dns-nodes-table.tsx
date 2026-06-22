import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type DnsNode,
  type DnsZone,
  saveDnsNode,
} from '../api'

const ZONE_DEFAULT = '__default__'

function fmtTime(ts: number | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function StatusCell({ node }: { node: DnsNode }) {
  if (!node.last_status)
    return <span className='text-muted-foreground'>未同步</span>
  switch (node.last_status) {
    case 'success':
      return (
        <span className='text-emerald-600'>已解析 {node.last_ip || ''}</span>
      )
    case 'waiting':
      return <span className='text-amber-600'>等待节点上报 IP</span>
    case 'skipped':
      return (
        <span className='text-muted-foreground'>
          无变化 {node.last_ip || ''}
        </span>
      )
    case 'failed':
      return (
        <span className='text-destructive' title={node.last_error || ''}>
          失败
        </span>
      )
    default:
      return <span>{node.last_status}</span>
  }
}

type RowState = { enabled: boolean; zone: string }

type Props = {
  nodes: DnsNode[] | undefined
  isLoading: boolean
  zones: DnsZone[]
}

export function DnsNodesTable({ nodes, isLoading, zones }: Props) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<Record<number, RowState>>({})

  useEffect(() => {
    if (nodes) {
      const next: Record<number, RowState> = {}
      for (const n of nodes) {
        next[n.id] = {
          enabled: n.dns_auto_sync,
          zone: n.zone_id || ZONE_DEFAULT,
        }
      }
      setRows(next)
    }
  }, [nodes])

  const mutation = useMutation({
    mutationFn: (payload: {
      id: number
      dns_auto_sync: boolean
      zone_id: string
    }) => saveDnsNode(payload),
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['dns-nodes'] })
    },
    onError: handleServerError,
  })

  function setRow(id: number, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          节点 DNS 同步（{nodes?.length ?? 0} 个域名节点）
        </CardTitle>
        <CardDescription>
          开启后，该节点的域名会自动解析到节点上报的公网 IP，IP
          变化时自动更新。仅域名节点（host 非纯 IP）会列出。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>节点</TableHead>
                <TableHead>域名</TableHead>
                <TableHead className='w-20'>同步</TableHead>
                <TableHead className='w-48'>Zone</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className='text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : nodes && nodes.length > 0 ? (
                nodes.map((n) => {
                  const row = rows[n.id] ?? {
                    enabled: n.dns_auto_sync,
                    zone: n.zone_id || ZONE_DEFAULT,
                  }
                  const saving =
                    mutation.isPending && mutation.variables?.id === n.id
                  return (
                    <TableRow key={n.id}>
                      <TableCell className='font-medium'>{n.name}</TableCell>
                      <TableCell className='font-mono text-xs'>
                        {n.host}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.enabled}
                          onCheckedChange={(v) =>
                            setRow(n.id, { enabled: v })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.zone}
                          onValueChange={(v) => setRow(n.id, { zone: v })}
                        >
                          <SelectTrigger className='h-8'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ZONE_DEFAULT}>
                              默认/自动
                            </SelectItem>
                            {zones.map((z) => (
                              <SelectItem key={z.zone_id} value={z.zone_id}>
                                {z.remark
                                  ? `${z.remark} (${z.zone_id})`
                                  : z.zone_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className='text-sm'>
                        <StatusCell node={n} />
                        <div className='text-[11px] text-muted-foreground'>
                          {fmtTime(n.last_at)}
                        </div>
                      </TableCell>
                      <TableCell className='text-end'>
                        <Button
                          variant='outline'
                          size='sm'
                          disabled={saving}
                          onClick={() =>
                            mutation.mutate({
                              id: n.id,
                              dns_auto_sync: row.enabled,
                              zone_id:
                                row.zone === ZONE_DEFAULT ? '' : row.zone,
                            })
                          }
                        >
                          {saving ? '保存中…' : '保存'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='h-24 text-center text-muted-foreground'
                  >
                    没有域名节点。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
