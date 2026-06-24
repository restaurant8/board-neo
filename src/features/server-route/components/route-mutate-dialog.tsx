import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { Textarea } from '@/components/ui/textarea'
import { type ServerRoute, saveServerRoute } from '../api'

const formSchema = z.object({
  remarks: z.string().min(1, '请输入备注'),
  match: z.string().min(1, '请输入匹配规则'),
  action: z.enum(['block', 'direct', 'dns', 'proxy']),
  action_value: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

const ACTION_OPTIONS: { value: FormValues['action']; label: string }[] = [
  { value: 'block', label: '阻断 (block)' },
  { value: 'direct', label: '直连 (direct)' },
  { value: 'dns', label: 'DNS (dns)' },
  { value: 'proxy', label: '代理 (proxy)' },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: ServerRoute | null
}

export function RouteMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      remarks: '',
      match: '',
      action: 'block',
      action_value: '',
    },
  })

  const action = form.watch('action')

  useEffect(() => {
    if (open) {
      form.reset({
        remarks: current?.remarks ?? '',
        // match 数组以换行展示，便于多行编辑
        match: (current?.match ?? []).join('\n'),
        action: current?.action ?? 'block',
        action_value: current?.action_value ?? '',
      })
    }
  }, [open, current, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      saveServerRoute({
        id: current?.id,
        remarks: values.remarks,
        match: values.match
          .split('\n')
          .map((m) => m.trim())
          .filter(Boolean),
        action: values.action,
        action_value: values.action_value?.trim() || null,
      }),
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['server-routes'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑路由规则' : '新建路由规则'}</DialogTitle>
          <DialogDescription>
            匹配规则命中后执行对应动作（阻断 / 直连 / DNS / 代理）。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='route-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-4'
          >
            <FormField
              control={form.control}
              name='remarks'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Input placeholder='如 屏蔽广告 或 国内直连' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='match'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>匹配规则（每行一条）</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder={'例如：\ngeosite:google\ndomain:example.com\n1.1.1.1/32'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='action'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>动作</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='选择动作' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {action === 'dns' && (
              <FormField
                control={form.control}
                name='action_value'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>动作值</FormLabel>
                    <FormControl>
                      <Input placeholder='如 1.1.1.1' {...field} />
                    </FormControl>
                    <FormDescription>动作为 DNS 时指定目标 DNS。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
          <Button type='submit' form='route-form' disabled={mutation.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
