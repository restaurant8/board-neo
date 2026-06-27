import { useEffect, useState } from 'react'
import { Trash2, FileText, Eye, EyeOff } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  PLAN_PERIODS,
  PLAN_PERIOD_NAMES,
  RESET_TRAFFIC_METHODS,
  type Plan,
  savePlan,
} from '../api'

// 原版字段视觉签名（对齐 Xboard NYt 字段组件）
const fieldLabelCls =
  'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'
const fieldInputCls = 'h-9 font-mono text-xs transition-all focus-visible:ring-1'
const fieldDescCls = 'font-mono text-[10px] leading-relaxed text-muted-foreground'
const fieldMsgCls = 'font-mono text-[10px] uppercase tracking-tight'

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

/** 套餐说明默认模板（对齐原版 plan.form.content.template.content）。 */
const CONTENT_TEMPLATE = `## 套餐详情

- 流量：{{transfer}} GB
- 速度限制：{{speed}} Mbps
- 同时在线设备：{{devices}} 台

## 服务说明

1. 流量{{reset_method}}重置
2. 支持多平台使用
3. 7×24小时技术支持`

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
  // 套餐说明预览开关（对齐原版 显示预览/隐藏预览）
  const [showPreview, setShowPreview] = useState(false)

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
    setShowPreview(false)
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
      toast.success(isEdit ? '套餐更新成功' : '套餐添加成功')
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const periodFields = PLAN_PERIODS.filter(
    (p) => p !== 'onetime' && p !== 'reset_traffic'
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden border-border/50 p-0 shadow-none sm:rounded-xl'>
        <DialogHeader className='flex-shrink-0 border-b px-6 pb-4 pt-6'>
          <DialogTitle className='text-lg tracking-tight'>
            {isEdit ? '编辑套餐' : '添加套餐'}
          </DialogTitle>
          <DialogDescription className='text-xs opacity-70'>
            价格单位为元，留空表示不开放该周期。
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='space-y-4 px-6 py-4 text-sm'>
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
                    toast.error(first?.message || '表单校验失败，请检查并修正错误后重试。')
                  }
                )}
                className='space-y-6'
              >
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>套餐名称</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='请输入套餐名称'
                            className={fieldInputCls}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='tags'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>标签</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='输入标签后按回车确认'
                            className={fieldInputCls}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='group_id'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>服务器分组</FormLabel>
                        <Select
                          value={field.value || 'none'}
                          onValueChange={(v) =>
                            field.onChange(v === 'none' ? '' : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className='h-9 font-mono text-xs'>
                              <SelectValue placeholder='请选择服务器分组' />
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
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='transfer_enable'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>流量</FormLabel>
                        <div className='relative'>
                          <FormControl>
                            <Input
                              type='number'
                              min={0}
                              placeholder='请输入流量限制'
                              className={`${fieldInputCls} pr-10`}
                              {...field}
                            />
                          </FormControl>
                          <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                            <span className='font-mono text-[10px] font-bold uppercase text-muted-foreground/40'>
                              GB
                            </span>
                          </div>
                        </div>
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='speed_limit'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>速度限制</FormLabel>
                        <div className='relative'>
                          <FormControl>
                            <Input
                              type='number'
                              min={0}
                              placeholder='请输入速度限制'
                              className={`${fieldInputCls} pr-10`}
                              {...field}
                            />
                          </FormControl>
                          <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                            <span className='font-mono text-[10px] font-bold uppercase text-muted-foreground/40'>
                              Mbps
                            </span>
                          </div>
                        </div>
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='device_limit'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>设备限制</FormLabel>
                        <div className='relative'>
                          <FormControl>
                            <Input
                              type='number'
                              min={0}
                              placeholder='请输入设备限制'
                              className={`${fieldInputCls} pr-10`}
                              {...field}
                            />
                          </FormControl>
                          <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                            <span className='font-mono text-[10px] font-bold uppercase text-muted-foreground/40'>
                              台
                            </span>
                          </div>
                        </div>
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='capacity_limit'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>容量限制</FormLabel>
                        <div className='relative'>
                          <FormControl>
                            <Input
                              type='number'
                              min={0}
                              placeholder='请输入容量限制'
                              className={`${fieldInputCls} pr-10`}
                              {...field}
                            />
                          </FormControl>
                          <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                            <span className='font-mono text-[10px] font-bold uppercase text-muted-foreground/40'>
                              人
                            </span>
                          </div>
                        </div>
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='reset_traffic_method'
                    render={({ field }) => (
                      <FormItem className='space-y-1.5'>
                        <FormLabel className={fieldLabelCls}>流量重置方式</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className='h-9 font-mono text-xs'>
                              <SelectValue placeholder='请选择重置方式' />
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
                        <FormMessage className={fieldMsgCls} />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 价格设置（对齐原版：虚线边框卡片） */}
                <div className='space-y-4 rounded-lg border border-dashed p-4'>
                  <div className='flex items-center justify-between'>
                    <h3 className='text-sm font-medium'>价格设置</h3>
                    <div className='flex items-center gap-2'>
                      <div className='relative'>
                        <Input
                          type='number'
                          step='0.01'
                          placeholder='基础价格'
                          value={basePrice}
                          onChange={(e) => applyBasePrice(e.target.value)}
                          className='h-8 w-24 pl-5 text-xs'
                        />
                        <span className='absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground'>
                          ￥
                        </span>
                      </div>
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-8 px-2'
                        type='button'
                        title='清空所有价格'
                        onClick={clearPrices}
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
                    {periodFields.map((p) => (
                      <FormField
                        key={p}
                        control={form.control}
                        name={`prices.${p}` as const}
                        render={({ field }) => (
                          <FormItem className='space-y-1.5'>
                            <FormLabel className={fieldLabelCls}>
                              {PLAN_PERIOD_NAMES[p]}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type='number'
                                step='0.01'
                                className={fieldInputCls}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className={fieldMsgCls} />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>

                  <Separator />

                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    <FormField
                      control={form.control}
                      name='prices.onetime'
                      render={({ field }) => (
                        <FormItem className='space-y-1.5'>
                          <FormLabel className={fieldLabelCls}>
                            {PLAN_PERIOD_NAMES['onetime']}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type='number'
                              step='0.01'
                              className={fieldInputCls}
                              {...field}
                            />
                          </FormControl>
                          <p className={fieldDescCls}>一次性流量包，无时间限制</p>
                          <FormMessage className={fieldMsgCls} />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='prices.reset_traffic'
                      render={({ field }) => (
                        <FormItem className='space-y-1.5'>
                          <FormLabel className={fieldLabelCls}>
                            {PLAN_PERIOD_NAMES['reset_traffic']}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type='number'
                              step='0.01'
                              className={fieldInputCls}
                              {...field}
                            />
                          </FormControl>
                          <p className={fieldDescCls}>重置流量包，可多次使用</p>
                          <FormMessage className={fieldMsgCls} />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 套餐说明（对齐原版：使用模板 / 显示预览） */}
                <FormField
                  control={form.control}
                  name='content'
                  render={({ field }) => (
                    <FormItem className='space-y-3'>
                      <div className='flex items-center justify-between'>
                        <FormLabel className={fieldLabelCls}>套餐说明</FormLabel>
                        <div className='flex items-center gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            className='h-8'
                            type='button'
                            onClick={() => field.onChange(CONTENT_TEMPLATE)}
                          >
                            <FileText className='mr-2 h-3.5 w-3.5' />
                            使用模板
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            className='h-8'
                            type='button'
                            onClick={() => setShowPreview((v) => !v)}
                          >
                            {showPreview ? (
                              <EyeOff className='mr-2 h-3.5 w-3.5' />
                            ) : (
                              <Eye className='mr-2 h-3.5 w-3.5' />
                            )}
                            {showPreview ? '隐藏预览' : '显示预览'}
                          </Button>
                        </div>
                      </div>
                      <div
                        className={`grid gap-4 ${
                          showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                        }`}
                      >
                        <FormControl>
                          <Textarea
                            placeholder='请输入套餐说明'
                            style={{ height: '300px' }}
                            className='resize-none rounded-md border font-mono text-xs'
                            {...field}
                          />
                        </FormControl>
                        {showPreview && (
                          <div className='prose prose-sm dark:prose-invert h-[300px] max-w-none overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-4 text-xs'>
                            {field.value || ''}
                          </div>
                        )}
                      </div>
                      <p className={fieldDescCls}>支持 Markdown 格式</p>
                      <FormMessage className={fieldMsgCls} />
                    </FormItem>
                  )}
                />

                <div className='flex flex-wrap gap-8'>
                  <FormField
                    control={form.control}
                    name='show'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-2 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className='cursor-pointer select-none text-xs font-normal'>
                          显示
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sell'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-2 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className='cursor-pointer select-none text-xs font-normal'>
                          可售卖
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='renew'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-2 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className='cursor-pointer select-none text-xs font-normal'>
                          可续费
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </div>
        </div>
        <DialogFooter className='flex-shrink-0 border-t px-6 py-4 sm:items-center sm:justify-between'>
          <div className='flex items-center gap-2'>
            {isEdit && (
              <Form {...form}>
                <FormField
                  control={form.control}
                  name='force_update'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center space-x-2 space-y-0'>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className='cursor-pointer select-none text-xs font-normal'>
                        强制更新用户套餐
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </Form>
            )}
          </div>
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
              type='submit'
              form='plan-form'
              className='h-8 px-8 text-xs font-bold'
              disabled={mutation.isPending}
            >
              提交
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
