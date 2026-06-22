import { useEffect } from 'react'
import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { type DnsConfig, saveDnsConfig } from '../api'

const formSchema = z.object({
  api_token: z.string().optional(),
  proxied: z.boolean(),
  ttl: z.coerce.number().int().min(1).max(86400),
  zones: z.array(
    z.object({
      zone_id: z.string(),
      remark: z.string().optional(),
    })
  ),
})
type FormValues = z.infer<typeof formSchema>

type Props = {
  config: DnsConfig | undefined
  isLoading: boolean
}

export function DnsConfigForm({ config, isLoading }: Props) {
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      api_token: '',
      proxied: false,
      ttl: 1,
      zones: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'zones',
  })

  useEffect(() => {
    if (config) {
      form.reset({
        api_token: config.api_token ?? '',
        proxied: !!config.proxied,
        ttl: config.ttl || 1,
        zones: config.zones?.length ? config.zones : [],
      })
    }
  }, [config, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      saveDnsConfig({
        api_token: values.api_token?.trim() || '',
        proxied: values.proxied,
        ttl: values.ttl,
        zones: values.zones
          .map((z) => ({
            zone_id: z.zone_id.trim(),
            remark: (z.remark ?? '').trim(),
          }))
          .filter((z) => z.zone_id),
      }),
    onSuccess: () => {
      toast.success('已保存全局配置')
      // 节点列表的 zone 下拉依赖最新 zones。
      queryClient.invalidateQueries({ queryKey: ['dns-config'] })
    },
    onError: handleServerError,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>全局配置</CardTitle>
        <CardDescription>
          配置 Cloudflare API Token 和 Zone；每个节点再单独开启同步。Token
          建议只授予目标 Zone 的 DNS 编辑权限。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className='grid gap-5'
          >
            <FormField
              control={form.control}
              name='api_token'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cloudflare API Token</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      autoComplete='off'
                      placeholder='Cloudflare API Token'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid gap-2'>
              <div className='flex items-center justify-between'>
                <FormLabel>Cloudflare Zone</FormLabel>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => append({ zone_id: '', remark: '' })}
                >
                  <Plus className='size-4' /> 添加 Zone
                </Button>
              </div>
              {fields.length === 0 ? (
                <p className='text-xs text-muted-foreground'>
                  暂无 Zone，点击「添加 Zone」新增。
                </p>
              ) : null}
              {fields.map((f, index) => (
                <div
                  key={f.id}
                  className='grid grid-cols-[1fr_2fr_auto] items-start gap-2'
                >
                  <FormField
                    control={form.control}
                    name={`zones.${index}.remark`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder='备注' {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`zones.${index}.zone_id`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder='Cloudflare Zone ID' {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => remove(index)}
                  >
                    <Trash2 className='size-4 text-destructive' />
                  </Button>
                </div>
              ))}
            </div>

            <div className='flex flex-wrap items-end gap-8'>
              <FormField
                control={form.control}
                name='proxied'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2'>
                    <FormLabel>开启 Cloudflare 代理（橙云）</FormLabel>
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
                name='ttl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TTL（秒，1=自动）</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        className='w-32'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <Button
                type='submit'
                disabled={mutation.isPending || isLoading}
              >
                保存全局配置
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
