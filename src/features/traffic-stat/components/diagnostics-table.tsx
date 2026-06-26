import { useEffect, useMemo, useState } from 'react'
import {
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table'
import { type DiagResult, fetchTrafficDiagnostics } from '../api'
import { getDiagnosticsColumns } from './diagnostics-columns'

type Props = {
  range: { start: number; end: number }
  mode: 'all' | 'privacy' | 'diagnostic'
  keyword: string
  onSummary: (summary: DiagResult['summary']) => void
}

export function DiagnosticsTable({ range, mode, keyword, onSummary }: Props) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // 过滤条件变化时回到第一页
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [range.start, range.end, mode, keyword])

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'traffic-diag',
      range.start,
      range.end,
      mode,
      keyword,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: () =>
      fetchTrafficDiagnostics({
        start_time: range.start,
        end_time: range.end,
        mode,
        server_keyword: keyword || undefined,
        order_by: 'total',
        order_dir: 'desc',
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }),
  })

  useEffect(() => {
    if (data?.summary) onSummary(data.summary)
  }, [data, onSummary])

  const columns = useMemo(
    () => getDiagnosticsColumns({ showDomain: mode === 'diagnostic' }),
    [mode]
  )

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize))

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination },
    manualPagination: true,
    pageCount,
    rowCount: total,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(header.column.columnDef.meta?.className)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='text-muted-foreground h-24 text-center'
                >
                  暂无数据（需在「系统配置 →
                  服务器」开启流量统计模式，或该后端未启用此功能）。
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className='group/row'>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.columnDef.meta?.className)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='text-muted-foreground h-24 text-center'
                >
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
