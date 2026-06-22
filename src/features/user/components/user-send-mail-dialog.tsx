import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
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
import { Textarea } from '@/components/ui/textarea'
import { type UserFilter, sendMail } from '../api'

const formSchema = z.object({
  subject: z.string().min(1, '请输入主题'),
  content: z.string().min(1, '请输入内容'),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 当前筛选条件；为空则发送全部。 */
  filter?: UserFilter[]
}

export function UserSendMailDialog({ open, onOpenChange, filter }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { subject: '', content: '' },
  })

  const hasFilter = !!filter && filter.length > 0

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      sendMail({
        subject: values.subject,
        content: values.content,
        scope: hasFilter ? 'filtered' : 'all',
        filter: hasFilter ? filter : undefined,
      }),
    onSuccess: () => {
      toast.success('邮件任务已加入队列')
      form.reset()
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>群发邮件</DialogTitle>
          <DialogDescription>
            发送对象：{hasFilter ? '当前筛选结果' : '全部用户'}。支持占位符如{' '}
            {'{user.email}'}。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-mail-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-4'
          >
            <FormField
              control={form.control}
              name='subject'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>主题</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>内容</FormLabel>
                  <FormControl>
                    <Textarea rows={8} {...field} />
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
          <Button type='submit' form='user-mail-form' disabled={mutation.isPending}>
            发送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
