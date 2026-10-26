import { type ReactNode } from 'react'
import {
  type Column,
  type Table as TanstackTable,
  flexRender,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
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

/** 可排序表头：点击在 降序/升序 间切换（服务端排序，无「不排序」态）。 */
export function SortHeader<T>({
  column,
  title,
}: {
  column: Column<T, unknown>
  title: string
}) {
  const sorted = column.getIsSorted()
  const Icon =
    sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <button
      type='button'
      className={cn(
        'ms-auto flex items-center gap-1 hover:text-foreground',
        sorted && 'text-foreground'
      )}
      // 当前降序 → 升序，否则（升序/未排序）→ 降序
      onClick={() => column.toggleSorting(sorted !== 'desc')}
    >
      {title}
      <Icon className={cn('size-3.5', !sorted && 'opacity-50')} />
    </button>
  )
}

type Props<T> = {
  table: TanstackTable<T>
  isLoading: boolean
  /** 有旧数据时后台刷新中：表格半透明而不是整表替换为「加载中」 */
  isFetching: boolean
  isError: boolean
  errorText: ReactNode
  /** 行可点击（如下钻到明细） */
  onRowClick?: (row: T) => void
}

/** 流量统计各表共用的表格 + 分页外壳。 */
export function PagedTable<T>({
  table,
  isLoading,
  isFetching,
  isError,
  errorText,
  onRowClick,
}: Props<T>) {
  const colSpan = table.getAllLeafColumns().length
  const rows = table.getRowModel().rows

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div
        className={cn(
          'overflow-hidden rounded-md border transition-opacity',
          isFetching && !isLoading && 'opacity-60'
        )}
      >
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
                <TableCell colSpan={colSpan} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className='h-24 text-center text-muted-foreground'
                >
                  {errorText}
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn('group/row', onRowClick && 'cursor-pointer')}
                  onClick={onRowClick && (() => onRowClick(row.original))}
                >
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
                  colSpan={colSpan}
                  className='h-24 text-center text-muted-foreground'
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
