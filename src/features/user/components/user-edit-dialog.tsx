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
  FormDescription,
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
import { type User, fetchPlans, updateUser } from '../api'
import { bytesToGiB, giBToBytes } from '../format'

// 秒级时间戳 ↔ datetime-local 字符串（本地时区）
function tsToInput(ts: number | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}
function inputToTs(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor(ms / 1000)
}

const formSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 8, '密码长度最小8位'),
  plan_id: z.string().optional(), // '' = 无套餐
  expired_at: z.string().optional(), // datetime-local，空 = 长期有效
  transfer_enable_gb: z.coerce.number().min(0, '流量不能为负'),
  balance: z.coerce.number(),
  commission_balance: z.coerce.number(),
  commission_rate: z.string().optional(),
  speed_limit: z.string().optional(),
  device_limit: z.string().optional(),
  invite_user_email: z.string().optional(),
  remarks: z.string().optional(),
  banned: z.boolean(),
  is_admin: z.boolean(),
  is_staff: z.boolean(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: User | null
}

const numOrNull = (v?: string) => {
  if (v === undefined || v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function UserEditDialog({ open, onOpenChange, current }: Props) {
  const queryClient = useQueryClient()

  const { data: plans } = useQuery({
    queryKey: ['plans-brief'],
    queryFn: fetchPlans,
    enabled: open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      email: '',
      password: '',
      plan_id: '',
      expired_at: '',
      transfer_enable_gb: 0,
      balance: 0,
      commission_balance: 0,
      commission_rate: '',
      speed_limit: '',
      device_limit: '',
      invite_user_email: '',
      remarks: '',
      banned: false,
      is_admin: false,
      is_staff: false,
    },
  })

  useEffect(() => {
    if (open && current) {
      form.reset({
        email: current.email,
        password: '',
        plan_id: current.plan_id ? String(current.plan_id) : '',
        expired_at: tsToInput(current.expired_at),
        transfer_enable_gb: bytesToGiB(current.transfer_enable),
        balance: current.balance,
        commission_balance: current.commission_balance,
        commission_rate:
          current.commission_rate != null ? String(current.commission_rate) : '',
        speed_limit: current.speed_limit != null ? String(current.speed_limit) : '',
        device_limit:
          current.device_limit != null ? String(current.device_limit) : '',
        invite_user_email: current.invite_user?.email ?? '',
        remarks: current.remarks ?? '',
        banned: !!current.banned,
        is_admin: !!current.is_admin,
        is_staff: !!current.is_staff,
      })
    }
  }, [open, current, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateUser({
        id: current!.id,
        email: values.email,
        password: values.password || undefined,
        plan_id: values.plan_id ? Number(values.plan_id) : null,
        expired_at: inputToTs(values.expired_at ?? ''),
        transfer_enable: giBToBytes(values.transfer_enable_gb),
        balance: values.balance,
        commission_balance: values.commission_balance,
        commission_rate: numOrNull(values.commission_rate),
        speed_limit: numOrNull(values.speed_limit),
        device_limit: numOrNull(values.device_limit),
        invite_user_email: values.invite_user_email?.trim() || '',
        remarks: values.remarks || null,
        banned: values.banned,
        is_admin: values.is_admin,
        is_staff: values.is_staff,
      }),
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>
            修改用户的套餐、流量、余额与权限等信息。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-edit-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid grid-cols-2 gap-4'
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input type='password' placeholder='留空不修改' {...field} />
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
                  <FormLabel>套餐</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='无套餐' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='none'>无套餐</SelectItem>
                      {plans?.map((p) => (
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
              name='expired_at'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>到期时间</FormLabel>
                  <FormControl>
                    <Input type='datetime-local' {...field} />
                  </FormControl>
                  <FormDescription>留空为长期有效</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='transfer_enable_gb'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>总流量 (GB)</FormLabel>
                  <FormControl>
                    <Input type='number' step='0.01' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='balance'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>余额 (元)</FormLabel>
                  <FormControl>
                    <Input type='number' step='0.01' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='commission_balance'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>佣金余额 (元)</FormLabel>
                  <FormControl>
                    <Input type='number' step='0.01' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='commission_rate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>专属佣金比例 (%)</FormLabel>
                  <FormControl>
                    <Input type='number' placeholder='默认' {...field} />
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
                  <FormLabel>限速 (Mbps)</FormLabel>
                  <FormControl>
                    <Input type='number' placeholder='不限' {...field} />
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
                  <FormLabel>设备数限制</FormLabel>
                  <FormControl>
                    <Input type='number' placeholder='不限' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='invite_user_email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邀请人邮箱</FormLabel>
                  <FormControl>
                    <Input placeholder='留空清除' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='remarks'
              render={({ field }) => (
                <FormItem className='col-span-2'>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='col-span-2 flex flex-wrap gap-8'>
              <FormField
                control={form.control}
                name='banned'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel>封禁</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='is_admin'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel>管理员</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='is_staff'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel>员工</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
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
          <Button type='submit' form='user-edit-form' disabled={mutation.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
