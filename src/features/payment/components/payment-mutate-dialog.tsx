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
import { ScrollArea } from '@/components/ui/scroll-area'
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: Payment | null
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
      toast.success(isEdit ? '已更新' : '已创建')
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
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑支付方式' : '新增支付方式'}</DialogTitle>
          <DialogDescription>
            配置网关参数。手续费金额单位为「元」。
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[60vh] pr-4'>
          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label>显示名称</Label>
              <Input
                placeholder='如 支付宝'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>图标</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder='图标 URL 或标识'
              />
            </div>
            <div className='grid gap-2'>
              <Label>支付网关</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger>
                  <SelectValue placeholder='选择网关' />
                </SelectTrigger>
                <SelectContent>
                  {(methods ?? []).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formFields &&
              Object.entries(formFields).map(([key, field]) => {
                const opts = optionEntries(field.options)
                return (
                  <div key={key} className='grid gap-2'>
                    <Label>{field.label || key}</Label>
                    {opts.length > 0 ? (
                      <Select
                        value={String(config[key] ?? '')}
                        onValueChange={(v) =>
                          setConfig((c) => ({ ...c, [key]: v }))
                        }
                      >
                        <SelectTrigger>
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
                        value={String(config[key] ?? '')}
                        placeholder={field.placeholder}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, [key]: e.target.value }))
                        }
                      />
                    )}
                    {field.description && (
                      <p className='text-muted-foreground text-xs'>
                        {field.description}
                      </p>
                    )}
                  </div>
                )
              })}

            <div className='grid gap-2'>
              <Label>自定义通知域名</Label>
              <Input
                value={notifyDomain}
                onChange={(e) => setNotifyDomain(e.target.value)}
                placeholder='https://...'
              />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>固定手续费（元）</Label>
                <Input
                  type='number'
                  step='0.01'
                  placeholder='如 0.50'
                  value={feeFixed}
                  onChange={(e) => setFeeFixed(e.target.value)}
                />
              </div>
              <div className='grid gap-2'>
                <Label>百分比手续费（%）</Label>
                <Input
                  type='number'
                  step='0.01'
                  placeholder='如 2.5'
                  value={feePercent}
                  onChange={(e) => setFeePercent(e.target.value)}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name || !payment}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
