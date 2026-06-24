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
  /** 当前多选的用户 id；非空时优先按选中发送。 */
  selectedIds?: number[]
}

export function UserSendMailDialog({
  open,
  onOpenChange,
  filter,
  selectedIds,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { subject: '', content: '' },
  })

  const hasSelection = !!selectedIds && selectedIds.length > 0
  const hasFilter = !!filter && filter.length > 0
  const scope: 'selected' | 'filtered' | 'all' = hasSelection
    ? 'selected'
    : hasFilter
      ? 'filtered'
      : 'all'

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      sendMail({
        subject: values.subject,
        content: values.content,
        scope,
        user_ids: scope === 'selected' ? selectedIds : undefined,
        filter: scope === 'filtered' ? filter : undefined,
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
          <DialogTitle>发送邮件</DialogTitle>
          <DialogDescription>
            向所选或已筛选的用户发送邮件。发送对象：
            {scope === 'selected'
              ? `选中的 ${selectedIds!.length} 个用户`
              : scope === 'filtered'
                ? '当前筛选结果'
                : '全部用户'}
            。支持占位符如 {'{user.email}'}。
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
                    <Input placeholder='如 套餐到期提醒' {...field} />
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
                    <Textarea
                      rows={8}
                      placeholder={'如 您好 {user.email}，您的套餐即将到期...'}
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
          <Button type='submit' form='user-mail-form' disabled={mutation.isPending}>
            发送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
