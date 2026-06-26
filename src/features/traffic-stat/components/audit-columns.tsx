import { type ColumnDef } from '@tanstack/react-table'
import { formatBytes } from '@/features/dashboard/format'
import { Badge } from '@/components/ui/badge'
import { type UserAuditRow } from '../api'

/** 秒级时间戳 → 本地时间字符串。 */
function fmtTime(ts?: number | null): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

/** 目的地展示：优先用 destination（域名），回落到 destination_ip(:port)。 */
function destinationText(row: UserAuditRow): string {
  if (row.destination) return row.destination
  if (row.destination_ip) {
    return row.destination_port
      ? `${row.destination_ip}:${row.destination_port}`
      : row.destination_ip
  }
  return '—'
}

/** 用户流量审计列（用户维度明细）。 */
export function getAuditColumns(): ColumnDef<UserAuditRow>[] {
  return [
    {
      accessorKey: 'user_email',
      header: () => <div>用户</div>,
      cell: ({ row }) => (
        <div className='grid'>
          <span className='font-medium'>
            {row.original.user_email || `User ${row.original.user_id}`}
          </span>
          <span className='text-muted-foreground text-xs'>
            UID:{row.original.user_id}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'server_name',
      header: () => <div>节点</div>,
      cell: ({ row }) => (
        <div>{row.original.server_name || `#${row.original.server_id}`}</div>
      ),
    },
    {
      accessorKey: 'source_ip',
      header: () => <div>源 IP</div>,
      cell: ({ row }) => (
        <div className='font-mono text-xs'>{row.original.source_ip || '—'}</div>
      ),
    },
    {
      accessorKey: 'category',
      header: () => <div>类别</div>,
      cell: ({ row }) => (
        <Badge variant='outline'>{row.original.category || '其它'}</Badge>
      ),
    },
    {
      id: 'destination',
      header: () => <div>目的地</div>,
      cell: ({ row }) => (
        <div className='max-w-48 truncate' title={destinationText(row.original)}>
          {destinationText(row.original)}
        </div>
      ),
    },
    {
      accessorKey: 'network',
      header: () => <div>网络</div>,
      cell: ({ row }) => (
        <div className='text-muted-foreground text-xs'>
          {row.original.network || '—'}
        </div>
      ),
    },
    {
      accessorKey: 'report_count',
      header: () => <div className='text-end'>上报数</div>,
      cell: ({ row }) => (
        <div className='text-end'>{row.original.report_count}</div>
      ),
      meta: { className: 'text-end' },
    },
    {
      accessorKey: 'last_record_at',
      header: () => <div>最近记录</div>,
      cell: ({ row }) => (
        <div className='text-muted-foreground text-xs'>
          {fmtTime(row.original.last_record_at)}
        </div>
      ),
    },
    {
      accessorKey: 'u',
      header: () => <div className='text-end'>上行</div>,
      cell: ({ row }) => (
        <div className='text-end'>{formatBytes(row.original.u)}</div>
      ),
      meta: { className: 'text-end' },
    },
    {
      accessorKey: 'd',
      header: () => <div className='text-end'>下行</div>,
      cell: ({ row }) => (
        <div className='text-end'>{formatBytes(row.original.d)}</div>
      ),
      meta: { className: 'text-end' },
    },
    {
      accessorKey: 'total',
      header: () => <div className='text-end'>合计</div>,
      cell: ({ row }) => (
        <div className='text-end font-medium'>
          {formatBytes(row.original.total)}
        </div>
      ),
      meta: { className: 'text-end' },
    },
  ]
}
