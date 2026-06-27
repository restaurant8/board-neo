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
import { adminApi } from '@/lib/api-client'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchPlans, generateUsers } from '../api'

const formSchema = z.object({
  email_prefix: z.string().optional(),
  email_suffix: z.string().min(1, '请输入邮箱后缀（域名）'),
  password: z.string().optional(),
  plan_id: z.string().optional(),
  expired_at: z.string().optional(),
  generate_count: z.coerce.number().int().min(1).max(500).optional(),
  download_csv: z.boolean().optional(),
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
      download_csv: false,
    },
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        email_prefix: values.email_prefix?.trim() || undefined,
        email_suffix: values.email_suffix.trim(),
        password: values.password?.trim() || undefined,
        plan_id: values.plan_id ? Number(values.plan_id) : null,
        expired_at: inputToTs(values.expired_at),
        generate_count: values.generate_count,
        download_csv: values.download_csv || undefined,
      }
      // 勾选导出 CSV：后端直接以文件流返回，需走 blob 下载。
      if (values.download_csv) {
        const res = await adminApi.post('/user/generate', payload, {
          responseType: 'blob',
        })
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `users_${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
        return null
      }
      return generateUsers(payload)
    },
    onSuccess: (list) => {
      const n = Array.isArray(list) ? list.length : 1
      toast.success(list ? `生成成功（${n} 个用户）` : '生成成功，已下载 CSV')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>创建用户</DialogTitle>
          <DialogDescription>
            填写帐号则单个创建（批量生成请留空帐号）。填写帐号并指定生成数量时按「帐号_序号@域」生成，否则随机前缀。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-generate-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid grid-cols-1 sm:grid-cols-2 gap-4'
          >
            <FormField
              control={form.control}
              name='email_prefix'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>帐号(批量生成请留空)</FormLabel>
                  <FormControl>
                    <Input placeholder='留空随机，如 vip' {...field} />
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
                  <FormLabel>域</FormLabel>
                  <FormControl>
                    <Input placeholder='如 example.com' {...field} />
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
                    <Input
                      type='number'
                      min={1}
                      max={500}
                      placeholder='如果为批量生产请输入生成数量'
                      {...field}
                    />
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
                    <Input placeholder='留空则密码与邮件相同' {...field} />
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
                  <FormLabel>订阅计划</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='无' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='none'>无</SelectItem>
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
                  <FormDescription>
                    请选择用户到期日期，留空为长期有效
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='download_csv'
              render={({ field }) => (
                <FormItem className='col-span-2 flex items-center gap-2'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className='!mt-0'>导出为 CSV 文件</FormLabel>
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
