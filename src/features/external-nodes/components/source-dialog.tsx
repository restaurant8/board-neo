import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
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
  type ExternalDnsZone,
  type ExternalNodeRule,
  type ExternalNodeSource,
  type ExternalNodeSourcePayload,
  saveExternalNodeSource,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: ExternalNodeSource | null
  groups: ServerGroup[]
  userAgentPresets: Record<string, string>
  dnsZones: ExternalDnsZone[]
}

const EMPTY_RULE: ExternalNodeRule = { from: '', to: '' }

const defaultForm = (
  current?: ExternalNodeSource | null
): ExternalNodeSourcePayload => ({
  id: current?.id,
  name: current?.name ?? '',
  type: current?.type ?? 'subscription',
  subscription_url: '',
  manual_uri: '',
  user_agent: current?.user_agent ?? 'clash-verge-rev',
  group_ids: current?.group_ids.map(Number) ?? [],
  enabled: current?.enabled ?? true,
  dns_alias_enabled: current?.dns_alias_enabled ?? false,
  dns_cloudflare_zone_id: current?.dns_cloudflare_zone_id ?? '',
  dns_alias_domain: current?.dns_alias_domain ?? '',
  auto_sync: current?.auto_sync ?? false,
  sync_interval_minutes: current?.sync_interval_minutes ?? 60,
  sort: current?.sort ?? 0,
  name_prefix: current?.name_prefix ?? '',
  name_suffix: current?.name_suffix ?? '',
  name_override: current?.name_override ?? '',
  host_override: current?.host_override ?? '',
  name_rules: current?.name_rules ?? [],
  host_rules: current?.host_rules ?? [],
})

export function ExternalNodeSourceDialog({
  open,
  onOpenChange,
  current,
  groups,
  userAgentPresets,
  dnsZones,
}: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ExternalNodeSourcePayload>(() =>
    defaultForm(current)
  )

  const selectedPreset = useMemo(() => {
    return Object.values(userAgentPresets).includes(form.user_agent)
      ? form.user_agent
      : '__custom'
  }, [form.user_agent, userAgentPresets])

  const mutation = useMutation({
    mutationFn: saveExternalNodeSource,
    onSuccess: (result) => {
      toast.success(
        `已保存并同步 ${result.sync.node_count} 个节点${result.sync.skipped_count > 0 ? `，跳过 ${result.sync.skipped_count} 个异常节点` : ''}`
      )
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('请输入来源名称')
      return
    }
    if (!form.user_agent.trim()) {
      toast.error('请输入拉取订阅使用的 User-Agent')
      return
    }
    if (form.group_ids.length === 0) {
      toast.error('至少选择一个权限组')
      return
    }
    const secret =
      form.type === 'subscription' ? form.subscription_url : form.manual_uri
    if (!current && !secret?.trim()) {
      toast.error(
        form.type === 'subscription' ? '请输入订阅地址' : '请输入节点链接'
      )
      return
    }
    if (
      form.name_rules.some((rule) => !rule.from.trim()) ||
      form.host_rules.some((rule) => !rule.from.trim() || !rule.to.trim())
    ) {
      toast.error('请补全或删除空的替换规则')
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
      name: form.name.trim(),
      user_agent: form.user_agent.trim(),
      subscription_url: form.subscription_url?.trim(),
      manual_uri: form.manual_uri?.trim(),
      name_rules: form.name_rules.map((rule) => ({
        from: rule.from,
        to: rule.to,
      })),
      host_rules: form.host_rules.map((rule) => ({
        from: rule.from.trim(),
        to: rule.to.trim(),
      })),
    })
  }

  const setRules = (
    key: 'name_rules' | 'host_rules',
    rules: ExternalNodeRule[]
  ) => setForm((value) => ({ ...value, [key]: rules }))

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
            <Field
              label='订阅地址'
              hint={
                current ? '留空表示继续使用已加密保存的原地址。' : undefined
              }
            >
              <Input
                type='password'
                autoComplete='off'
                value={form.subscription_url}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    subscription_url: event.target.value,
                  }))
                }
                placeholder={
                  current
                    ? '留空不修改'
                    : 'https://example.com/api/v1/client/subscribe?...'
                }
              />
            </Field>
          ) : (
            <Field
              label='节点链接'
              hint={
                current ? '留空表示继续使用已加密保存的原节点链接。' : undefined
              }
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
              hint='数值越小越靠前；外部节点整体排在本站节点之后。'
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
                              : value.group_ids.filter((id) => id !== group.id),
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

          {form.type === 'subscription' && (
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
                先按顺序替换文字，再添加前缀和后缀。
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
            <RuleEditor
              title='名称文字替换'
              rules={form.name_rules}
              onChange={(rules) => setRules('name_rules', rules)}
              fromPlaceholder='原文字，如：香港'
              toPlaceholder='新文字，如：HK'
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

function RuleEditor({
  title,
  description,
  rules,
  onChange,
  fromPlaceholder,
  toPlaceholder,
}: {
  title: string
  description?: string
  rules: ExternalNodeRule[]
  onChange: (rules: ExternalNodeRule[]) => void
  fromPlaceholder: string
  toPlaceholder: string
}) {
  const update = (index: number, key: keyof ExternalNodeRule, value: string) =>
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
        <div key={index} className='grid grid-cols-[1fr_1fr_auto] gap-2'>
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
