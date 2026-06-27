import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type Payment,
  getPaymentForm,
  getPaymentMethods,
  savePayment,
} from '../api'

// 原版字段视觉签名（对齐 Xboard NYt 字段组件）
const fieldLabelCls =
  'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'
const fieldInputCls = 'h-9 font-mono text-xs transition-all focus-visible:ring-1'
const fieldDescCls = 'font-mono text-[10px] leading-relaxed text-muted-foreground'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: Payment | null
}

function Field({
  label,
  required,
  description,
  children,
}: {
  label: string
  required?: boolean
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1.5'>
      <Label className={fieldLabelCls}>
        {label}
        {required && <span className='ml-1 text-destructive'>*</span>}
      </Label>
      <div className='relative'>{children}</div>
      {description && <p className={fieldDescCls}>{description}</p>}
    </div>
  )
}

export function PaymentMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [payment, setPayment] = useState('')
  const [notifyDomain, setNotifyDomain] = useState('')
  const [feeFixed, setFeeFixed] = useState('') // 元
  const [feePercent, setFeePercent] = useState('')
  const [config, setConfig] = useState<Record<string, unknown>>({})

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: getPaymentMethods,
    enabled: open,
  })

  const { data: formFields } = useQuery({
    queryKey: ['payment-form', payment, current?.id],
    queryFn: () => getPaymentForm(payment, current?.id),
    enabled: open && !!payment,
  })

  useEffect(() => {
    if (open) {
      setName(current?.name ?? '')
      setIcon(current?.icon ?? '')
      setPayment(current?.payment ?? '')
      setNotifyDomain(current?.notify_domain ?? '')
      setFeeFixed(
        current?.handling_fee_fixed != null
          ? String(current.handling_fee_fixed / 100)
          : ''
      )
      setFeePercent(
        current?.handling_fee_percent != null
          ? String(current.handling_fee_percent)
          : ''
      )
      setConfig(current?.config ?? {})
    }
  }, [open, current])

  // 网关表单加载后，用其默认/当前值初始化 config
  useEffect(() => {
    if (formFields) {
      setConfig((prev) => {
        const next: Record<string, unknown> = { ...prev }
        for (const [key, field] of Object.entries(formFields)) {
          if (next[key] === undefined) next[key] = field.value ?? ''
        }
        return next
      })
    }
  }, [formFields])

  const mutation = useMutation({
    mutationFn: () =>
      savePayment({
        id: current?.id,
        name,
        icon: icon || null,
        payment,
        config,
        notify_domain: notifyDomain || null,
        // 元 → 分
        handling_fee_fixed: feeFixed ? Math.round(Number(feeFixed) * 100) : null,
        handling_fee_percent: feePercent ? Number(feePercent) : null,
      }),
    onSuccess: () => {
      toast.success('保存成功')
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  function optionEntries(
    options?: Record<string, string> | string[]
  ): Array<[string, string]> {
    if (!options) return []
    if (Array.isArray(options)) return options.map((o) => [o, o])
    return Object.entries(options)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden border-border/50 p-0 shadow-none sm:rounded-xl'>
        <DialogHeader className='flex-shrink-0 border-b px-6 pb-4 pt-6'>
          <DialogTitle className='text-lg tracking-tight'>
            {isEdit ? '编辑支付方式' : '添加支付方式'}
          </DialogTitle>
          <DialogDescription className='text-xs opacity-70'>
            配置网关参数。手续费金额单位为「元」。
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='space-y-4 px-6 py-4 text-sm'>
            <form
              className='space-y-4'
              onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate()
              }}
            >
              <Field label='显示名称' required description='用于前端显示'>
                <Input
                  placeholder='请输入支付名称'
                  className={fieldInputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field label='图标URL' description='用于前端显示的图标地址'>
                <Input
                  className={fieldInputCls}
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder='https://example.com/icon.svg'
                />
              </Field>

              <Field label='通知域名' description='网关通知将发送到该域名'>
                <Input
                  className={fieldInputCls}
                  value={notifyDomain}
                  onChange={(e) => setNotifyDomain(e.target.value)}
                  placeholder='https://example.com'
                />
              </Field>

              <div className='grid grid-cols-2 gap-4'>
                <Field label='百分比手续费(%)'>
                  <Input
                    type='number'
                    step='0.01'
                    className={`${fieldInputCls} pr-10`}
                    placeholder='0-100'
                    value={feePercent}
                    onChange={(e) => setFeePercent(e.target.value)}
                  />
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                    <span className='font-mono text-[10px] font-bold uppercase text-muted-foreground/40'>
                      %
                    </span>
                  </div>
                </Field>
                <Field label='固定手续费'>
                  <Input
                    type='number'
                    step='0.01'
                    className={`${fieldInputCls} pr-10`}
                    placeholder='0'
                    value={feeFixed}
                    onChange={(e) => setFeeFixed(e.target.value)}
                  />
                  <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                    <span className='font-mono text-[10px] font-bold uppercase text-muted-foreground/40'>
                      元
                    </span>
                  </div>
                </Field>
              </div>

              <div className='space-y-1.5'>
                <Label className={fieldLabelCls}>
                  支付接口<span className='ml-1 text-destructive'>*</span>
                </Label>
                <Select value={payment} onValueChange={setPayment}>
                  <SelectTrigger className='h-9 font-mono text-xs'>
                    <SelectValue placeholder='请选择支付接口' />
                  </SelectTrigger>
                  <SelectContent>
                    {(methods ?? []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={fieldDescCls}>选择要使用的支付接口</p>
              </div>

              {formFields && Object.keys(formFields).length > 0 && (
                <div className='space-y-4 border-t pt-4'>
                  <div className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
                    支付配置
                  </div>
                  <div className='grid grid-cols-1 gap-4'>
                    {Object.entries(formFields).map(([key, field]) => {
                      const opts = optionEntries(field.options)
                      return (
                        <Field
                          key={key}
                          label={field.label || key}
                          description={field.description}
                        >
                          {opts.length > 0 ? (
                            <Select
                              value={String(config[key] ?? '')}
                              onValueChange={(v) =>
                                setConfig((c) => ({ ...c, [key]: v }))
                              }
                            >
                              <SelectTrigger className='h-9 font-mono text-xs'>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {opts.map(([val, label]) => (
                                  <SelectItem key={val} value={val}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className={fieldInputCls}
                              value={String(config[key] ?? '')}
                              placeholder={field.placeholder}
                              onChange={(e) =>
                                setConfig((c) => ({
                                  ...c,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                          )}
                        </Field>
                      )
                    })}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
        <DialogFooter className='flex-shrink-0 border-t px-6 py-4 sm:items-center sm:justify-end'>
          <div className='flex items-center gap-3'>
            <Button
              variant='ghost'
              className='h-8 px-4 text-xs font-bold'
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              取消
            </Button>
            <Button
              className='h-8 px-8 text-xs font-bold'
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !name || !payment}
            >
              提交
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
