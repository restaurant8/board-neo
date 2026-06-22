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
import { fetchPlans, generateUsers } from '../api'

const formSchema = z.object({
  email_prefix: z.string().optional(),
  email_suffix: z.string().min(1, '请输入邮箱后缀（域名）'),
  password: z.string().optional(),
  plan_id: z.string().optional(),
  expired_at: z.string().optional(),
  generate_count: z.coerce.number().int().min(1).max(1000).optional(),
})
type FormValues = z.infer<typeof formSchema>

function inputToTs(value?: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserGenerateDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const { data: plans } = useQuery({
    queryKey: ['plans-brief'],
    queryFn: fetchPlans,
    enabled: open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      email_prefix: '',
      email_suffix: '',
      password: '',
      plan_id: '',
      expired_at: '',
      generate_count: 1,
    },
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      generateUsers({
        email_prefix: values.email_prefix?.trim() || undefined,
        email_suffix: values.email_suffix.trim(),
        password: values.password?.trim() || undefined,
        plan_id: values.plan_id ? Number(values.plan_id) : null,
        expired_at: inputToTs(values.expired_at),
        generate_count: values.generate_count,
      }),
    onSuccess: (list) => {
      const n = Array.isArray(list) ? list.length : 1
      toast.success(`已生成 ${n} 个用户`)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>生成用户</DialogTitle>
          <DialogDescription>
            按数量批量生成。填写邮箱前缀则按「前缀_序号@后缀」生成，否则随机前缀。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-generate-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid grid-cols-2 gap-4'
          >
            <FormField
              control={form.control}
              name='email_prefix'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱前缀</FormLabel>
                  <FormControl>
                    <Input placeholder='可空（随机）' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='email_suffix'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱后缀（域名）</FormLabel>
                  <FormControl>
                    <Input placeholder='example.com' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='generate_count'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>生成数量</FormLabel>
                  <FormControl>
                    <Input type='number' min={1} {...field} />
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
                    <Input placeholder='留空=邮箱' {...field} />
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
            form='user-generate-form'
            disabled={mutation.isPending}
          >
            生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
