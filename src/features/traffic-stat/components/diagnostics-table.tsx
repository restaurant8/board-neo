import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { type DiagResult, fetchTrafficDiagnostics } from '../api'
import { getDiagnosticsColumns } from './diagnostics-columns'
import { PagedTable } from './paged-table'
import { toOrder } from './traffic-columns'

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
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'total', desc: true },
  ])
  const order = toOrder(sorting)

  // 过滤/排序条件变化时回到第一页
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [range.start, range.end, mode, keyword, order.order_by, order.order_dir])

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: [
      'traffic-diag',
      range.start,
      range.end,
      mode,
      keyword,
      order,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: () =>
      fetchTrafficDiagnostics({
        start_time: range.start,
        end_time: range.end,
        mode,
        server_keyword: keyword || undefined,
        ...order,
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }),
    // 翻页/排序时保留上一页数据，避免整表闪成「加载中」
    placeholderData: keepPreviousData,
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
    state: { pagination, sorting },
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    pageCount,
    rowCount: total,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <PagedTable
      table={table}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorText='暂无数据（需在「系统配置 → 服务器」开启流量统计模式，或该后端未启用此功能）。'
    />
  )
}
