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
import { Switch } from '@/components/ui/switch'
import { type ResellerSite, saveResellerSite } from '../api'

const formSchema = z.object({
  name: z.string().min(1, '请输入分站名称'),
  domain: z.string().optional(),
  owner_email: z.string().email('请输入有效的站长邮箱').or(z.literal('')),
  status: z.boolean(),
  app_name: z.string().optional(),
  app_description: z.string().optional(),
  logo: z.string().optional(),
  app_url: z.string().optional(),
  support_url: z.string().optional(),
  docs_url: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: ResellerSite | null
}

export function ResellerMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      domain: '',
      owner_email: '',
      status: true,
      app_name: '',
      app_description: '',
      logo: '',
      app_url: '',
      support_url: '',
      docs_url: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: current?.name ?? '',
        domain: current?.domain ?? '',
        owner_email: current?.owner_email ?? '',
        status: current ? !!current.status : true,
        app_name: current?.brand?.app_name ?? '',
        app_description: current?.brand?.app_description ?? '',
        logo: current?.brand?.logo ?? '',
        app_url: current?.brand?.app_url ?? '',
        support_url: current?.brand?.support_url ?? '',
        docs_url: current?.brand?.docs_url ?? '',
      })
    }
  }, [open, current, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const brand: Record<string, string> = {}
      if (values.app_name) brand.app_name = values.app_name
      if (values.app_description) brand.app_description = values.app_description
      if (values.logo) brand.logo = values.logo
      if (values.app_url) brand.app_url = values.app_url
      if (values.support_url) brand.support_url = values.support_url
      if (values.docs_url) brand.docs_url = values.docs_url
      return saveResellerSite({
        id: current?.id,
        name: values.name,
        domain: values.domain ? values.domain.trim() : null,
        status: values.status ? 1 : 0,
        owner_email: values.owner_email || undefined,
        brand,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['reseller-sites'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <DialogHeader className='border-b bg-muted/20 px-6 pb-4 pt-6'>
          <DialogTitle className='font-mono text-lg tracking-tight'>
            {isEdit ? '编辑分站' : '添加分站'}
          </DialogTitle>
          <DialogDescription className='font-mono text-xs opacity-70'>
            绑定独立域名后，该域名注册的用户与订单将自动归属此分站。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='reseller-form'
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          >
            <div className='max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4 font-mono'>
              <div className='grid gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                        分站名称
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='如：Shop1 自营站'
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
                  name='owner_email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                        站长邮箱
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='已注册用户的邮箱'
                          {...field}
                          className='h-9 font-mono text-xs'
                        />
                      </FormControl>
                      <FormDescription className='text-[10px]'>
                        编辑时留空则不修改站长。
                      </FormDescription>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='domain'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                      绑定域名
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='如：shop1.example.com（留空表示暂不绑定）'
                        {...field}
                        className='h-9 font-mono text-xs'
                      />
                    </FormControl>
                    <FormMessage className='text-[10px]' />
                  </FormItem>
                )}
              />

              <div className='rounded-md border border-dashed p-3'>
                <p className='mb-3 text-[11px] uppercase tracking-wider text-muted-foreground'>
                  品牌覆盖（选填，仅在该分站域名下生效）
                </p>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='app_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                          站点名称
                        </FormLabel>
                        <FormControl>
                          <Input
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
                    name='logo'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                          Logo URL
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className='h-9 font-mono text-xs'
                          />
                        </FormControl>
                        <FormMessage className='text-[10px]' />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name='app_description'
                  render={({ field }) => (
                    <FormItem className='mt-4'>
                      <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                        站点描述
                      </FormLabel>
                      <FormControl>
                        <Input {...field} className='h-9 font-mono text-xs' />
                      </FormControl>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
                <div className='mt-4 grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='support_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                          客服链接
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder='https://t.me/xxx'
                            className='h-9 font-mono text-xs'
                          />
                        </FormControl>
                        <FormMessage className='text-[10px]' />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='docs_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                          文档/教程链接
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className='h-9 font-mono text-xs' />
                        </FormControl>
                        <FormMessage className='text-[10px]' />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                    <FormLabel className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                      启用
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
