import { useId, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Server } from '../api'
import {
  type NodeRateSettings,
  type RateRangeInput,
  validateNodeRateSettings,
} from '../rate'

export function BatchRateDialog({
  open,
  onOpenChange,
  nodes,
  isLoading,
  onConfirm,
  failures = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: Server[]
  isLoading: boolean
  onConfirm: (settings: NodeRateSettings) => void
  failures?: Array<{ id: number; name: string; message: string }>
}) {
  const formId = useId()
  const [mode, setMode] = useState<NodeRateSettings['mode'] | null>(null)
  const [rate, setRate] = useState('')
  const [ranges, setRanges] = useState<RateRangeInput[]>([
    { start: '', end: '', rate: '' },
  ])
  const dynamicCount = nodes.filter((node) => node.rate_time_enable).length
  const validation = validateNodeRateSettings(mode, rate, ranges)
  const canSubmit = nodes.length > 0 && validation.settings !== null

  const updateRange = (
    index: number,
    field: keyof RateRangeInput,
    value: string
  ) => {
    setRanges((previous) =>
      previous.map((range, row) =>
        row === index ? { ...range, [field]: value } : range
      )
    )
  }

  const handleConfirm = () => {
    if (isLoading || nodes.length === 0) return
    const result = validateNodeRateSettings(mode, rate, ranges)
    if (result.settings) onConfirm(result.settings)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isLoading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className='sm:max-w-xl'
        showCloseButton={!isLoading}
        onEscapeKeyDown={(event) => {
          if (isLoading) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (isLoading) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>批量修改节点倍率</DialogTitle>
          <DialogDescription>
            已选 {nodes.length} 个节点，当前静态 {nodes.length - dynamicCount}{' '}
            个、动态 {dynamicCount} 个。
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          noValidate
          className='space-y-4'
          aria-busy={isLoading}
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
        >
          <fieldset className='space-y-2' disabled={isLoading}>
            <legend className='mb-2 text-sm font-medium'>倍率类型</legend>
            <div className='grid grid-cols-2 gap-2'>
              {(
                [
                  ['static', '静态倍率'],
                  ['dynamic', '动态倍率'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type='button'
                  aria-pressed={mode === value}
                  disabled={isLoading}
                  onClick={() => setMode(value)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    mode === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === null && (
              <p className='text-xs text-muted-foreground'>
                请先选择本次统一设置为静态倍率或动态倍率。
              </p>
            )}
          </fieldset>

          {mode !== null && (
            <>
              <Alert>
                <AlertTriangle className='size-4' />
                <AlertTitle>
                  {mode === 'static' ? '统一设置静态倍率' : '统一设置动态倍率'}
                </AlertTitle>
                <AlertDescription>
                  {mode === 'static'
                    ? '将所有已选节点设为同一倍率，关闭动态倍率并清空原有时段规则。'
                    : '将为所有已选节点启用动态倍率，统一设置基础倍率，并覆盖原有的全部时段规则。'}
                </AlertDescription>
              </Alert>

              <div className='space-y-2'>
                <Label htmlFor={`${formId}-rate`}>
                  {mode === 'static'
                    ? '静态倍率'
                    : '基础倍率（未命中时段时生效）'}
                </Label>
                <Input
                  id={`${formId}-rate`}
                  type='number'
                  min='0'
                  max='999999.99'
                  step='0.01'
                  inputMode='decimal'
                  required
                  disabled={isLoading}
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  placeholder='例如 1 或 0.5'
                />
                <p className='text-xs text-muted-foreground'>
                  基础倍率范围为 0–999999.99，最多两位小数；0 表示不扣流量。
                </p>
              </div>

              {mode === 'dynamic' && (
                <div className='space-y-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-sm font-medium'>动态时段规则</span>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={isLoading}
                      onClick={() =>
                        setRanges((previous) => [
                          ...previous,
                          { start: '', end: '', rate: '' },
                        ])
                      }
                    >
                      <Plus className='size-4' />
                      添加时段
                    </Button>
                  </div>
                  <p className='text-xs leading-relaxed text-muted-foreground'>
                    时间按服务器时区。命中时直接使用时段倍率，不与基础倍率相乘；未命中时使用基础倍率。
                    时段不得重叠或共用端点，跨午夜请拆为两段。
                  </p>
                  {ranges.map((range, index) => (
                    <div
                      key={index}
                      className='grid grid-cols-2 items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]'
                    >
                      <div className='min-w-0 space-y-2'>
                        <Label htmlFor={`${formId}-start-${index}`}>
                          开始时间
                        </Label>
                        <Input
                          id={`${formId}-start-${index}`}
                          type='time'
                          step='60'
                          required
                          disabled={isLoading}
                          value={range.start}
                          onChange={(event) =>
                            updateRange(index, 'start', event.target.value)
                          }
                        />
                      </div>
                      <div className='min-w-0 space-y-2'>
                        <Label htmlFor={`${formId}-end-${index}`}>
                          结束时间
                        </Label>
                        <Input
                          id={`${formId}-end-${index}`}
                          type='time'
                          step='60'
                          required
                          disabled={isLoading}
                          value={range.end}
                          onChange={(event) =>
                            updateRange(index, 'end', event.target.value)
                          }
                        />
                      </div>
                      <div className='min-w-0 space-y-2'>
                        <Label htmlFor={`${formId}-range-rate-${index}`}>
                          时段倍率
                        </Label>
                        <Input
                          id={`${formId}-range-rate-${index}`}
                          type='number'
                          min='0'
                          step='any'
                          inputMode='decimal'
                          required
                          disabled={isLoading}
                          value={range.rate}
                          placeholder='例如 0.5'
                          onChange={(event) =>
                            updateRange(index, 'rate', event.target.value)
                          }
                        />
                      </div>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        className='justify-self-end'
                        aria-label={`移除第 ${index + 1} 个时段`}
                        disabled={isLoading}
                        onClick={() =>
                          setRanges((previous) =>
                            previous.filter((_, row) => row !== index)
                          )
                        }
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  ))}
                  {ranges.length === 0 && (
                    <p className='text-xs text-muted-foreground'>
                      请添加至少一个动态时段。
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {mode !== null && rate !== '' && validation.error && (
            <p role='alert' className='text-sm text-destructive'>
              {validation.error}
            </p>
          )}

          {failures.length > 0 && (
            <Alert variant='destructive'>
              <AlertTriangle className='size-4' />
              <AlertTitle>{failures.length} 个节点修改失败</AlertTitle>
              <AlertDescription className='min-w-0'>
                <p>以下节点未确认保存成功，请刷新核对并检查原因后重试。</p>
                <ul className='max-h-36 w-full space-y-2 overflow-y-auto break-words'>
                  {failures.map((failure) => (
                    <li key={failure.id}>
                      <span className='font-medium'>
                        {failure.name}（ID: {failure.id}）
                      </span>
                      ：{failure.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type='submit'
            form={formId}
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? '修改中...' : `确认修改 ${nodes.length} 个节点`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
