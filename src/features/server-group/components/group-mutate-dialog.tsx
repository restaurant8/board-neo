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
import { fetchResellerSites } from '@/features/reseller/api'
import { type ServerGroup, saveServerGroup } from '../api'

const formSchema = z.object({
  name: z.string().min(1, '请输入权限组名称'),
  site_id: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: ServerGroup | null
}

export function GroupMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', site_id: '' },
  })

  const { data: sites } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: current?.name ?? '',
        site_id: current?.site_id != null ? String(current.site_id) : '',
      })
    }
  }, [open, current, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      saveServerGroup({
        id: current?.id,
        name: values.name,
        site_id: values.site_id ? Number(values.site_id) : null,
      }),
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['server-groups'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑权限组' : '新建权限组'}</DialogTitle>
          <DialogDescription>
            权限组用于控制用户可访问的节点。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='group-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder='如 VIP会员 或 普通用户' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='site_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>归属站点</FormLabel>
                  <Select
                    value={field.value || 'main'}
                    onValueChange={(value) =>
                      field.onChange(value === 'main' ? '' : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='选择归属站点' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='main'>主站</SelectItem>
                      {(sites ?? []).map((site) => (
                        <SelectItem key={site.id} value={String(site.id)}>
                          {site.name}
                          {site.site_type === 'brand'
                            ? '（品牌站）'
                            : '（分销站）'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          <Button type='submit' form='group-form' disabled={mutation.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
