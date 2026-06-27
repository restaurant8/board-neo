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
import { Textarea } from '@/components/ui/textarea'
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
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑文章' : '新建文章'}</DialogTitle>
          <DialogDescription>填写知识库文章内容后保存。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='knowledge-form'
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
                    <Input placeholder='如 如何导入订阅' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='category'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分类</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='输入或沿用已有分类'
                        list='knowledge-categories'
                        {...field}
                      />
                    </FormControl>
                    <datalist id='knowledge-categories'>
                      {(categories ?? []).map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='language'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>语言</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='选择语言' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {KNOWLEDGE_LANGUAGES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='body'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>内容</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={10}
                      placeholder='支持 HTML/Markdown'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='show'
              render={({ field }) => (
                <FormItem className='flex items-center gap-2'>
                  <FormLabel>显示</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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
          <Button type='submit' form='knowledge-form' disabled={mutation.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
