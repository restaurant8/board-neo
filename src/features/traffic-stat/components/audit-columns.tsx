import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { type UserAuditRow, type UserAuditSummaryRow } from '../api'
import { trafficColumns } from './traffic-columns'

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

/** 单个用户的流量明细列（从按用户汇总下钻，用户已知故不再单列）。 */
export function getAuditColumns(): ColumnDef<UserAuditRow>[] {
  return [
    {
      accessorKey: 'server_name',
      header: () => <div>节点</div>,
      cell: ({ row }) => (
        <div className='whitespace-nowrap'>
          {row.original.server_name || `#${row.original.server_id}`}
        </div>
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
    ...trafficColumns<UserAuditRow>(),
  ]
}

/** 用户审计「按用户汇总」列：每个用户一行总流量，点击行下钻到该用户明细。 */
export function getAuditUserColumns(): ColumnDef<UserAuditSummaryRow>[] {
  return [
    {
      id: 'rank',
      header: () => <div className='w-8'>#</div>,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination
        return (
          <div className='text-muted-foreground w-8 tabular-nums'>
            {pageIndex * pageSize + row.index + 1}
          </div>
        )
      },
    },
    {
      accessorKey: 'user_email',
      header: () => <div>用户</div>,
      cell: ({ row }) => (
        <div className='grid'>
          <span className='text-primary font-medium group-hover/row:underline'>
            {row.original.user_email || `User ${row.original.user_id}`}
          </span>
          <span className='text-muted-foreground text-xs'>
            UID:{row.original.user_id}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'server_count',
      header: () => <div className='text-end'>节点数</div>,
      cell: ({ row }) => (
        <div className='text-end tabular-nums'>{row.original.server_count}</div>
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
    ...trafficColumns<UserAuditSummaryRow>(),
  ]
}
