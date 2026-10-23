import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { type DiagRow } from '../api'
import { trafficColumns } from './traffic-columns'

/**
 * 节点流量明细列。是否展示「主域名」列由调用方按 mode 控制（diagnostic 模式才有）。
 */
export function getDiagnosticsColumns(opts: {
  showDomain: boolean
}): ColumnDef<DiagRow>[] {
  const columns: ColumnDef<DiagRow>[] = [
    {
      accessorKey: 'server_name',
      header: () => <div>节点</div>,
      cell: ({ row }) => (
        <div className='font-medium whitespace-nowrap'>
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
  ]

  if (opts.showDomain) {
    columns.push({
      accessorKey: 'main_domain',
      header: () => <div>主域名</div>,
      cell: ({ row }) => (
        <div className='text-muted-foreground'>
          {row.original.main_domain || '—'}
        </div>
      ),
    })
  }

  columns.push(...trafficColumns<DiagRow>())

  return columns
}
