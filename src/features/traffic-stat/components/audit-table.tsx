import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  type UserAuditParams,
  type UserAuditResult,
  fetchUserTrafficAudit,
  fetchUserTrafficAuditByUser,
} from '../api'
import { getAuditColumns, getAuditUserColumns } from './audit-columns'
import { PagedTable } from './paged-table'
import { toOrder } from './traffic-columns'

type Summary = UserAuditResult['summary']

type Props = {
  range: { start: number; end: number }
  mode: 'all' | 'privacy' | 'diagnostic'
  userKeyword: string
  serverKeyword: string
  onSummary: (summary: Summary) => void
}

const ERROR_TEXT =
  '暂无数据（用户流量审计需在「系统配置 → 服务器」开启授权诊断模式，或该后端未启用此功能）。'

/**
 * 用户审计：默认「按用户汇总」每个用户一行总流量；可切到「明细」看
 * 用户×节点×源IP×目的地粒度。两种视图均按 上行/下行/合计 服务端排序。
 */
export function AuditTable(props: Props) {
  const [view, setView] = useState<'user' | 'detail'>('user')

  return (
    <div className='flex flex-1 flex-col gap-3'>
      <div className='flex gap-1'>
        <Button
          size='sm'
          variant={view === 'user' ? 'secondary' : 'ghost'}
          onClick={() => setView('user')}
        >
          按用户汇总
        </Button>
        <Button
          size='sm'
          variant={view === 'detail' ? 'secondary' : 'ghost'}
          onClick={() => setView('detail')}
        >
          明细
        </Button>
      </div>
      {view === 'user' ? (
        // key 区分视图：强制重挂载，避免 keepPreviousData 把另一视图的数据套到新列上
        <AuditView
          key='user'
          {...props}
          queryKey='traffic-audit-user'
          fetcher={fetchUserTrafficAuditByUser}
          columns={getAuditUserColumns}
        />
      ) : (
        <AuditView
          key='detail'
          {...props}
          queryKey='traffic-audit-detail'
          fetcher={fetchUserTrafficAudit}
          columns={getAuditColumns}
        />
      )}
    </div>
  )
}

function AuditView<T>({
  range,
  mode,
  userKeyword,
  serverKeyword,
  onSummary,
  queryKey,
  fetcher,
  columns: getColumns,
}: Props & {
  queryKey: string
  fetcher: (
    params: UserAuditParams
  ) => Promise<{ list: T[]; total: number; summary: Summary }>
  columns: () => ColumnDef<T>[]
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'total', desc: true },
  ])
  const order = toOrder(sorting)

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [
    range.start,
    range.end,
    mode,
    userKeyword,
    serverKeyword,
    order.order_by,
    order.order_dir,
  ])

  // fetcher 与 queryKey 字符串一一对应（由父组件按视图成对传入），无需单独进 key
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: [
      // 前缀统一为 traffic-audit，清理数据时一次失效两种视图
      'traffic-audit',
      queryKey,
      range.start,
      range.end,
      mode,
      userKeyword,
      serverKeyword,
      order,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: () =>
      fetcher({
        start_time: range.start,
        end_time: range.end,
        mode,
        user_keyword: userKeyword || undefined,
        server_keyword: serverKeyword || undefined,
        // 面板不使用下拉筛选项，跳过这部分最耗时的聚合
        with_filters: 0,
        ...order,
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (data?.summary) onSummary(data.summary)
  }, [data, onSummary])

  const columns = useMemo(() => getColumns(), [getColumns])

  const total = data?.total ?? 0
  const table = useReactTable({
    data: data?.list ?? [],
    columns,
    state: { pagination, sorting },
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
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
      errorText={ERROR_TEXT}
    />
  )
}
