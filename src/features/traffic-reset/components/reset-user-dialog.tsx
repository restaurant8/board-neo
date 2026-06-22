import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { resetUser } from '../api'

const formSchema = z.object({
  user_id: z.coerce.number().int().positive('请输入有效的用户 ID'),
  reason: z.string().max(255).optional(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResetUserDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: { user_id: undefined, reason: '' },
  })

  useEffect(() => {
    if (open) form.reset({ user_id: undefined, reason: '' })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      resetUser({ user_id: values.user_id, reason: values.reason || undefined }),
    onSuccess: (res) => {
      toast.success(res?.message || '已重置')
      queryClient.invalidateQueries({ queryKey: ['traffic-reset-logs'] })
      queryClient.invalidateQueries({ queryKey: ['traffic-reset-stats'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>手动重置用户流量</DialogTitle>
          <DialogDescription>
            按用户 ID 立即重置其流量统计，操作会记入重置日志。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='reset-user-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-4'
          >
            <FormField
              control={form.control}
              name='user_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>用户 ID</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      placeholder='例如 1024'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='reason'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>原因（可选）</FormLabel>
                  <FormControl>
                    <Input placeholder='记录此次重置的原因' {...field} />
                  </FormControl>
                  <FormDescription>会写入重置日志的元数据。</FormDescription>
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
            form='reset-user-form'
            disabled={mutation.isPending}
          >
            重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
