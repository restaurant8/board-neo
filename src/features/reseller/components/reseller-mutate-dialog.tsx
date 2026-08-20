import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
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
  FormDescription,
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
import { MultiCheck } from '@/components/multi-check'
import { fetchPayments } from '@/features/payment/api'
import { fetchPlans } from '@/features/plan/api'
import { filterPlanCandidatesBySite } from '@/features/plan/plan-site'
import {
  getThemeConfig,
  getThemes,
  saveThemeConfig,
} from '@/features/theme/api'
import { ThemeConfigFields } from '@/features/theme/components/theme-config-fields'
import { type ResellerBrand, type ResellerSite, saveResellerSite } from '../api'
import { mergeSiteSettings, siteSettingsToForm } from '../site-settings'

const formSchema = z
  .object({
    name: z.string().min(1, '请输入站点名称'),
    domain: z.string().optional(),
    site_type: z.enum(['reseller', 'brand']),
    owner_email: z.string().email('请输入有效的站长邮箱').or(z.literal('')),
    frontend_theme: z.string().optional(),
    payment_scope: z.enum(['inherit', 'custom']),
    payment_ids: z.array(z.string()),
    trial_plan_id: z
      .string()
      .refine(
        (value) =>
          value === 'inherit' ||
          value === 'none' ||
          (Number.isSafeInteger(Number(value)) && Number(value) > 0),
        '请选择有效的试用套餐'
      ),
    allow_main_plans: z.boolean(),
    reseller_theme_names: z.array(z.string()),
    status: z.boolean(),
    app_name: z.string().optional(),
    app_description: z.string().optional(),
    logo: z.string().optional(),
    app_url: z.string().optional(),
    support_url: z.string().optional(),
    docs_url: z.string().optional(),
    subscribe_domain: z.enum(['main', 'site']),
  })
  .superRefine((values, context) => {
    if (values.site_type === 'reseller' && !values.owner_email) {
      context.addIssue({
        code: 'custom',
        path: ['owner_email'],
        message: '分销站必须指定站长邮箱',
      })
    }
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
  const hasExplicitSubscribeDomain =
    current?.brand?.subscribe_domain === 'main' ||
    current?.brand?.subscribe_domain === 'site'

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      domain: '',
      site_type: 'reseller',
      owner_email: '',
      frontend_theme: '',
      payment_scope: 'inherit',
      payment_ids: [],
      trial_plan_id: 'inherit',
      allow_main_plans: false,
      reseller_theme_names: [],
      status: true,
      app_name: '',
      app_description: '',
      logo: '',
      app_url: '',
      support_url: '',
      docs_url: '',
      subscribe_domain: 'main',
    },
  })
  const siteType = useWatch({ control: form.control, name: 'site_type' })
  const frontendTheme = useWatch({
    control: form.control,
    name: 'frontend_theme',
  })
  const paymentScope = useWatch({
    control: form.control,
    name: 'payment_scope',
  })
  const selectedPaymentIds = useWatch({
    control: form.control,
    name: 'payment_ids',
  })
  const trialPlanId = useWatch({
    control: form.control,
    name: 'trial_plan_id',
  })
  const allowMainPlans = useWatch({
    control: form.control,
    name: 'allow_main_plans',
  })
  const themeScope = current?.id ?? 'new-site'
  const [themeValues, setThemeValues] = useState<Record<string, unknown>>({})
  const [themeConfigDirty, setThemeConfigDirty] = useState(false)

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: fetchPayments,
    enabled: open,
  })
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
    enabled: open,
  })
  const trialPlanCandidates = current?.id
    ? filterPlanCandidatesBySite(plans ?? [], current.id, [
        {
          id: current.id,
          site_type: siteType,
          settings: {
            ...(current.settings ?? {}),
            allow_main_plans: allowMainPlans,
          },
        },
      ])
    : (plans ?? []).filter(
        (plan) =>
          plan.site_id === null && (siteType === 'reseller' || allowMainPlans)
      )
  const paymentOptions = (payments ?? []).map((payment) => ({
    value: String(payment.id),
    label: `${payment.name}（${payment.payment}${payment.enable ? '' : '，已停用'}）`,
  }))
  selectedPaymentIds.forEach((paymentId) => {
    if (!paymentOptions.some((option) => option.value === paymentId)) {
      paymentOptions.push({
        value: paymentId,
        label: `支付方式 #${paymentId}（已删除或不可用）`,
      })
    }
  })
  const selectedTrialPlan = Number.isSafeInteger(Number(trialPlanId))
    ? (plans ?? []).find((plan) => plan.id === Number(trialPlanId))
    : undefined
  const trialPlanUnavailable =
    !!selectedTrialPlan &&
    !trialPlanCandidates.some((plan) => plan.id === selectedTrialPlan.id)

  const clearDisallowedMainTrial = (
    nextSiteType: FormValues['site_type'],
    nextAllowMainPlans: boolean
  ) => {
    const selectedPlan = (plans ?? []).find(
      (plan) => plan.id === Number(form.getValues('trial_plan_id'))
    )
    if (
      nextSiteType === 'brand' &&
      !nextAllowMainPlans &&
      selectedPlan?.site_id === null
    ) {
      form.setValue('trial_plan_id', 'none', { shouldDirty: true })
    }
  }

  const { data: globalThemesData, isLoading: globalThemesLoading } = useQuery({
    queryKey: ['themes', 'global'],
    queryFn: () => getThemes(),
    enabled: open,
  })
  const { data: siteThemesData, isLoading: siteThemesLoading } = useQuery({
    queryKey: ['themes', current?.id],
    queryFn: () => getThemes(current!.id),
    enabled: open && !!current?.id,
  })
  const themesData = current?.id ? siteThemesData : globalThemesData
  const themesLoading = current?.id ? siteThemesLoading : globalThemesLoading
  const resellerThemeOptions = Object.entries(
    globalThemesData?.themes ?? {}
  ).map(([name, theme]) => ({
    value: name,
    label: `${theme.name || name}${theme.version ? ` v${theme.version}` : ''}`,
  }))
  const selectedTheme = frontendTheme
    ? (themesData?.themes[frontendTheme] ?? null)
    : null
  const { data: loadedThemeConfig, isFetching: themeConfigLoading } = useQuery({
    queryKey: ['theme-config', current?.id ?? 'new-site', frontendTheme],
    queryFn: () => getThemeConfig(frontendTheme!, current?.id),
    enabled: open && !!frontendTheme && !!current?.id,
  })
  const configKey = `${themeScope}:${frontendTheme ?? ''}`
  const [loadedConfig, setLoadedConfig] = useState<{
    key: string
    data: Record<string, unknown>
  } | null>(null)

  const [loadedSite, setLoadedSite] = useState<{
    open: boolean
    current?: ResellerSite | null
  } | null>(null)
  if (loadedSite?.open !== open || loadedSite.current !== current) {
    setLoadedSite({ open, current })
    if (open) {
      setThemeValues(
        current?.frontend_theme
          ? (current.theme_config?.[current.frontend_theme] ?? {})
          : {}
      )
      setThemeConfigDirty(false)
      setLoadedConfig(null)
    }
  }

  if (
    loadedThemeConfig &&
    (loadedConfig?.key !== configKey || loadedConfig.data !== loadedThemeConfig)
  ) {
    setLoadedConfig({ key: configKey, data: loadedThemeConfig })
    if (!themeConfigDirty) setThemeValues(loadedThemeConfig)
  }

  useEffect(() => {
    if (open) {
      const businessSettings = siteSettingsToForm(current?.settings)
      form.reset({
        name: current?.name ?? '',
        domain: current?.domain ?? '',
        site_type: current?.site_type ?? 'reseller',
        owner_email: current?.owner_email ?? '',
        frontend_theme: current?.frontend_theme ?? '',
        ...businessSettings,
        status: current ? !!current.status : true,
        app_name: current?.brand?.app_name ?? '',
        app_description: current?.brand?.app_description ?? '',
        logo: current?.brand?.logo ?? '',
        app_url: current?.brand?.app_url ?? '',
        support_url: current?.brand?.support_url ?? '',
        docs_url: current?.brand?.docs_url ?? '',
        subscribe_domain:
          current?.brand?.subscribe_domain === 'main' ||
          current?.brand?.subscribe_domain === 'site'
            ? current.brand.subscribe_domain
            : current?.site_type === 'brand'
              ? 'site'
              : 'main',
      })
    }
  }, [open, current, form])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Only mutate the fields exposed by this dialog. A site may also contain
      // storefront or reseller settings managed elsewhere, which must survive
      // an admin edit here.
      const brand: ResellerBrand = { ...(current?.brand ?? {}) }
      const visibleBrandFields = {
        app_name: values.app_name,
        app_description: values.app_description,
        logo: values.logo,
        app_url: values.app_url,
        support_url: values.support_url,
        docs_url: values.docs_url,
      }
      Object.entries(visibleBrandFields).forEach(([key, value]) => {
        if (value) brand[key] = value
        else delete brand[key]
      })
      if (!hasExplicitSubscribeDomain) delete brand.subscribe_domain
      if (form.getFieldState('subscribe_domain').isDirty) {
        brand.subscribe_domain = values.subscribe_domain
      }
      const newSiteThemeConfig =
        themeConfigDirty && values.frontend_theme
          ? { [values.frontend_theme]: themeValues }
          : null
      const settings = mergeSiteSettings(
        current?.settings,
        values,
        values.site_type
      )
      const siteId = await saveResellerSite({
        id: current?.id,
        name: values.name,
        domain: values.domain ? values.domain.trim() : null,
        status: values.status ? 1 : 0,
        site_type: values.site_type,
        owner_email:
          values.site_type === 'reseller'
            ? values.owner_email || undefined
            : undefined,
        frontend_theme: values.frontend_theme || null,
        ...(!current?.id ? { theme_config: newSiteThemeConfig } : {}),
        settings,
        brand,
      })

      if (current?.id && values.frontend_theme && themeConfigDirty) {
        await saveThemeConfig(values.frontend_theme, themeValues, siteId)
      }

      return siteId
    },
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['reseller-sites'] })
      queryClient.invalidateQueries({ queryKey: ['themes'] })
      queryClient.invalidateQueries({ queryKey: ['theme-config'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <DialogHeader className='border-b bg-muted/20 px-6 pt-6 pb-4'>
          <DialogTitle className='font-mono text-lg tracking-tight'>
            {isEdit ? '编辑站点' : '添加站点'}
          </DialogTitle>
          <DialogDescription className='font-mono text-xs opacity-70'>
            品牌站由平台自营；分销站由指定站长经营。两种站点均可使用独立域名、套餐和主题。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='reseller-form'
            onSubmit={form.handleSubmit((values) => {
              const selectedTrialPlanId = Number(values.trial_plan_id)
              if (
                Number.isSafeInteger(selectedTrialPlanId) &&
                selectedTrialPlanId > 0 &&
                !trialPlanCandidates.some(
                  (plan) => plan.id === selectedTrialPlanId
                )
              ) {
                form.setError('trial_plan_id', {
                  message: '该套餐不属于本站当前可用范围，请重新选择',
                })
                return
              }
              mutation.mutate(values)
            })}
          >
            <div className='max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4 font-mono'>
              <div className='grid gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                        站点名称
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
                  name='site_type'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                        站点类型
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value)
                          clearDisallowedMainTrial(
                            value as FormValues['site_type'],
                            form.getValues('allow_main_plans')
                          )
                          if (
                            !hasExplicitSubscribeDomain &&
                            !form.getFieldState('subscribe_domain').isDirty
                          ) {
                            form.setValue(
                              'subscribe_domain',
                              value === 'brand' ? 'site' : 'main',
                              { shouldDirty: false }
                            )
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className='h-9 font-mono text-xs'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='brand'>
                            品牌站（平台自营）
                          </SelectItem>
                          <SelectItem value='reseller'>
                            分销站（站长经营）
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className='text-[10px]'>
                        品牌站使用独立商业配置，不参与分销结算。
                      </FormDescription>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
              </div>
              {siteType === 'reseller' && (
                <FormField
                  control={form.control}
                  name='owner_email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
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
                        分销站必须指定站长；编辑时保持原邮箱即可。
                      </FormDescription>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name='domain'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
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
                <p className='mb-3 text-[11px] tracking-wider text-muted-foreground uppercase'>
                  品牌覆盖（选填，仅在该站点域名下生效）
                </p>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='app_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                          站点名称
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className='h-9 font-mono text-xs' />
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
                        <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                          Logo URL
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className='h-9 font-mono text-xs' />
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
                      <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
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
                        <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
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
                        <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
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
                <FormField
                  control={form.control}
                  name='subscribe_domain'
                  render={({ field }) => (
                    <FormItem className='mt-4'>
                      <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                        订阅域名
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className='h-9 font-mono text-xs'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='site'>
                            使用当前站点域名（品牌站推荐）
                          </SelectItem>
                          <SelectItem value='main'>复用主站订阅域名</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className='text-[10px]'>
                        当前站点域名隔离品牌入口；复用主站会向用户暴露主站订阅域。
                      </FormDescription>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
              </div>

              <div className='rounded-md border border-dashed p-3'>
                <p className='mb-3 text-[11px] tracking-wider text-muted-foreground uppercase'>
                  商业设置
                </p>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='payment_scope'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                          支付方式
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={paymentsLoading}
                        >
                          <FormControl>
                            <SelectTrigger className='h-9 font-mono text-xs'>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='inherit'>
                              继承全部支付方式
                            </SelectItem>
                            <SelectItem value='custom'>
                              使用本站白名单
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className='text-[10px]'>
                          继承模式会自动开放未来新增的支付方式。
                        </FormDescription>
                        <FormMessage className='text-[10px]' />
                      </FormItem>
                    )}
                  />

                  {siteType === 'brand' && (
                    <FormField
                      control={form.control}
                      name='allow_main_plans'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                            开放主站套餐
                          </FormLabel>
                          <div className='flex h-9 items-center'>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked)
                                  clearDisallowedMainTrial('brand', checked)
                                }}
                              />
                            </FormControl>
                          </div>
                          <FormDescription className='text-[10px]'>
                            关闭时，品牌站只展示和分配本站专属套餐。
                          </FormDescription>
                          <FormMessage className='text-[10px]' />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {paymentScope === 'custom' && (
                  <FormField
                    control={form.control}
                    name='payment_ids'
                    render={({ field }) => (
                      <FormItem className='mt-4'>
                        <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                          本站支付白名单
                        </FormLabel>
                        <MultiCheck
                          options={paymentOptions}
                          selected={field.value}
                          onChange={field.onChange}
                          empty={
                            paymentsLoading
                              ? '加载支付方式中...'
                              : '暂无可选支付方式'
                          }
                        />
                        <FormDescription className='text-[10px]'>
                          可以显式留空；留空表示本站不开放任何在线支付方式。
                        </FormDescription>
                        <FormMessage className='text-[10px]' />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='trial_plan_id'
                  render={({ field }) => (
                    <FormItem className='mt-4'>
                      <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                        注册试用套餐
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={plansLoading}
                      >
                        <FormControl>
                          <SelectTrigger className='h-9 font-mono text-xs'>
                            <SelectValue
                              placeholder={
                                plansLoading ? '加载套餐中...' : '选择试用策略'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='inherit'>
                            {siteType === 'brand'
                              ? '使用品牌默认（不提供试用）'
                              : '继承全局试用套餐'}
                          </SelectItem>
                          <SelectItem value='none'>关闭本站试用</SelectItem>
                          {trialPlanUnavailable && selectedTrialPlan && (
                            <SelectItem
                              value={String(selectedTrialPlan.id)}
                              disabled
                            >
                              {selectedTrialPlan.name}（当前策略不可用）
                            </SelectItem>
                          )}
                          {trialPlanCandidates.map((plan) => (
                            <SelectItem key={plan.id} value={String(plan.id)}>
                              {plan.name}
                              {plan.site_id === null
                                ? '（主站）'
                                : '（本站专属）'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className='text-[10px]'>
                        仅可选择当前商业策略允许分配给本站用户的套餐。
                      </FormDescription>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />
              </div>

              <div className='rounded-md border border-dashed p-3'>
                <p className='mb-3 text-[11px] tracking-wider text-muted-foreground uppercase'>
                  站点主题
                </p>
                {siteType === 'reseller' && (
                  <FormField
                    control={form.control}
                    name='reseller_theme_names'
                    render={({ field }) => (
                      <FormItem className='mb-4'>
                        <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                          站长可用主题
                        </FormLabel>
                        <MultiCheck
                          options={resellerThemeOptions}
                          selected={field.value}
                          onChange={field.onChange}
                          empty={
                            globalThemesLoading
                              ? '加载主题中...'
                              : '当前没有已安装主题'
                          }
                        />
                        <FormDescription className='text-[10px]'>
                          仅勾选的主题会出现在该站长的主题外观中；全部不选表示不开放主题选择。
                        </FormDescription>
                        <FormMessage className='text-[10px]' />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name='frontend_theme'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
                        前台主题
                      </FormLabel>
                      <Select
                        value={field.value || 'inherit'}
                        onValueChange={(value) => {
                          field.onChange(value === 'inherit' ? '' : value)
                          setThemeValues({})
                          setThemeConfigDirty(false)
                          setLoadedConfig(null)
                        }}
                        disabled={themesLoading}
                      >
                        <FormControl>
                          <SelectTrigger className='h-9 font-mono text-xs'>
                            <SelectValue
                              placeholder={
                                themesLoading ? '加载主题中...' : '选择主题'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='inherit'>
                            继承全局主题
                            {globalThemesData?.active
                              ? `（${globalThemesData.active}）`
                              : ''}
                          </SelectItem>
                          {Object.entries(themesData?.themes ?? {}).map(
                            ([themeKey, theme]) => (
                              <SelectItem key={themeKey} value={themeKey}>
                                {theme.name}
                                {theme.version ? ` v${theme.version}` : ''}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className='text-[10px]'>
                        选择独立主题后，该站点的主题参数与全局配置分别保存。
                      </FormDescription>
                      <FormMessage className='text-[10px]' />
                    </FormItem>
                  )}
                />

                {frontendTheme && selectedTheme && (
                  <details className='mt-4 rounded-md border bg-muted/10 p-3'>
                    <summary className='cursor-pointer text-xs font-semibold select-none'>
                      配置 {selectedTheme.name} 的站点专属参数
                    </summary>
                    <div className='mt-4'>
                      {themeConfigLoading ? (
                        <div className='py-6 text-center text-xs text-muted-foreground'>
                          加载主题配置中...
                        </div>
                      ) : (
                        <ThemeConfigFields
                          theme={selectedTheme}
                          values={themeValues}
                          onChange={(fieldName, value) => {
                            setThemeValues((previous) => ({
                              ...previous,
                              [fieldName]: value,
                            }))
                            setThemeConfigDirty(true)
                          }}
                          className='grid gap-4'
                        />
                      )}
                    </div>
                  </details>
                )}

                {frontendTheme && !themesLoading && !selectedTheme && (
                  <p className='mt-3 text-xs text-destructive'>
                    当前主题不存在，请重新选择已安装主题。
                  </p>
                )}
              </div>

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                    <FormLabel className='text-[11px] tracking-wider text-muted-foreground uppercase'>
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
                  disabled={
                    mutation.isPending ||
                    paymentsLoading ||
                    plansLoading ||
                    globalThemesLoading
                  }
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
