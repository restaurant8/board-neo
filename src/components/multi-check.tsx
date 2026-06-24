import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

export type MultiOption = { value: string; label: string }

/**
 * Compact multi-select rendered as a scrollable checkbox grid — beginner
 * friendly (everything visible, no hidden menus). Values are strings; callers
 * map to/from numbers as needed.
 */
export function MultiCheck({
  options,
  selected,
  onChange,
  empty = '暂无可选项',
}: {
  options: MultiOption[]
  selected: string[]
  onChange: (next: string[]) => void
  empty?: string
}) {
  const toggle = (v: string) =>
    selected.includes(v)
      ? onChange(selected.filter((x) => x !== v))
      : onChange([...selected, v])

  if (options.length === 0) {
    return (
      <div className='text-muted-foreground rounded-md border p-3 text-sm'>
        {empty}
      </div>
    )
  }

  return (
    <ScrollArea className='max-h-44 rounded-md border p-2'>
      <div className='grid grid-cols-2 gap-2'>
        {options.map((o) => (
          <label
            key={o.value}
            className='hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm'
          >
            <Checkbox
              checked={selected.includes(o.value)}
              onCheckedChange={() => toggle(o.value)}
            />
            <span className='truncate'>{o.label}</span>
          </label>
        ))}
      </div>
    </ScrollArea>
  )
}
