import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { ASSIGN_PERIOD_MAP, assignOrder, fetchPlans } from '../api'

const formSchema = z.object({
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
  /** 预填用户邮箱。 */
  email?: string
}

export function UserAssignOrderDialog({ open, onOpenChange, email }: Props) {
  const queryClient = useQueryClient()

  const { data: plans } = useQuery({
    queryKey: ['plans-brief'],
    queryFn: fetchPlans,
    enabled: open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      email: email ?? '',
      plan_id: '',
      period: 'month_price',
      total_amount: 0,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        email: email ?? '',
        plan_id: '',
        period: 'month_price',
        total_amount: 0,
      })
    }
  }, [open, email, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      assignOrder({
        email: values.email,
        plan_id: Number(values.plan_id),
        period: values.period,
        // 元 → 分
        total_amount: Math.round(values.total_amount * 100),
      }),
    onSuccess: () => {
      toast.success('已分配订单')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
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
            为该用户创建一笔订单。金额单位为「元」。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-assign-order-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-4'
          >
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
                      {(plans ?? []).map((p) => (
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
                      {Object.entries(ASSIGN_PERIOD_MAP).map(([k, label]) => (
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
            form='user-assign-order-form'
            disabled={mutation.isPending}
          >
            分配
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
