import { useEffect, useState } from 'react'
import { MultiCheck } from '@/components/multi-check'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Mode = 'replace' | 'add' | 'remove'

type GroupOption = { label: string; value: string }

const MODES: { value: Mode; label: string; desc: string }[] = [
  { value: 'add', label: '追加', desc: '在节点原有权限组基础上增加所选权限组' },
  { value: 'remove', label: '移除', desc: '从节点移除所选权限组，其余保持不变' },
  { value: 'replace', label: '覆盖', desc: '用所选权限组替换节点原有的全部权限组' },
]

export function BatchGroupsDialog({
  open,
  onOpenChange,
  count,
  options,
  isLoading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  count: number
  options: GroupOption[]
  isLoading: boolean
  onConfirm: (payload: { mode: Mode; group_ids: number[] }) => void
}) {
  const [mode, setMode] = useState<Mode>('add')
  const [selected, setSelected] = useState<string[]>([])

  // 每次打开重置表单
  useEffect(() => {
    if (open) {
      setMode('add')
      setSelected([])
    }
  }, [open])

  const activeMode = MODES.find((m) => m.value === mode)!
  // 覆盖模式允许清空（即移除全部权限组）；追加/移除必须选至少一个。
  const canSubmit = mode === 'replace' || selected.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>批量调整权限组</DialogTitle>
          <DialogDescription>
            对选中的 {count} 个节点调整权限组绑定。
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='grid grid-cols-3 gap-2'>
            {MODES.map((m) => (
              <button
                key={m.value}
                type='button'
                onClick={() => setMode(m.value)}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  mode === m.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className='text-muted-foreground text-xs'>{activeMode.desc}</p>

          <div>
            <MultiCheck
              options={options}
              selected={selected}
              onChange={setSelected}
              empty='暂无权限组'
            />
            {mode === 'replace' && selected.length === 0 && (
              <p className='text-muted-foreground mt-2 text-xs'>
                未选择任何权限组，将清空这些节点的权限组。
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!canSubmit || isLoading}
            onClick={() =>
              onConfirm({ mode, group_ids: selected.map(Number) })
            }
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
