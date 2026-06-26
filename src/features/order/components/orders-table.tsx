import { useMemo, useState } from 'react'
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  PlusCircledIcon,
} from '@radix-ui/react-icons'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type NavigateFn } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PERIOD_LEGACY_TO_INTERNAL, type Order, fetchOrders } from '../api'
import {
  commissionStatusOptions,
  periodOptions,
  statusOptions,
  typeOptions,
} from '../data'
import {
  type OrderColumnHandlers,
  getOrdersColumns,
} from './orders-columns'

type FacetOption = { value: string; label: string }

/** 官方同款 border-dashed 胶囊式多选筛选。 */
function FacetFilter({
  title,
  options,
  selected,
  onChange,
}: {
  title: string
  options: FacetOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const selectedSet = new Set(selected)
  const toggle = (value: string) => {
    const next = new Set(selectedSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(Array.from(next))
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='h-8 border-dashed'>
          <PlusCircledIcon className='size-4' />
          {title}
          {selectedSet.size > 0 && (
            <>
              <Separator orientation='vertical' className='mx-2 h-4' />
              <Badge
                variant='secondary'
                className='rounded-sm px-1 font-normal lg:hidden'
              >
                {selectedSet.size}
              </Badge>
              <div className='hidden space-x-1 lg:flex'>
                {selectedSet.size > 2 ? (
                  <Badge
                    variant='secondary'
                    className='rounded-sm px-1 font-normal'
                  >
                    已选 {selectedSet.size}
                  </Badge>
                ) : (
                  options
                    .filter((o) => selectedSet.has(o.value))
                    .map((o) => (
                      <Badge
                        variant='secondary'
                        key={o.value}
                        className='rounded-sm px-1 font-normal'
                      >
                        {o.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-52 p-0' align='start'>
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>无结果</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => toggle(option.value)}
                  >
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className='text-background size-4' />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedSet.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className='justify-center text-center'
                  >
                    清除筛选
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** URL search 中订单页关心的字段。 */
export type OrderSearch = {
  page?: number
  pageSize?: number
  trade_no?: string
  type?: string[]
  period?: string[]
  status?: string[]
  commission_status?: string[]
  /** "字段.desc" / "字段.asc"，如 "status.desc"。 */
  sort?: string
}

type Props = {
  search: OrderSearch
  navigate: NavigateFn
  handlers: OrderColumnHandlers
  onAdd: () => void
}

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

export function OrdersTable({ search, navigate, handlers, onAdd }: Props) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const page = search.page ?? DEFAULT_PAGE
  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE
  const tradeNo = search.trade_no ?? ''
  const typeSel = search.type ?? []
  const periodSel = search.period ?? []
  const statusSel = search.status ?? []
  const commissionSel = search.commission_status ?? []

  // 受控搜索框（输入态），回车 / 提交后才写入 URL 触发请求
  const [searchInput, setSearchInput] = useState(tradeNo)

  // 排序：URL "字段.desc" → react-table SortingState
  const sorting: SortingState = useMemo(() => {
    if (!search.sort) return []
    const [id, dir] = search.sort.split('.')
    if (!id) return []
    return [{ id, desc: dir === 'desc' }]
  }, [search.sort])

  // 列筛选状态（仅用于把已选值传给 react-table，便于将来扩展；筛选 UI 在工具条独立渲染）
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const cf: ColumnFiltersState = []
    if (typeSel.length) cf.push({ id: 'type', value: typeSel })
    if (periodSel.length) cf.push({ id: 'period', value: periodSel })
    if (statusSel.length) cf.push({ id: 'status', value: statusSel })
    if (commissionSel.length)
      cf.push({ id: 'commission_status', value: commissionSel })
    return cf
  }, [typeSel, periodSel, statusSel, commissionSel])

  /* ----------------------------- URL 写入辅助 ----------------------------- */

  const patchSearch = (patch: Partial<OrderSearch>) => {
    navigate({
      search: (prev) => ({ ...(prev as OrderSearch), ...patch }),
    })
  }

  const setFilter = (
    key: 'type' | 'period' | 'status' | 'commission_status',
    values: string[]
  ) => {
    patchSearch({
      page: undefined,
      [key]: values.length ? values : undefined,
    })
  }

  const submitSearch = () => {
    const kw = searchInput.trim()
    patchSearch({ page: undefined, trade_no: kw || undefined })
  }

  const hasFilter =
    tradeNo !== '' ||
    typeSel.length > 0 ||
    periodSel.length > 0 ||
    statusSel.length > 0 ||
    commissionSel.length > 0

  const resetFilters = () => {
    setSearchInput('')
    navigate({
      search: (prev) => {
        const next = { ...(prev as OrderSearch) }
        delete next.trade_no
        delete next.type
        delete next.period
        delete next.status
        delete next.commission_status
        delete next.page
        return next
      },
    })
  }

  /* ----------------------------- 后端入参 ----------------------------- */

  const filter = useMemo(() => {
    const f: Array<{ id: string; value: unknown }> = []
    if (tradeNo) f.push({ id: 'trade_no', value: tradeNo })
    if (typeSel.length) f.push({ id: 'type', value: typeSel.map(Number) })
    if (periodSel.length)
      f.push({
        id: 'period',
        value: periodSel.map((p) => PERIOD_LEGACY_TO_INTERNAL[p] ?? p),
      })
    if (statusSel.length) f.push({ id: 'status', value: statusSel.map(Number) })
    if (commissionSel.length)
      f.push({ id: 'commission_status', value: commissionSel.map(Number) })
    return f.length ? f : undefined
  }, [tradeNo, typeSel, periodSel, statusSel, commissionSel])

  const sort = useMemo(
    () => (sorting.length ? sorting.map((s) => ({ id: s.id, desc: s.desc })) : undefined),
    [sorting]
  )

  const { data, isLoading } = useQuery({
    queryKey: [
      'orders',
      page,
      pageSize,
      tradeNo,
      typeSel,
      periodSel,
      statusSel,
      commissionSel,
      search.sort,
    ],
    queryFn: () =>
      fetchOrders({ current: page, pageSize, filter, sort }),
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const lastPage = data?.last_page ?? 1

  /* ----------------------------- react-table ----------------------------- */

  const columns = useMemo(() => getOrdersColumns(handlers), [handlers])

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: { pageIndex: page - 1, pageSize },
    },
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    rowCount: total,
    pageCount: lastPage,
    enableRowSelection: true,
    getRowId: (row: Order) => String(row.id),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(sorting) : updater
      const first = next[0]
      patchSearch({
        page: undefined,
        sort: first ? `${first.id}.${first.desc ? 'desc' : 'asc'}` : undefined,
      })
    },
    onPaginationChange: (updater) => {
      const prev = { pageIndex: page - 1, pageSize }
      const next = typeof updater === 'function' ? updater(prev) : updater
      patchSearch({
        page: next.pageIndex + 1 <= DEFAULT_PAGE ? undefined : next.pageIndex + 1,
        pageSize:
          next.pageSize === DEFAULT_PAGE_SIZE ? undefined : next.pageSize,
      })
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedCount = table.getSelectedRowModel().rows.length
  const currentPage = page
  const totalPages = Math.max(1, lastPage)

  return (
    <div className='flex flex-1 flex-col gap-4'>
      {/* ----------------------------- 工具条 ----------------------------- */}
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' onClick={onAdd}>
          <Plus className='size-4' /> 添加订单
        </Button>
        <Input
          placeholder='搜索订单...'
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitSearch()
            }
          }}
          onBlur={submitSearch}
          className='h-8 w-40 lg:w-64'
        />
        <FacetFilter
          title='类型'
          options={typeOptions}
          selected={typeSel}
          onChange={(v) => setFilter('type', v)}
        />
        <FacetFilter
          title='周期'
          options={periodOptions}
          selected={periodSel}
          onChange={(v) => setFilter('period', v)}
        />
        <FacetFilter
          title='订单状态'
          options={statusOptions}
          selected={statusSel}
          onChange={(v) => setFilter('status', v)}
        />
        <FacetFilter
          title='佣金状态'
          options={commissionStatusOptions}
          selected={commissionSel}
          onChange={(v) => setFilter('commission_status', v)}
        />
        {hasFilter && (
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 lg:px-3'
            onClick={resetFilters}
          >
            重置
            <Cross2Icon className='ms-2 size-4' />
          </Button>
        )}
      </div>

      {/* ----------------------------- 表格 ----------------------------- */}
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName
                    )}
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
            ) : rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
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
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  暂无订单
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ----------------------------- 分页 ----------------------------- */}
      <div className='flex flex-col-reverse items-center justify-between gap-4 px-2 sm:flex-row'>
        <div className='text-muted-foreground text-sm'>
          已选择 {selectedCount} 项，共 {total} 项
        </div>
        <div className='flex items-center gap-4 sm:gap-6 lg:gap-8'>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium'>每页显示</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                const nextSize = Number(value)
                patchSearch({
                  page: undefined,
                  pageSize:
                    nextSize === DEFAULT_PAGE_SIZE ? undefined : nextSize,
                })
              }}
            >
              <SelectTrigger className='h-8 w-17.5'>
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side='top'>
                {[10, 20, 30, 50].map((s) => (
                  <SelectItem key={s} value={`${s}`}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex w-28 items-center justify-center text-sm font-medium'>
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              className='hidden size-8 p-0 lg:flex'
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>首页</span>
              <DoubleArrowLeftIcon className='size-4' />
            </Button>
            <Button
              variant='outline'
              className='size-8 p-0'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>上一页</span>
              <ChevronLeftIcon className='size-4' />
            </Button>
            <Button
              variant='outline'
              className='size-8 p-0'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>下一页</span>
              <ChevronRightIcon className='size-4' />
            </Button>
            <Button
              variant='outline'
              className='hidden size-8 p-0 lg:flex'
              onClick={() => table.setPageIndex(totalPages - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>末页</span>
              <DoubleArrowRightIcon className='size-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
