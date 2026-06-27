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
import { Switch } from '@/components/ui/switch'
import { MarkdownEditor } from '@/components/markdown-editor'
import {
  KNOWLEDGE_LANGUAGES,
  type KnowledgeListItem,
  fetchKnowledgeCategories,
  fetchKnowledgeDetail,
  saveKnowledge,
} from '../api'

const formSchema = z.object({
  title: z.string().min(1, '请输入标题'),
  category: z.string().min(1, '请输入分类'),
  language: z.string().min(1, '请选择语言'),
  body: z.string().min(1, '请输入内容'),
  show: z.boolean(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: KnowledgeListItem | null
}

export function KnowledgeMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['knowledge-categories'],
    queryFn: fetchKnowledgeCategories,
    enabled: open,
  })

  // 列表项不含 body/language，编辑时拉取完整详情。
  const { data: detail } = useQuery({
    queryKey: ['knowledge', current?.id],
    queryFn: () => fetchKnowledgeDetail(current!.id),
    enabled: open && isEdit,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      category: '',
      language: 'zh-CN',
      body: '',
      show: true,
    },
  })

  useEffect(() => {
    if (!open) return
    if (isEdit) {
      if (detail) {
        form.reset({
          title: detail.title ?? '',
          category: detail.category ?? '',
          language: detail.language ?? 'zh-CN',
          body: detail.body ?? '',
          show: detail.show,
        })
      }
    } else {
      form.reset({
        title: '',
        category: '',
        language: 'zh-CN',
        body: '',
        show: true,
      })
    }
  }, [open, isEdit, detail, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      saveKnowledge({
        id: current?.id,
        title: values.title,
        category: values.category,
        language: values.language,
        body: values.body,
        show: values.show,
      }),
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['knowledge-list'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] })
      if (current?.id)
        queryClient.invalidateQueries({ queryKey: ['knowledge', current.id] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <DialogHeader className='border-b bg-muted/20 px-6 pb-4 pt-6'>
          <DialogTitle className='font-mono text-lg tracking-tight'>
            {isEdit ? '编辑知识' : '添加知识'}
          </DialogTitle>
          <DialogDescription className='font-mono text-xs opacity-70'>
            发布或编辑知识库文章，支持多语言和 Markdown 格式。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='knowledge-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          >
            <div className='max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4 font-mono text-xs'>
              <div className='grid gap-4 md:grid-cols-2'>
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
                          placeholder='请输入知识标题'
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
                  name='category'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                        分类
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='请输入分类，分类将会自动归类'
                          list='knowledge-categories'
                          {...field}
                          className='h-9 font-mono text-xs'
                        />
                      </FormControl>
                      <datalist id='knowledge-categories'>
                        {(categories ?? []).map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
              </div>
              <div className='grid gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='language'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                        语言
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className='h-9 font-mono text-xs'>
                            <SelectValue placeholder='请选择语言' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {KNOWLEDGE_LANGUAGES.map((l) => (
                            <SelectItem
                              key={l.value}
                              value={l.value}
                              className='cursor-pointer font-mono text-xs'
                            >
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                name='body'
                render={({ field }) => (
                  <FormItem className='space-y-2'>
                    <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                      内容
                    </FormLabel>
                    <FormControl>
                      <MarkdownEditor
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        height={400}
                        placeholder='支持 HTML / Markdown'
                      />
                    </FormControl>
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
