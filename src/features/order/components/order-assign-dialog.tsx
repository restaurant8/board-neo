import { useEffect } from 'react'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { get } from '@/lib/api-client'
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
import { filterPlanCandidatesBySite } from '@/features/plan/plan-site'
import { fetchResellerSites } from '@/features/reseller/api'
import { PERIOD_MAP, assignOrder } from '../api'

type PlanOption = { id: number; name: string; site_id: number | null }

const formSchema = z.object({
  site_id: z.string(),
  email: z.string().min(1, '请输入用户邮箱').email('邮箱格式有误'),
  plan_id: z.string().min(1, '请选择订阅套餐'),
  period: z.string().min(1, '请选择订阅周期'),
  // 元，提交时转分
  total_amount: z.coerce.number().min(0, '金额不能为负'),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderAssignDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()

  const { data: plans } = useQuery({
    queryKey: ['plans', 'brief'],
    queryFn: () => get<PlanOption[]>('/plan/fetch'),
    enabled: open,
  })
  const { data: sites } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
    enabled: open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      site_id: '',
      email: '',
      plan_id: '',
      period: 'month_price',
      total_amount: 0,
    },
  })
  const selectedSiteId = useWatch({
    control: form.control,
    name: 'site_id',
  })
  const availablePlans = filterPlanCandidatesBySite(
    plans ?? [],
    selectedSiteId,
    sites ?? []
  )

  useEffect(() => {
    if (open) {
      form.reset({
        site_id: '',
        email: '',
        plan_id: '',
        period: 'month_price',
        total_amount: 0,
      })
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      assignOrder({
        site_id: values.site_id ? Number(values.site_id) : null,
        email: values.email,
        plan_id: Number(values.plan_id),
        period: values.period,
        // 元 → 分
        total_amount: Math.round(values.total_amount * 100),
      }),
    onSuccess: () => {
      toast.success('已分配订单')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>分配订单</DialogTitle>
          <DialogDescription>
            为指定用户创建一笔订单。金额单位为「元」。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='order-assign-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-4'
          >
            <FormField
              control={form.control}
              name='site_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>用户归属站点</FormLabel>
                  <Select
                    value={field.value || 'main'}
                    onValueChange={(value) => {
                      field.onChange(value === 'main' ? '' : value)
                      form.setValue('plan_id', '')
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='选择站点' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='main'>主站</SelectItem>
                      {(sites ?? []).map((site) => (
                        <SelectItem key={site.id} value={String(site.id)}>
                          {site.name}
                          {site.site_type === 'brand'
                            ? '（品牌站）'
                            : '（分销站）'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>用户邮箱</FormLabel>
                  <FormControl>
                    <Input placeholder='如 user@example.com' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='plan_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>订阅套餐</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='选择套餐' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availablePlans.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='period'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>订阅周期</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='选择周期' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(PERIOD_MAP).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='total_amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>支付金额（元）</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      step='0.01'
                      min='0'
                      placeholder='如 9.90'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
          <Button
            type='submit'
            form='order-assign-form'
            disabled={mutation.isPending}
          >
            分配
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
