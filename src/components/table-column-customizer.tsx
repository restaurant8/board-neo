import { ArrowDown, ArrowUp, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { type TableColumnOption } from '@/hooks/use-table-column-preferences'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type TableColumnCustomizerProps<T extends string> = {
  columns: readonly TableColumnOption<T>[]
  orderedColumns: T[]
  hiddenSet: Set<T>
  onToggle: (id: T) => void
  onMove: (id: T, direction: -1 | 1) => void
  onReset: () => void
}

export function TableColumnCustomizer<T extends string>({
  columns,
  orderedColumns,
  hiddenSet,
  onToggle,
  onMove,
  onReset,
}: TableColumnCustomizerProps<T>) {
  const byId = new Map(columns.map((column) => [column.id, column]))
  const visibleCount = orderedColumns.length - hiddenSet.size

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='h-8'>
          <SlidersHorizontal className='size-4' />
          列设置
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-64 p-0'>
        <div className='border-b px-3 py-2.5'>
          <p className='text-sm font-medium'>自定义显示列</p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            勾选显示，使用箭头调整顺序
          </p>
        </div>
        <div className='max-h-80 overflow-y-auto p-1.5'>
          {orderedColumns.map((id, index) => {
            const column = byId.get(id)
            if (!column) return null
            const visible = !hiddenSet.has(id)
            return (
              <div
                key={id}
                className='flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-muted'
              >
                <Checkbox
                  id={`column-${id}`}
                  checked={visible}
                  disabled={visible && visibleCount === 1}
                  onCheckedChange={() => onToggle(id)}
                  aria-label={`${visible ? '隐藏' : '显示'}${column.label}列`}
                />
                <label
                  htmlFor={`column-${id}`}
                  className='min-w-0 flex-1 cursor-pointer truncate text-sm'
                >
                  {column.label}
                </label>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7'
                  disabled={index === 0}
                  onClick={() => onMove(id, -1)}
                  aria-label={`上移${column.label}列`}
                >
                  <ArrowUp className='size-3.5' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7'
                  disabled={index === orderedColumns.length - 1}
                  onClick={() => onMove(id, 1)}
                  aria-label={`下移${column.label}列`}
                >
                  <ArrowDown className='size-3.5' />
                </Button>
              </div>
            )
          })}
        </div>
        <div className='border-t p-1.5'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='w-full justify-start'
            onClick={onReset}
          >
            <RotateCcw className='size-4' />
            恢复默认列
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
