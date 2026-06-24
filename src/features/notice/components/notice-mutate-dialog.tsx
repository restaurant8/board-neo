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
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑公告' : '新建公告'}</DialogTitle>
          <DialogDescription>填写公告信息后保存。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='notice-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-4'
          >
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标题</FormLabel>
                  <FormControl>
                    <Input placeholder='请输入公告标题' {...field} />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    公告标题，显示在公告列表与弹窗顶部。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='content'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公告内容</FormLabel>
                  <FormControl>
                    <Textarea rows={6} placeholder='请输入公告内容，支持 HTML / Markdown' {...field} />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    公告正文，支持 HTML / Markdown 富文本。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='img_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公告背景</FormLabel>
                  <FormControl>
                    <Input placeholder='请输入公告背景图片URL' {...field} />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    公告背景图片地址（可选），留空则不显示背景图。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标签（逗号分隔）</FormLabel>
                  <FormControl>
                    <Input placeholder='活动,公告' {...field} />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    公告标签，多个标签用英文逗号分隔。
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='flex gap-8'>
              <FormField
                control={form.control}
                name='show'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel title='开启后该公告将在用户端展示。'>显示</FormLabel>
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
                name='popup'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel title='开启后用户进入站点时将以弹窗形式提示该公告。'>弹窗</FormLabel>
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
          <Button
            type='submit'
            form='notice-form'
            disabled={mutation.isPending}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
