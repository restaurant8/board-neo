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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type Notice, saveNotice } from '../api'

const formSchema = z.object({
  title: z.string().min(1, '请输入标题'),
  content: z.string().min(1, '请输入内容'),
  img_url: z.string().optional(),
  tags: z.string().optional(), // comma separated in the form
  show: z.boolean(),
  popup: z.boolean(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: Notice | null
}

export function NoticeMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      img_url: '',
      tags: '',
      show: true,
      popup: false,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        title: current?.title ?? '',
        content: current?.content ?? '',
        img_url: current?.img_url ?? '',
        tags: (current?.tags ?? []).join(','),
        show: current ? !!current.show : true,
        popup: current ? !!current.popup : false,
      })
    }
  }, [open, current, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      saveNotice({
        id: current?.id,
        title: values.title,
        content: values.content,
        img_url: values.img_url || null,
        tags: values.tags
          ? values.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        show: values.show ? 1 : 0,
        popup: values.popup ? 1 : 0,
      }),
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <DialogHeader className='border-b bg-muted/20 px-6 pb-4 pt-6'>
          <DialogTitle className='font-mono text-lg tracking-tight'>
            {isEdit ? '编辑公告' : '添加公告'}
          </DialogTitle>
          <DialogDescription className='font-mono text-xs opacity-70'>
            发布或编辑系统公告，支持 Markdown 格式。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='notice-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          >
            <div className='max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4 font-mono'>
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                      标题
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='请输入公告标题'
                        {...field}
                        className='h-9 font-mono text-xs'
                      />
                    </FormControl>
                    <FormMessage className='text-[10px]' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  <FormItem className='space-y-2'>
                    <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                      公告内容
                    </FormLabel>
                    <FormControl>
                      <div className='overflow-hidden rounded-md border border-input focus-within:ring-1 focus-within:ring-ring'>
                        <Textarea
                          rows={14}
                          placeholder='请输入公告内容，支持 HTML / Markdown'
                          {...field}
                          className='border-none font-mono text-xs focus-visible:ring-0'
                        />
                      </div>
                    </FormControl>
                    <FormMessage className='text-[10px]' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='img_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                      公告背景
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        placeholder='请输入公告背景图片URL'
                        {...field}
                        value={field.value || ''}
                        className='h-9 font-mono text-xs'
                      />
                    </FormControl>
                    <FormMessage className='text-[10px]' />
                  </FormItem>
                )}
              />
              <div className='grid gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='tags'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                        节点标签
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='输入后用英文逗号分隔，如 活动,公告'
                          {...field}
                          className='h-9 w-full font-mono text-xs'
                        />
                      </FormControl>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='show'
                  render={({ field }) => (
                    <FormItem className='flex flex-col'>
                      <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                        显示
                      </FormLabel>
                      <div className='flex h-9 items-center'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='popup'
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                    <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                      弹窗
                    </FormLabel>
                    <div className='flex h-9 items-center'>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className='text-[10px]' />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className='border-t bg-muted/20 px-6 py-4'>
              <div className='flex w-full items-center justify-end gap-3'>
                <Button
                  type='button'
                  variant='ghost'
                  className='h-8 px-4 font-mono text-xs font-bold'
                  onClick={() => onOpenChange(false)}
                  disabled={mutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type='submit'
                  className='h-8 px-8 font-mono text-xs font-bold'
                  disabled={mutation.isPending}
                >
                  提交
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
