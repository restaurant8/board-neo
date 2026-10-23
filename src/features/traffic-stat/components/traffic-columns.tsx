import { type ColumnDef, type SortingState } from '@tanstack/react-table'
import { formatBytes } from '@/features/dashboard/format'
import { SortHeader } from './paged-table'

/** 上行/下行/合计三列，表头可点击服务端排序；各表共用。 */
export function trafficColumns<
  T extends { u: number; d: number; total: number },
>(): ColumnDef<T>[] {
  return (
    [
      ['u', '上行'],
      ['d', '下行'],
      ['total', '合计'],
    ] as const
  ).map(([key, title]) => ({
    id: key,
    accessorFn: (row: T) => row[key],
    enableSorting: true,
    header: ({ column }) => <SortHeader column={column} title={title} />,
    cell: ({ row }) => (
      <div className={key === 'total' ? 'text-end font-medium' : 'text-end'}>
        {formatBytes(row.original[key])}
      </div>
    ),
    meta: { className: 'text-end' },
  }))
}

/** 表格排序状态 → 接口 order_by/order_dir；无排序时按合计降序。 */
export function toOrder(sorting: SortingState): {
  order_by: 'total' | 'u' | 'd'
  order_dir: 'asc' | 'desc'
} {
  const s = sorting[0]
  const id = s?.id
  return {
    order_by: id === 'u' || id === 'd' ? id : 'total',
    order_dir: s && !s.desc ? 'asc' : 'desc',
  }
}
