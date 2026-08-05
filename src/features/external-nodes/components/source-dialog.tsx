import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type ServerGroup } from '@/features/server-group/api'
import {
  type ExternalAudienceMode,
  type ExternalAudienceUser,
  type ExternalDnsZone,
  type ExternalNodeRule,
  type ExternalNodeSource,
  type ExternalNodeSourcePayload,
  type ExternalPullProxySettings,
  saveExternalNodeSource,
  searchExternalAudienceUsers,
  testExternalPullProxy,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: ExternalNodeSource | null
  groups: ServerGroup[]
  userAgentPresets: Record<string, string>
  dnsZones: ExternalDnsZone[]
  pullProxy: ExternalPullProxySettings
}

/**
 * 逐节点必定不同的模板变量，模板必须至少含一个。
 * {host_label} 与 {host} 不算：同一台上游主机的多个节点会取到相同值。
 */
const NAME_TEMPLATE_DISTINGUISHING = ['{name}', '{index}']

const AUDIENCE_MODE_OPTIONS: Array<{
  value: ExternalAudienceMode
  label: string
  hint: string
}> = [
  {
    value: 'group',
    label: '按权限组',
    hint: '所选权限组里的全部用户都会收到该来源的节点。',
  },
  {
    value: 'user',
    label: '按指定用户',
    hint: '只有下面选中的用户会收到，和权限组无关。',
  },
  {
    value: 'group_or_user',
    label: '权限组 + 指定用户',
    hint: '权限组内的用户，加上单独指定的用户，取并集。',
  },
]

const EMPTY_RULE: ExternalNodeRule = {
  from: '',
  to: '',
  mode: 'text',
  case_sensitive: true,
}

const defaultForm = (
  current?: ExternalNodeSource | null
): ExternalNodeSourcePayload => ({
  id: current?.id,
  name: current?.name ?? '',
  type: current?.type ?? 'subscription',
  subscription_mode: current?.subscription_mode ?? 'url',
  subscription_url: current?.subscription_url ?? '',
  manual_uri: current?.manual_uri ?? '',
  xboard_base_url: current?.xboard_base_url ?? '',
  xboard_email: current?.xboard_email ?? '',
  xboard_password: '',
  user_agent: current?.user_agent ?? 'clash-verge-rev',
  proxy_mode: current?.proxy_mode ?? 'inherit',
  proxy_host: current?.proxy_host ?? '',
  proxy_port: current?.proxy_port ?? 1080,
  proxy_username: current?.proxy_username ?? '',
  proxy_password: '',
  group_ids: current?.group_ids.map(Number) ?? [],
  audience_mode: current?.audience_mode ?? 'group',
  user_ids: current?.user_ids ?? [],
  enabled: current?.enabled ?? true,
  dns_alias_enabled: current?.dns_alias_enabled ?? false,
  dns_cloudflare_zone_id: current?.dns_cloudflare_zone_id ?? '',
  dns_alias_domain: current?.dns_alias_domain ?? '',
  auto_sync: current?.auto_sync ?? false,
  sync_interval_minutes: current?.sync_interval_minutes ?? 60,
  sort: current?.sort ?? 0,
  name_prefix: current?.name_prefix ?? '',
  name_suffix: current?.name_suffix ?? '',
  name_template: current?.name_template ?? '',
  name_override: current?.name_override ?? '',
  host_override: current?.host_override ?? '',
  name_rules: current?.name_rules ?? [],
  host_label_mappings: current?.host_label_mappings ?? [],
  host_rules: current?.host_rules ?? [],
})

export function ExternalNodeSourceDialog({
  open,
  onOpenChange,
  current,
  groups,
  userAgentPresets,
  dnsZones,
  pullProxy,
}: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ExternalNodeSourcePayload>(() =>
    defaultForm(current)
  )
  const [audienceUsers, setAudienceUsers] = useState<ExternalAudienceUser[]>(
    () => current?.audience_users ?? []
  )
  const [userKeyword, setUserKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')

  const targetsGroups =
    form.audience_mode === 'group' || form.audience_mode === 'group_or_user'
  const targetsUsers =
    form.audience_mode === 'user' || form.audience_mode === 'group_or_user'

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(userKeyword), 300)
    return () => window.clearTimeout(timer)
  }, [userKeyword])

  const userSearch = useQuery({
    queryKey: ['external-audience-user-search', debouncedKeyword],
    queryFn: () =>
      searchExternalAudienceUsers({ keyword: debouncedKeyword.trim() }),
    enabled: targetsUsers && debouncedKeyword.trim().length > 0,
    staleTime: 30_000,
  })

  const selectedPreset = useMemo(() => {
    return Object.values(userAgentPresets).includes(form.user_agent)
      ? form.user_agent
      : '__custom'
  }, [form.user_agent, userAgentPresets])

  const mutation = useMutation({
    mutationFn: saveExternalNodeSource,
    onSuccess: (result) => {
      if (result.sync.queued) {
        toast.success('已保存，节点同步任务已在后台开始')
      } else {
        toast.success(
          `已保存并同步 ${result.sync.node_count} 个节点${result.sync.skipped_count > 0 ? `，跳过 ${result.sync.skipped_count} 个异常节点` : ''}`
        )
      }
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const proxyTestMutation = useMutation({
    mutationFn: testExternalPullProxy,
    onSuccess: (result) => {
      toast.success(
        `${result.via_proxy ? '代理' : '直连'}拉取成功，收到 ${formatBytes(result.bytes)}，耗时 ${result.elapsed_ms}ms`
      )
    },
    onError: handleServerError,
  })

  const validateProxy = () => {
    if (form.type !== 'subscription' || form.proxy_mode !== 'socks5') {
      return true
    }
    if (!form.proxy_host?.trim()) {
      toast.error('请输入 SOCKS5 代理地址')
      return false
    }
    if (!form.proxy_port || form.proxy_port < 1 || form.proxy_port > 65535) {
      toast.error('请输入有效的 SOCKS5 代理端口')
      return false
    }
    if (!!form.proxy_username?.trim() !== !!form.proxy_password?.trim()) {
      const keepingExistingPassword =
        !!current?.proxy_password_configured &&
        form.proxy_username?.trim() === current.proxy_username
      if (!keepingExistingPassword) {
        toast.error('SOCKS5 代理用户名和密码必须同时填写')
        return false
      }
    }
    return true
  }

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('请输入来源名称')
      return
    }
    if (!form.user_agent.trim()) {
      toast.error('请输入拉取订阅使用的 User-Agent')
      return
    }
    if (!validateProxy()) return
    if (targetsGroups && form.group_ids.length === 0) {
      toast.error('至少选择一个权限组')
      return
    }
    if (targetsUsers && audienceUsers.length === 0) {
      toast.error('至少选择一个下发用户')
      return
    }
    if (form.type === 'manual' && !form.manual_uri?.trim()) {
      toast.error('请输入节点链接')
      return
    }
    if (
      form.type === 'subscription' &&
      form.subscription_mode === 'url' &&
      !form.subscription_url?.trim()
    ) {
      toast.error('请输入订阅地址')
      return
    }
    if (
      form.type === 'subscription' &&
      form.subscription_mode === 'xboard_account'
    ) {
      if (!form.xboard_base_url?.trim() || !form.xboard_email?.trim()) {
        toast.error('请输入 Xboard 面板地址和登录邮箱')
        return
      }
      const keepingPassword =
        current?.subscription_mode === 'xboard_account' &&
        current.xboard_password_configured
      if (!form.xboard_password?.trim() && !keepingPassword) {
        toast.error('请输入上游 Xboard 登录密码')
        return
      }
    }
    if (
      form.type === 'subscription' &&
      form.subscription_mode === 'xboard_account' &&
      !form.xboard_base_url?.trim().startsWith('https://')
    ) {
      toast.error('Xboard 面板地址必须使用 HTTPS')
      return
    }
    if (
      form.name_rules.some((rule) => !rule.from.trim()) ||
      form.host_label_mappings.some(
        (rule) => !rule.from.trim() || !rule.to.trim()
      ) ||
      form.host_rules.some((rule) => !rule.from.trim() || !rule.to.trim())
    ) {
      toast.error('请补全或删除空的替换规则')
      return
    }
    if (
      form.name_template?.trim() &&
      !NAME_TEMPLATE_DISTINGUISHING.some((token) =>
        form.name_template!.includes(token)
      )
    ) {
      toast.error(
        `名称模板至少需要包含 ${NAME_TEMPLATE_DISTINGUISHING.join(' / ')} 之一，否则节点会重名`
      )
      return
    }
    if (
      form.host_label_mappings.length > 0 &&
      !form.name_template?.includes('{host_label}')
    ) {
      toast.error('使用地址前缀映射时，名称模板必须包含 {host_label}')
      return
    }
    if (
      form.dns_alias_enabled &&
      (!form.dns_cloudflare_zone_id || !form.dns_alias_domain)
    ) {
      toast.error('请先选择已配置根域名的 Cloudflare Zone')
      return
    }

    mutation.mutate({
      ...form,
      async_sync: true,
      user_ids: audienceUsers.map((user) => user.id),
      name: form.name.trim(),
      user_agent: form.user_agent.trim(),
      subscription_url: form.subscription_url?.trim(),
      manual_uri: form.manual_uri?.trim(),
      xboard_base_url: form.xboard_base_url?.trim().replace(/\/+$/, ''),
      xboard_email: form.xboard_email?.trim(),
      name_template: form.name_template?.trim(),
      name_rules: form.name_rules.map((rule) => ({
        from: rule.from,
        to: rule.to,
        mode: rule.mode ?? 'text',
        case_sensitive: rule.case_sensitive ?? true,
      })),
      host_rules: form.host_rules.map((rule) => ({
        from: rule.from.trim(),
        to: rule.to.trim(),
      })),
    })
  }

  const setRules = (
    key: 'name_rules' | 'host_label_mappings' | 'host_rules',
    rules: ExternalNodeRule[]
  ) => setForm((value) => ({ ...value, [key]: rules }))

  const testProxy = () => {
    if (form.subscription_mode === 'url' && !form.subscription_url?.trim()) {
      toast.error('请先输入订阅地址')
      return
    }
    if (form.subscription_mode === 'xboard_account') {
      const keepingPassword =
        current?.subscription_mode === 'xboard_account' &&
        current.xboard_password_configured
      if (
        !form.xboard_base_url?.trim() ||
        !form.xboard_email?.trim() ||
        (!form.xboard_password?.trim() && !keepingPassword)
      ) {
        toast.error('请先填写 Xboard 面板地址、邮箱和密码')
        return
      }
    }
    if (!form.user_agent.trim() || !validateProxy()) return
    proxyTestMutation.mutate({
      source_id: current?.id,
      subscription_mode: form.subscription_mode,
      subscription_url: form.subscription_url?.trim(),
      xboard_base_url: form.xboard_base_url?.trim().replace(/\/+$/, ''),
      xboard_email: form.xboard_email?.trim(),
      xboard_password: form.xboard_password,
      user_agent: form.user_agent.trim(),
      proxy_mode: form.proxy_mode,
      proxy_host: form.proxy_host?.trim(),
      proxy_port: form.proxy_port,
      proxy_username: form.proxy_username?.trim(),
      proxy_password: form.proxy_password,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {current ? '编辑外部节点来源' : '添加外部节点来源'}
          </DialogTitle>
          <DialogDescription>
            保存时会立即同步。以后每次更新都会从上游原始内容重新应用这里的名称与地址规则。
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-5 py-2'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='来源名称'>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((value) => ({ ...value, name: event.target.value }))
                }
                placeholder='如：备用机场 A'
              />
            </Field>
            <Field label='添加方式'>
              <Select
                value={form.type}
                onValueChange={(value: 'subscription' | 'manual') =>
                  setForm((formValue) => ({ ...formValue, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='subscription'>订阅地址</SelectItem>
                  <SelectItem value='manual'>单独节点</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.type === 'subscription' ? (
            <div className='grid gap-4 rounded-md border p-4'>
              <Field
                label='订阅获取方式'
                hint='固定地址适合普通订阅；Xboard 账户会在每次同步前自动读取账户当前的最新订阅地址。'
              >
                <Select
                  value={form.subscription_mode}
                  onValueChange={(
                    subscription_mode: typeof form.subscription_mode
                  ) => setForm((value) => ({ ...value, subscription_mode }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='url'>固定订阅地址</SelectItem>
                    <SelectItem value='xboard_account'>
                      Xboard 账户自动获取
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {form.subscription_mode === 'url' ? (
                <Field
                  label='订阅地址'
                  hint='以明文保存，编辑时会直接显示完整地址。'
                >
                  <Input
                    autoComplete='off'
                    value={form.subscription_url}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        subscription_url: event.target.value,
                      }))
                    }
                    placeholder='https://example.com/api/v1/client/subscribe?...'
                  />
                </Field>
              ) : (
                <>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <Field
                      label='Xboard 面板地址'
                      hint='填写面板根地址，必须是 HTTPS；不要包含 /api 路径、参数或锚点。'
                    >
                      <Input
                        autoComplete='url'
                        value={form.xboard_base_url}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            xboard_base_url: event.target.value,
                          }))
                        }
                        placeholder='https://panel.example.com'
                      />
                    </Field>
                    <Field label='Xboard 登录邮箱'>
                      <Input
                        type='email'
                        autoComplete='username'
                        value={form.xboard_email}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            xboard_email: event.target.value,
                          }))
                        }
                        placeholder='user@example.com'
                      />
                    </Field>
                  </div>
                  <Field
                    label='Xboard 登录密码'
                    hint={
                      current?.xboard_password_configured
                        ? '密码已加密保存；留空继续使用原密码。'
                        : '密码会加密保存，仅用于向上游 Xboard 登录。'
                    }
                  >
                    <Input
                      type='password'
                      autoComplete='new-password'
                      value={form.xboard_password}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          xboard_password: event.target.value,
                        }))
                      }
                      placeholder={
                        current?.xboard_password_configured
                          ? '留空保持原密码'
                          : '输入上游账户密码'
                      }
                    />
                  </Field>
                  {current?.subscription_mode === 'xboard_account' &&
                    current.subscription_url && (
                      <div className='rounded-md bg-muted/50 p-3 text-xs'>
                        <div className='text-muted-foreground'>
                          当前自动获取的订阅地址
                          {current.xboard_last_login_at
                            ? ` · 最近登录 ${formatTimestamp(current.xboard_last_login_at)}`
                            : ''}
                        </div>
                        <div className='mt-1 font-mono break-all'>
                          {current.subscription_url}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          ) : (
            <Field
              label='节点链接'
              hint='以明文保存，编辑时会直接显示完整节点链接和凭据。'
            >
              <Textarea
                className='min-h-24 font-mono text-xs'
                value={form.manual_uri}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    manual_uri: event.target.value,
                  }))
                }
                placeholder='vmess://、vless://、trojan://、ss://、hysteria2://、tuic:// 等'
              />
            </Field>
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='客户端 User-Agent'>
              <Select
                value={selectedPreset}
                onValueChange={(value) => {
                  if (value !== '__custom') {
                    setForm((formValue) => ({
                      ...formValue,
                      user_agent: value,
                    }))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(userAgentPresets).map(([label, value]) => (
                    <SelectItem key={label} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectItem value='__custom'>自定义</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className='mt-2 font-mono text-xs'
                value={form.user_agent}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    user_agent: event.target.value,
                  }))
                }
                placeholder='可直接输入任意 UA'
              />
            </Field>
            <Field
              label='排序值'
              hint='与本站节点共用同一排序空间，数值越小越靠前；同一来源内保持上游顺序。'
            >
              <Input
                type='number'
                value={form.sort}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    sort: Number(event.target.value) || 0,
                  }))
                }
              />
            </Field>
          </div>

          <Field
            label='下发范围'
            hint={
              AUDIENCE_MODE_OPTIONS.find(
                (option) => option.value === form.audience_mode
              )?.hint ?? ''
            }
          >
            <Select
              value={form.audience_mode}
              onValueChange={(audience_mode) =>
                setForm((value) => ({
                  ...value,
                  audience_mode: audience_mode as ExternalAudienceMode,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {targetsGroups && (
            <Field
              label='下发权限组'
              hint='只有这些权限组的用户会收到该来源的节点。'
            >
              <div className='grid max-h-36 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2'>
                {groups.length === 0 ? (
                  <span className='text-sm text-muted-foreground'>
                    暂无权限组
                  </span>
                ) : (
                  groups.map((group) => {
                    const checked = form.group_ids.includes(group.id)
                    return (
                      <label
                        key={group.id}
                        className='flex cursor-pointer items-center gap-2 text-sm'
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            setForm((value) => ({
                              ...value,
                              group_ids: next
                                ? [...value.group_ids, group.id]
                                : value.group_ids.filter(
                                    (id) => id !== group.id
                                  ),
                            }))
                          }
                        />
                        {group.name}
                      </label>
                    )
                  })
                )}
              </div>
            </Field>
          )}

          {targetsUsers && (
            <Field
              label='下发用户'
              hint='按邮箱或用户 ID 搜索后点击添加；这些用户不受权限组限制。'
            >
              <div className='space-y-3 rounded-md border p-3'>
                <Input
                  value={userKeyword}
                  onChange={(event) => setUserKeyword(event.target.value)}
                  placeholder='输入邮箱或用户 ID 搜索'
                />
                {debouncedKeyword.trim().length > 0 && (
                  <div className='max-h-40 space-y-1 overflow-y-auto'>
                    {userSearch.isPending ? (
                      <span className='text-sm text-muted-foreground'>
                        搜索中…
                      </span>
                    ) : (userSearch.data?.length ?? 0) === 0 ? (
                      <span className='text-sm text-muted-foreground'>
                        没有匹配的用户
                      </span>
                    ) : (
                      userSearch.data?.map((user) => {
                        const picked = audienceUsers.some(
                          (item) => item.id === user.id
                        )
                        return (
                          <button
                            key={user.id}
                            type='button'
                            disabled={picked}
                            className='flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-50'
                            onClick={() =>
                              setAudienceUsers((value) =>
                                value.some((item) => item.id === user.id)
                                  ? value
                                  : [...value, user]
                              )
                            }
                          >
                            <span>{user.email}</span>
                            <span className='text-xs text-muted-foreground'>
                              #{user.id}
                              {picked ? ' · 已选' : ''}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
                <div className='flex flex-wrap gap-2'>
                  {audienceUsers.length === 0 ? (
                    <span className='text-sm text-muted-foreground'>
                      尚未选择用户
                    </span>
                  ) : (
                    audienceUsers.map((user) => (
                      <Badge
                        key={user.id}
                        variant='secondary'
                        className='gap-1 py-1'
                      >
                        {user.email}
                        <button
                          type='button'
                          aria-label={`移除 ${user.email}`}
                          onClick={() =>
                            setAudienceUsers((value) =>
                              value.filter((item) => item.id !== user.id)
                            )
                          }
                        >
                          <X className='size-3' />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </Field>
          )}

          {form.type === 'subscription' && (
            <>
              <div className='grid gap-4 rounded-md border p-4 sm:grid-cols-[1fr_220px] sm:items-center'>
                <div className='flex items-center justify-between gap-4 sm:justify-start'>
                  <Switch
                    id='external-source-auto-sync'
                    checked={form.auto_sync}
                    onCheckedChange={(auto_sync) =>
                      setForm((value) => ({ ...value, auto_sync }))
                    }
                  />
                  <div>
                    <Label htmlFor='external-source-auto-sync'>
                      自动拉取上游订阅
                    </Label>
                    <p className='text-xs text-muted-foreground'>
                      到期后由后台队列更新，并重新应用全部名称和地址规则。
                    </p>
                  </div>
                </div>
                <Select
                  disabled={!form.auto_sync}
                  value={String(form.sync_interval_minutes)}
                  onValueChange={(value) =>
                    setForm((formValue) => ({
                      ...formValue,
                      sync_interval_minutes: Number(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='15'>每 15 分钟</SelectItem>
                    <SelectItem value='30'>每 30 分钟</SelectItem>
                    <SelectItem value='60'>每 1 小时</SelectItem>
                    <SelectItem value='180'>每 3 小时</SelectItem>
                    <SelectItem value='360'>每 6 小时</SelectItem>
                    <SelectItem value='720'>每 12 小时</SelectItem>
                    <SelectItem value='1440'>每天</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='rounded-md border p-4'>
                <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                  <Field
                    label='订阅拉取方式'
                    hint={`只影响这个来源；统一代理当前${pullProxy.enabled ? '已启用' : '未启用'}。`}
                  >
                    <Select
                      value={form.proxy_mode}
                      onValueChange={(proxy_mode: typeof form.proxy_mode) =>
                        setForm((value) => ({ ...value, proxy_mode }))
                      }
                    >
                      <SelectTrigger className='sm:w-64'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='inherit'>使用统一设置</SelectItem>
                        <SelectItem value='direct'>强制直连</SelectItem>
                        <SelectItem value='socks5'>独立 SOCKS5</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button
                    type='button'
                    variant='outline'
                    disabled={proxyTestMutation.isPending}
                    onClick={testProxy}
                  >
                    {proxyTestMutation.isPending ? '测试中…' : '测试拉取'}
                  </Button>
                </div>

                {form.proxy_mode === 'socks5' && (
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <Field label='代理地址'>
                      <Input
                        value={form.proxy_host}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            proxy_host: event.target.value,
                          }))
                        }
                        placeholder='127.0.0.1 或 proxy.example.com'
                      />
                    </Field>
                    <Field label='代理端口'>
                      <Input
                        type='number'
                        min={1}
                        max={65535}
                        value={form.proxy_port}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            proxy_port: Number(event.target.value),
                          }))
                        }
                        placeholder='1080'
                      />
                    </Field>
                    <Field label='用户名（可选）'>
                      <Input
                        autoComplete='off'
                        value={form.proxy_username}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            proxy_username: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field
                      label='密码（可选）'
                      hint={
                        current?.proxy_password_configured
                          ? '已保存；留空保持原密码。清空用户名可移除认证。'
                          : undefined
                      }
                    >
                      <Input
                        type='password'
                        autoComplete='new-password'
                        value={form.proxy_password}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            proxy_password: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                )}
              </div>
            </>
          )}

          <div className='grid gap-4 rounded-md border p-4 sm:grid-cols-[1fr_260px] sm:items-center'>
            <div className='flex items-center justify-between gap-4 sm:justify-start'>
              <Switch
                id='external-source-dns-alias'
                checked={form.dns_alias_enabled}
                disabled={dnsZones.length === 0 && !form.dns_alias_enabled}
                onCheckedChange={(dns_alias_enabled) =>
                  setForm((value) => ({ ...value, dns_alias_enabled }))
                }
              />
              <div>
                <Label htmlFor='external-source-dns-alias'>DNS 地址套壳</Label>
                <p className='text-xs text-muted-foreground'>
                  用本站域名建立灰云 CNAME/A/AAAA；原始 TLS SNI 和传输层 Host
                  会保留。
                </p>
                {dnsZones.length === 0 && (
                  <p className='mt-1 text-xs text-amber-600'>
                    请先到 DNS 自动同步中为 Zone 填写根域名。
                  </p>
                )}
              </div>
            </div>
            <Select
              disabled={!form.dns_alias_enabled}
              value={form.dns_cloudflare_zone_id || undefined}
              onValueChange={(zoneId) => {
                const zone = dnsZones.find((item) => item.zone_id === zoneId)
                setForm((value) => ({
                  ...value,
                  dns_cloudflare_zone_id: zoneId,
                  dns_alias_domain: zone?.domain ?? '',
                }))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='选择套壳域名' />
              </SelectTrigger>
              <SelectContent>
                {dnsZones.map((zone) => (
                  <SelectItem key={zone.zone_id} value={zone.zone_id}>
                    {zone.remark ? `${zone.remark} · ` : ''}
                    {zone.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='rounded-md border p-4'>
            <div className='mb-4'>
              <h4 className='font-medium'>节点名称规则</h4>
              <p className='text-xs text-muted-foreground'>
                先按顺序执行文本或正则替换，再应用名称模板，最后添加前缀和后缀。
              </p>
            </div>
            <div className='mb-4 grid gap-3 sm:grid-cols-2'>
              <Field label='统一前缀'>
                <Input
                  value={form.name_prefix}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      name_prefix: event.target.value,
                    }))
                  }
                  placeholder='如：高级-'
                />
              </Field>
              <Field label='统一后缀'>
                <Input
                  value={form.name_suffix}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      name_suffix: event.target.value,
                    }))
                  }
                  placeholder='如：-专线'
                />
              </Field>
            </div>
            <div className='mb-4 rounded-md border border-dashed p-3'>
              <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                <div>
                  <Label>强制名称模板</Label>
                  <p className='text-xs text-muted-foreground'>
                    支持 {'{name}'}、{'{index}'}、{'{host_label}'}、{'{host}'}、
                    {'{type}'}、{'{source}'}。不使用 {'{name}'}{' '}
                    即可彻底隔离上游广告和机场信息。
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {'{host_label}'} 取连接地址的域名前缀，例如 hk1.baidu.com →
                    hk1；地址为 IP 时取完整
                    IP。它在同一台上游主机的多个节点上取值相同，需搭配{' '}
                    {'{index}'} 才能区分。
                  </p>
                </div>
                <div className='flex shrink-0 gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() =>
                      setForm((value) => ({
                        ...value,
                        name_template: '本站-{host_label}-{index}',
                      }))
                    }
                  >
                    按连接地址命名
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() =>
                      setForm((value) => ({
                        ...value,
                        name_template: '本站-{type}-{index}',
                      }))
                    }
                  >
                    一键隔离上游名称
                  </Button>
                </div>
              </div>
              <Input
                value={form.name_template}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    name_template: event.target.value,
                  }))
                }
                placeholder='例如：本站-{type}-{index}'
              />
            </div>
            <div className='mb-4 rounded-md border border-dashed p-3'>
              <RuleEditor
                title='连接地址前缀名称映射'
                description='配合 {host_label} 使用；精确映射优先。写一条 jp → 日本，可自动得到 jp1 → 日本1、jp02 → 日本02，但不会匹配 jpx。'
                rules={form.host_label_mappings}
                onChange={(rules) => setRules('host_label_mappings', rules)}
                fromPlaceholder='地址前缀，如：jp'
                toPlaceholder='显示名称，如：日本'
              />
            </div>
            <RuleEditor
              title='名称清理与替换'
              description='文本规则适合固定广告；正则规则可以持续清理变化的网址、群号和推广内容。'
              rules={form.name_rules}
              onChange={(rules) => setRules('name_rules', rules)}
              fromPlaceholder='文字或正则，如：https?://\S+'
              toPlaceholder='新文字，如：HK'
              advancedName
            />
          </div>

          <div className='rounded-md border p-4'>
            <RuleEditor
              title='节点地址精确替换'
              description='仅当原地址完全相同时替换；不会修改 TLS SNI 或伪装域名。'
              rules={form.host_rules}
              onChange={(rules) => setRules('host_rules', rules)}
              fromPlaceholder='a.baidu.com'
              toPlaceholder='b.youtube.com'
            />
          </div>

          {form.type === 'manual' && (
            <div className='grid gap-4 rounded-md border p-4 sm:grid-cols-2'>
              <Field
                label='单节点名称覆盖'
                hint='留空则使用链接中的名称和上面的规则。'
              >
                <Input
                  value={form.name_override}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      name_override: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label='单节点地址覆盖'
                hint='只改连接地址，不改 SNI/伪装域名。'
              >
                <Input
                  value={form.host_override}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      host_override: event.target.value,
                    }))
                  }
                  placeholder='域名、IPv4 或 IPv6'
                />
              </Field>
            </div>
          )}

          <div className='flex items-center justify-between rounded-md border p-4'>
            <div>
              <Label htmlFor='external-source-enabled'>参与订阅下发</Label>
              <p className='text-xs text-muted-foreground'>
                关闭后保留来源和节点，但不再下发给用户。
              </p>
            </div>
            <Switch
              id='external-source-enabled'
              checked={form.enabled}
              onCheckedChange={(enabled) =>
                setForm((value) => ({ ...value, enabled }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? '保存并同步中…' : '保存并立即同步'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      {children}
      {hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString()
}

function RuleEditor({
  title,
  description,
  rules,
  onChange,
  fromPlaceholder,
  toPlaceholder,
  advancedName = false,
}: {
  title: string
  description?: string
  rules: ExternalNodeRule[]
  onChange: (rules: ExternalNodeRule[]) => void
  fromPlaceholder: string
  toPlaceholder: string
  advancedName?: boolean
}) {
  const update = <Key extends keyof ExternalNodeRule>(
    index: number,
    key: Key,
    value: ExternalNodeRule[Key]
  ) =>
    onChange(
      rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [key]: value } : rule
      )
    )

  return (
    <div className='grid gap-3'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <Label>{title}</Label>
          {description && (
            <p className='mt-1 text-xs text-muted-foreground'>{description}</p>
          )}
        </div>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => onChange([...rules, { ...EMPTY_RULE }])}
        >
          <Plus className='mr-1 size-4' />
          添加规则
        </Button>
      </div>
      {rules.map((rule, index) => (
        <div
          key={index}
          className={`grid gap-2 ${advancedName ? 'sm:grid-cols-[150px_1fr_1fr_auto]' : 'sm:grid-cols-[1fr_1fr_auto]'}`}
        >
          {advancedName && (
            <Select
              value={`${rule.mode ?? 'text'}:${rule.case_sensitive === false ? 'i' : 's'}`}
              onValueChange={(value) => {
                const [mode, sensitivity] = value.split(':') as [
                  'text' | 'regex',
                  'i' | 's',
                ]
                onChange(
                  rules.map((item, ruleIndex) =>
                    ruleIndex === index
                      ? {
                          ...item,
                          mode,
                          case_sensitive: sensitivity === 's',
                        }
                      : item
                  )
                )
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='text:s'>文字（区分大小写）</SelectItem>
                <SelectItem value='text:i'>文字（忽略大小写）</SelectItem>
                <SelectItem value='regex:s'>正则（区分大小写）</SelectItem>
                <SelectItem value='regex:i'>正则（忽略大小写）</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Input
            value={rule.from}
            onChange={(event) => update(index, 'from', event.target.value)}
            placeholder={fromPlaceholder}
          />
          <Input
            value={rule.to}
            onChange={(event) => update(index, 'to', event.target.value)}
            placeholder={toPlaceholder}
          />
          <Button
            type='button'
            size='icon'
            variant='ghost'
            aria-label='删除规则'
            onClick={() =>
              onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))
            }
          >
            <Trash2 className='size-4' />
          </Button>
        </div>
      ))}
    </div>
  )
}
