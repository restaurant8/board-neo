import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { giBToBytes } from '../format'
import { type PlanBrief, type UserFilter } from '../api'

/** 字段值类型，决定可用操作符与值输入控件。 */
type FieldType =
  | 'text'
  | 'number'
  | 'bytes'
  | 'date'
  | 'banned'
  | 'plan'
  | 'remote'

type FieldDef = {
  /** 后端列名（filter.id）。 */
  column: string
  /** 中文标签。 */
  label: string
  type: FieldType
}

/**
 * 可筛选字段（务必与 UserController::applyFilters 实际支持列对齐）：
 * - 普通列走 where/operator；total_used 后端用 DB::raw('(u + d)') 支持。
 */
const FIELD_DEFS: FieldDef[] = [
  { column: 'email', label: '邮箱', type: 'text' },
  { column: 'id', label: '用户ID', type: 'number' },
  { column: 'plan_id', label: '订阅', type: 'plan' },
  { column: 'transfer_enable', label: '流量', type: 'bytes' },
  { column: 'total_used', label: '已用流量', type: 'bytes' },
  { column: 'online_count', label: '在线设备', type: 'number' },
  { column: 'expired_at', label: '到期时间', type: 'date' },
  { column: 'uuid', label: 'UUID', type: 'text' },
  { column: 'token', label: 'Token', type: 'text' },
  { column: 'banned', label: '账号状态', type: 'banned' },
  { column: 'remarks', label: '备注', type: 'text' },
  { column: 'subscribe_remote', label: '订阅异地', type: 'remote' },
  { column: 'connect_remote', label: '连接异地', type: 'remote' },
]

type OperatorDef = { op: string; label: string }

/** 各类型可用操作符（op 对齐 QueryOperators::getQueryOperator）。 */
const OPERATORS: Record<FieldType, OperatorDef[]> = {
  text: [
    { op: 'like', label: '包含' },
    { op: 'eq', label: '等于' },
  ],
  number: [
    { op: 'eq', label: '等于' },
    { op: 'gt', label: '大于' },
    { op: 'gte', label: '大于等于' },
    { op: 'lt', label: '小于' },
    { op: 'lte', label: '小于等于' },
  ],
  bytes: [
    { op: 'eq', label: '等于' },
    { op: 'gt', label: '大于' },
    { op: 'gte', label: '大于等于' },
    { op: 'lt', label: '小于' },
    { op: 'lte', label: '小于等于' },
  ],
  date: [
    { op: 'lt', label: '早于' },
    { op: 'gt', label: '晚于' },
  ],
  banned: [{ op: 'eq', label: '等于' }],
  plan: [{ op: 'eq', label: '等于' }],
  remote: [{ op: 'eq', label: '等于' }],
}

/** 一条筛选条件的本地编辑态。 */
export type FilterCondition = {
  /** 行内 key，仅用于 React 列表。 */
  key: string
  /** 选中的后端列；空串表示未选择字段。 */
  column: string
  /** 操作符。 */
  op: string
  /** 原始输入值（字节/日期类此处为人类可读输入，提交时换算）。 */
  value: string
}

let seq = 0
const newKey = () => `cond_${++seq}`

function fieldByColumn(column: string): FieldDef | undefined {
  return FIELD_DEFS.find((f) => f.column === column)
}

function emptyCondition(): FilterCondition {
  return { key: newKey(), column: '', op: '', value: '' }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 套餐下拉数据（订阅字段用）。 */
  plans?: PlanBrief[]
  /** 初始条件（用于回显已应用筛选）。 */
  initial: FilterCondition[]
  /** 应用：把条件转成后端 filter 数组并附带原始条件回传。 */
  onApply: (filter: UserFilter[], conditions: FilterCondition[]) => void
  /** 重置：清空所有条件并应用。 */
  onReset: () => void
}

/**
 * 把单条编辑态条件转成后端 filter 项：{ id: <列>, value: "<op>:<值>" }。
 * - bytes：输入按 GB 换算为字节
 * - date：输入 datetime-local 换算为 unix 秒
 * - banned：正常=0 / 封禁=1
 * 返回 null 表示该条不完整，跳过。
 */
function toFilterItem(cond: FilterCondition): UserFilter | null {
  const field = fieldByColumn(cond.column)
  if (!field || !cond.op) return null

  let raw = cond.value
  if (field.type === 'bytes') {
    if (raw.trim() === '') return null
    const gb = Number(raw)
    if (Number.isNaN(gb)) return null
    raw = String(giBToBytes(gb))
  } else if (field.type === 'date') {
    if (raw.trim() === '') return null
    const ms = new Date(raw).getTime()
    if (Number.isNaN(ms)) return null
    raw = String(Math.floor(ms / 1000))
  } else if (field.type === 'banned' || field.type === 'remote') {
    if (raw !== '0' && raw !== '1') return null
  } else if (field.type === 'plan') {
    if (raw.trim() === '') return null
  } else {
    // text / number
    if (raw.trim() === '') return null
  }

  return { id: field.column, value: `${cond.op}:${raw}` }
}

export function UserAdvancedFilter({
  open,
  onOpenChange,
  plans,
  initial,
  onApply,
  onReset,
}: Props) {
  const [conditions, setConditions] = useState<FilterCondition[]>([])

  // 每次打开时用已应用条件回显（无则给一条空白）
  useEffect(() => {
    if (open) {
      setConditions(initial.length > 0 ? initial.map((c) => ({ ...c })) : [emptyCondition()])
    }
  }, [open, initial])

  const addCondition = () =>
    setConditions((s) => [...s, emptyCondition()])

  const removeCondition = (key: string) =>
    setConditions((s) => s.filter((c) => c.key !== key))

  const patch = (key: string, p: Partial<FilterCondition>) =>
    setConditions((s) => s.map((c) => (c.key === key ? { ...c, ...p } : c)))

  // 选择字段：默认带上该类型第一个操作符，清空值
  const onPickField = (key: string, column: string) => {
    const field = fieldByColumn(column)
    const firstOp = field ? OPERATORS[field.type][0].op : ''
    patch(key, { column, op: firstOp, value: '' })
  }

  const handleApply = () => {
    const filter: UserFilter[] = []
    const valid: FilterCondition[] = []
    for (const cond of conditions) {
      const item = toFilterItem(cond)
      if (item) {
        filter.push(item)
        valid.push(cond)
      }
    }
    onApply(filter, valid)
    onOpenChange(false)
  }

  const handleReset = () => {
    setConditions([emptyCondition()])
    onReset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>高级筛选</SheetTitle>
          <SheetDescription>添加一个或多个筛选条件来精确查找用户</SheetDescription>
        </SheetHeader>

        <div className='flex items-center justify-between px-4 py-3'>
          <span className='text-sm font-medium'>筛选条件</span>
          <Button variant='outline' size='sm' onClick={addCondition}>
            <Plus className='size-4' /> 添加条件
          </Button>
        </div>

        <ScrollArea className='flex-1 px-4'>
          <div className='flex flex-col gap-3 pb-4'>
            {conditions.length === 0 ? (
              <p className='text-muted-foreground py-8 text-center text-sm'>
                暂无筛选条件，点击「添加条件」开始。
              </p>
            ) : (
              conditions.map((cond, idx) => {
                const field = fieldByColumn(cond.column)
                return (
                  <div
                    key={cond.key}
                    className='relative rounded-md border p-3'
                  >
                    <div className='mb-2 flex items-center justify-between'>
                      <span className='text-muted-foreground text-xs font-medium'>
                        条件 {idx + 1}
                      </span>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-6'
                        onClick={() => removeCondition(cond.key)}
                        aria-label='删除该条件'
                      >
                        <X className='size-4' />
                      </Button>
                    </div>

                    <div className='flex flex-col gap-2'>
                      <div className='flex flex-col gap-1'>
                        <Label className='text-xs'>选择字段</Label>
                        <Select
                          value={cond.column}
                          onValueChange={(v) => onPickField(cond.key, v)}
                        >
                          <SelectTrigger className='h-9'>
                            <SelectValue placeholder='选择字段' />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_DEFS.map((f) => (
                              <SelectItem key={f.column} value={f.column}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {field && (
                        <div className='flex gap-2'>
                          <div className='flex w-28 shrink-0 flex-col gap-1'>
                            <Label className='text-xs'>操作符</Label>
                            <Select
                              value={cond.op}
                              onValueChange={(v) => patch(cond.key, { op: v })}
                            >
                              <SelectTrigger className='h-9'>
                                <SelectValue placeholder='操作符' />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERATORS[field.type].map((o) => (
                                  <SelectItem key={o.op} value={o.op}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className='flex flex-1 flex-col gap-1'>
                            <Label className='text-xs'>
                              {field.type === 'bytes' ? '值（GB）' : '值'}
                            </Label>
                            {field.type === 'remote' ? (
                              <Select
                                value={cond.value}
                                onValueChange={(v) =>
                                  patch(cond.key, { value: v })
                                }
                              >
                                <SelectTrigger className='h-9'>
                                  <SelectValue placeholder='选择' />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value='1'>异地（多地区）</SelectItem>
                                  <SelectItem value='0'>正常（单地区）</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : field.type === 'banned' ? (
                              <Select
                                value={cond.value}
                                onValueChange={(v) =>
                                  patch(cond.key, { value: v })
                                }
                              >
                                <SelectTrigger className='h-9'>
                                  <SelectValue placeholder='选择状态' />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value='0'>正常</SelectItem>
                                  <SelectItem value='1'>封禁</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : field.type === 'plan' ? (
                              <Select
                                value={cond.value}
                                onValueChange={(v) =>
                                  patch(cond.key, { value: v })
                                }
                              >
                                <SelectTrigger className='h-9'>
                                  <SelectValue placeholder='选择套餐' />
                                </SelectTrigger>
                                <SelectContent>
                                  {plans?.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : field.type === 'date' ? (
                              <Input
                                type='datetime-local'
                                className='h-9'
                                value={cond.value}
                                onChange={(e) =>
                                  patch(cond.key, { value: e.target.value })
                                }
                              />
                            ) : (
                              <Input
                                className='h-9'
                                type={
                                  field.type === 'number' ||
                                  field.type === 'bytes'
                                    ? 'number'
                                    : 'text'
                                }
                                placeholder={
                                  field.type === 'bytes'
                                    ? '如 100（GB）'
                                    : '输入值'
                                }
                                value={cond.value}
                                onChange={(e) =>
                                  patch(cond.key, { value: e.target.value })
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        <SheetFooter className='flex-row gap-2'>
          <Button variant='outline' className='flex-1' onClick={handleReset}>
            重置
          </Button>
          <Button className='flex-1' onClick={handleApply}>
            应用筛选
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
