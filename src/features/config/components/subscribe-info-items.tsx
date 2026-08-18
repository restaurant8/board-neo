import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export type SubscribeInfoOption = { value: string; label: string }

/**
 * 订阅信息展示项：勾选决定是否下发，箭头决定在订阅里的先后顺序。
 * 值数组本身就是顺序；未勾选的项沉到列表末尾，重新勾选时追加到已选末位。
 */
export function SubscribeInfoItems({
  options,
  selected,
  onChange,
}: {
  options: readonly SubscribeInfoOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const known = options.map((o) => o.value)
  const picked = selected.filter((x) => known.includes(x))
  const rest = known.filter((x) => !picked.includes(x))
  const labelOf = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v

  const toggle = (v: string) =>
    picked.includes(v)
      ? onChange(picked.filter((x) => x !== v))
      : onChange([...picked, v])

  const move = (index: number, direction: -1 | 1) => {
    const next = [...picked]
    const target = index + direction
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const row = (v: string, index: number, checked: boolean) => (
    <div
      key={v}
      className='hover:bg-muted flex items-center gap-2 rounded-sm px-2 py-1'
    >
      <Checkbox
        id={`subscribe-info-${v}`}
        checked={checked}
        onCheckedChange={() => toggle(v)}
        aria-label={`${checked ? '不展示' : '展示'}${labelOf(v)}`}
      />
      <label
        htmlFor={`subscribe-info-${v}`}
        className={`min-w-0 flex-1 cursor-pointer truncate text-sm ${checked ? '' : 'text-muted-foreground'}`}
      >
        {labelOf(v)}
      </label>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7'
        disabled={!checked || index === 0}
        onClick={() => move(index, -1)}
        aria-label={`上移${labelOf(v)}`}
      >
        <ArrowUp className='size-3.5' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7'
        disabled={!checked || index === picked.length - 1}
        onClick={() => move(index, 1)}
        aria-label={`下移${labelOf(v)}`}
      >
        <ArrowDown className='size-3.5' />
      </Button>
    </div>
  )

  return (
    <div className='rounded-md border p-1.5'>
      {picked.map((v, index) => row(v, index, true))}
      {rest.map((v) => row(v, -1, false))}
    </div>
  )
}
