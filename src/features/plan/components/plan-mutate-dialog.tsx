import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { fetchServerGroups } from '@/features/server-group/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  PLAN_PERIODS,
  PLAN_PERIOD_NAMES,
  RESET_TRAFFIC_METHODS,
  type Plan,
  savePlan,
} from '../api'

const priceShape = Object.fromEntries(
  PLAN_PERIODS.map((p) => [p, z.string().optional()])
) as Record<(typeof PLAN_PERIODS)[number], z.ZodOptional<z.ZodString>>

const formSchema = z.object({
  name: z.string().min(1, '请输入套餐名称'),
  group_id: z.string().optional(),
  transfer_enable: z.coerce.number().int().min(1, '流量配额必须大于 0'),
  speed_limit: z.string().optional(),
  device_limit: z.string().optional(),
  capacity_limit: z.string().optional(),
  reset_traffic_method: z.string(),
  content: z.string().optional(),
  tags: z.string().optional(),
  prices: z.object(priceShape),
  show: z.boolean(),
  renew: z.boolean(),
  sell: z.boolean(),
  force_update: z.boolean(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: Plan | null
}

const emptyPrices = Object.fromEntries(
  PLAN_PERIODS.map((p) => [p, ''])
) as Record<(typeof PLAN_PERIODS)[number], string>

/**
 * 「基础价格」快捷填充系数（对齐原版）：各周期价 = 基础月价 × 月数 × 折扣。
 * 月付/一次性/流量重置包不打折（系数 1）。
 */
const PERIOD_PRICE_FACTORS: Record<(typeof PLAN_PERIODS)[number], number> = {
  monthly: 1,
  quarterly: 3 * 0.95,
  half_yearly: 6 * 0.9,
  yearly: 12 * 0.85,
  two_yearly: 24 * 0.8,
  three_yearly: 36 * 0.75,
  onetime: 1,
  reset_traffic: 1,
}

function toNum(v?: string): number | null {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function PlanMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  // 「基础价格」快捷填充输入（仅辅助，不入表单/不提交）
  const [basePrice, setBasePrice] = useState('')

  const { data: groups } = useQuery({
    queryKey: ['server-groups'],
    queryFn: fetchServerGroups,
    enabled: open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      name: '',
      group_id: '',
      transfer_enable: 0,
      speed_limit: '',
      device_limit: '',
      capacity_limit: '',
      reset_traffic_method: 'null',
      content: '',
      tags: '',
      prices: { ...emptyPrices },
      show: true,
      renew: true,
      sell: true,
      force_update: false,
    },
  })

  // 按基础月价自动推算各周期价格（对齐原版，输入非法/空时不动）
  const applyBasePrice = (v: string) => {
    setBasePrice(v)
    const base = Number(v)
    if (v.trim() === '' || Number.isNaN(base)) return
    for (const p of PLAN_PERIODS) {
      form.setValue(
        `prices.${p}` as const,
        (base * PERIOD_PRICE_FACTORS[p]).toFixed(2),
        { shouldDirty: true }
      )
    }
  }

  // 清空所有周期价格
  const clearPrices = () => {
    setBasePrice('')
    for (const p of PLAN_PERIODS) {
      form.setValue(`prices.${p}` as const, '', { shouldDirty: true })
    }
  }

  useEffect(() => {
    if (!open) return
    setBasePrice('')
    const prices = { ...emptyPrices }
    if (current?.prices) {
      for (const p of PLAN_PERIODS) {
        const v = current.prices[p]
        if (v != null) prices[p] = String(v)
      }
    }
    form.reset({
      name: current?.name ?? '',
      group_id: current?.group_id != null ? String(current.group_id) : '',
      transfer_enable: current?.transfer_enable ?? 0,
      speed_limit: current?.speed_limit != null ? String(current.speed_limit) : '',
      device_limit: current?.device_limit != null ? String(current.device_limit) : '',
      capacity_limit:
        current?.capacity_limit != null ? String(current.capacity_limit) : '',
      reset_traffic_method:
        current?.reset_traffic_method != null
          ? String(current.reset_traffic_method)
          : 'null',
      content: current?.content ?? '',
      tags: (current?.tags ?? []).join(','),
      prices,
      // 后端以 MySQL tinyint(0/1) 返回这三个开关，需转成布尔，否则 z.boolean() 校验失败。
      show: current ? Boolean(current.show) : true,
      renew: current ? Boolean(current.renew) : true,
      sell: current ? Boolean(current.sell) : true,
      force_update: false,
    })
  }, [open, current, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const prices: Record<string, number> = {}
      for (const p of PLAN_PERIODS) {
        const n = toNum(values.prices[p])
        if (n != null && n > 0) prices[p] = n
      }
      return savePlan({
        id: current?.id,
        name: values.name,
        group_id: toNum(values.group_id),
        transfer_enable: values.transfer_enable,
        speed_limit: toNum(values.speed_limit),
        device_limit: toNum(values.device_limit),
        capacity_limit: toNum(values.capacity_limit),
        reset_traffic_method:
          values.reset_traffic_method === 'null'
            ? null
            : Number(values.reset_traffic_method),
        content: values.content || null,
        tags: values.tags
          ? values.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        prices,
        force_update: isEdit ? values.force_update : undefined,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑套餐' : '新建套餐'}</DialogTitle>
          <DialogDescription>
            价格单位为元，留空表示不开放该周期。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='plan-form'
            onSubmit={form.handleSubmit(
              (v) => mutation.mutate(v),
              // 避免校验失败时静默无反应：把第一条错误提示给用户。
              (errs) => {
                const first = Object.values(errs)[0] as
                  | { message?: string }
                  | undefined
                toast.error(first?.message || '请检查表单填写是否完整')
              }
            )}
            className='grid gap-4'
          >
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>套餐名称</FormLabel>
                    <FormControl>
                      <Input placeholder='如 高级套餐' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='group_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>权限组</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='选择权限组' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='none'>无</SelectItem>
                        {(groups ?? []).map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='transfer_enable'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>流量配额 (GB)</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} placeholder='如 100' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='speed_limit'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>速度限制 (Mbps，留空不限)</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} placeholder='如 100' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='device_limit'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>设备数限制 (留空不限)</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} placeholder='如 3' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='capacity_limit'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>可购买人数 (留空不限)</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} placeholder='如 500' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='reset_traffic_method'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>流量重置方式</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RESET_TRAFFIC_METHODS.map((m) => (
                        <SelectItem
                          key={String(m.value)}
                          value={m.value == null ? 'null' : String(m.value)}
                        >
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <FormLabel>价格（元）</FormLabel>
                <div className='flex items-center gap-2'>
                  <div className='relative'>
                    <span className='text-muted-foreground absolute start-2 top-1/2 -translate-y-1/2 text-xs'>
                      ¥
                    </span>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      placeholder='基础价格'
                      value={basePrice}
                      onChange={(e) => applyBasePrice(e.target.value)}
                      className='h-8 w-28 ps-5 text-xs'
                    />
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-8 px-2'
                    onClick={clearPrices}
                    title='清空所有周期价格'
                  >
                    <Trash2 className='size-3.5' />
                  </Button>
                </div>
              </div>
              <div className='mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-4'>
                {PLAN_PERIODS.map((p) => (
                  <FormField
                    key={p}
                    control={form.control}
                    name={`prices.${p}` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-xs text-muted-foreground'>
                          {PLAN_PERIOD_NAMES[p]}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step='0.01'
                            placeholder='—'
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标签（逗号分隔）</FormLabel>
                  <FormControl>
                    <Input placeholder='热销,推荐' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='content'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>套餐描述</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder='支持 HTML/Markdown' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex flex-wrap gap-8'>
              <FormField
                control={form.control}
                name='show'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel>显示</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='sell'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel>可售卖</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='renew'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel>可续费</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {isEdit && (
                <FormField
                  control={form.control}
                  name='force_update'
                  render={({ field }) => (
                    <FormItem className='flex items-center gap-2'>
                      <FormLabel>同步至已购用户</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button type='submit' form='plan-form' disabled={mutation.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
