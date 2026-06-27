import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileCode,
  FileText,
  Globe,
  Mail,
  Save,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  Users,
  Webhook,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { fetchPlans } from '@/features/plan/api'
import {
  type ConfigData,
  fetchConfig,
  saveConfig,
  setTelegramWebhook,
  testSendMail,
} from './api'
import {
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
} from './components/config-field'
import { SectionNav, type SectionNavItem } from './components/section-nav'

/** Flatten the grouped config into a single key→value map for editing. */
function flatten(data: ConfigData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  Object.values(data).forEach((group) => {
    if (group && typeof group === 'object') Object.assign(out, group)
  })
  return out
}

const sectionItems: SectionNavItem[] = [
  { key: 'site', title: '站点设置', icon: <Globe size={18} /> },
  { key: 'safe', title: '安全设置', icon: <ShieldCheck size={18} /> },
  { key: 'subscribe', title: '订阅设置', icon: <FileText size={18} /> },
  {
    key: 'subscribe_template',
    title: '订阅模板',
    icon: <FileCode size={18} />,
  },
  { key: 'invite', title: '邀请&佣金设置', icon: <Users size={18} /> },
  { key: 'server', title: '节点配置', icon: <Server size={18} /> },
  { key: 'email', title: '邮件设置', icon: <Mail size={18} /> },
  { key: 'telegram', title: 'Telegram设置', icon: <Send size={18} /> },
  { key: 'app', title: 'APP设置', icon: <Smartphone size={18} /> },
]

const sectionMeta: Record<string, { title: string; description: string }> = {
  site: {
    title: '站点设置',
    description: '配置站点基本信息，包括站点名称、描述、货币单位等核心设置。',
  },
  safe: {
    title: '安全设置',
    description:
      '配置系统安全相关选项，包括登录验证、密码策略、API访问等安全设置。',
  },
  subscribe: {
    title: '订阅设置',
    description: '管理用户订阅相关配置，包括订阅链接格式、更新频率、流量统计等设置。',
  },
  subscribe_template: {
    title: '订阅模板',
    description: '配置各个客户端的订阅模板',
  },
  invite: {
    title: '邀请&佣金设置',
    description: '邀请注册、佣金相关设置。',
  },
  server: {
    title: '节点配置',
    description:
      '配置节点通信和同步设置，包括通信密钥、轮询间隔、负载均衡等高级选项。',
  },
  email: {
    title: '邮件设置',
    description:
      '配置系统邮件服务，用于发送验证码、密码重置、通知等邮件，支持多种SMTP服务商。',
  },
  telegram: {
    title: 'Telegram设置',
    description:
      '配置Telegram机器人功能，实现用户通知、账户绑定、指令交互等自动化服务。',
  },
  app: {
    title: 'APP设置',
    description:
      '管理移动应用程序相关配置，包括API接口、版本控制、推送通知等功能设置。',
  },
}

/** Section header matching the original: title (text-lg) + muted description + Separator. */
function SectionHeader({ section }: { section: string }) {
  const meta = sectionMeta[section]
  if (!meta) return null
  return (
    <div>
      <div>
        <h3 className='text-lg font-medium'>{meta.title}</h3>
        <p className='text-muted-foreground text-sm'>{meta.description}</p>
      </div>
      <Separator className='my-4' />
    </div>
  )
}

export function ConfigPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })
  // 注册试用：可选套餐列表（对齐原版下拉）
  const { data: plans } = useQuery({
    queryKey: ['plans-brief'],
    queryFn: fetchPlans,
  })

  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [section, setSection] = useState('site')

  useEffect(() => {
    if (data) {
      setForm(flatten(data))
      setDirty(new Set())
    }
  }, [data])

  const set = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty((prev) => new Set(prev).add(key))
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {}
      dirty.forEach((k) => (payload[k] = form[k]))
      return saveConfig(payload)
    },
    onSuccess: () => {
      toast.success('配置已保存')
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
    onError: handleServerError,
  })

  const testMailMutation = useMutation({
    mutationFn: testSendMail,
    onSuccess: () => toast.success('测试邮件已发送，请检查收件箱'),
    onError: handleServerError,
  })

  const webhookMutation = useMutation({
    mutationFn: () => setTelegramWebhook(String(form.telegram_bot_token ?? '')),
    onSuccess: (r) => toast.success(`Webhook 已设置：${r.webhook_url}`),
    onError: handleServerError,
  })

  const v = (k: string) => form[k]
  const num = (k: string) =>
    form[k] === '' || form[k] == null ? undefined : Number(form[k])

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed className='flex flex-col'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-0.5'>
            <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
              系统设置
            </h1>
            <p className='text-muted-foreground'>
              管理系统核心配置，包括站点、安全、订阅、邀请佣金、节点、邮件和通知等设置
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || dirty.size === 0}
          >
            <Save className='size-4' /> 保存
            {dirty.size > 0 ? `（${dirty.size}）` : ''}
          </Button>
        </div>
        <Separator className='my-4 lg:my-6' />

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>
            加载中...
          </div>
        ) : (
          <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
            <aside className='top-0 lg:sticky lg:w-1/5'>
              <SectionNav
                items={sectionItems}
                value={section}
                onChange={setSection}
              />
            </aside>
            <div className='flex w-full overflow-y-auto p-1'>
              <div className='w-full space-y-6 lg:max-w-2xl'>
                <SectionHeader section={section} />

                {/* 站点设置 */}
                {section === 'site' && (
                  <div className='space-y-4'>
                    <TextField label='站点名称' placeholder='请输入站点名称' description='用于显示需要站点名称的地方。' value={v('app_name') as string} onChange={(x) => set('app_name', x)} />
                    <TextField label='站点描述' placeholder='请输入站点描述' description='用于显示需要站点描述的地方。' value={v('app_description') as string} onChange={(x) => set('app_description', x)} />
                    <TextField label='站点网址' placeholder='请输入站点URL，末尾不要/' description='当前网站最新网址，将会在邮件等需要用于网址处体现。' value={v('app_url') as string} onChange={(x) => set('app_url', x)} />
                    <SwitchField label='强制HTTPS' description='当站点没有使用HTTPS，CDN或反代开启强制HTTPS时需要开启。' value={!!num('force_https')} onChange={(b) => set('force_https', b ? 1 : 0)} />
                    <TextField label='LOGO' placeholder='请输入LOGO URL，末尾不要/' description='用于显示需要LOGO的地方。' value={v('logo') as string} onChange={(x) => set('logo', x)} />
                    <TextField label='订阅URL' placeholder="用于订阅所使用，多个订阅地址用','隔开.留空则为站点URL。" description='用于订阅所使用，留空则为站点URL。' value={v('subscribe_url') as string} onChange={(x) => set('subscribe_url', x)} />
                    <TextField label='用户条款(TOS)URL' placeholder='请输入用户条款URL，末尾不要/' description='用于跳转到用户条款(TOS)' value={v('tos_url') as string} onChange={(x) => set('tos_url', x)} />
                    <TextField label='货币单位' placeholder='CNY' description='仅用于展示使用，更改后系统中所有的货币单位都将发生变更。' value={v('currency') as string} onChange={(x) => set('currency', x)} />
                    <TextField label='货币符号' placeholder='¥' description='仅用于展示使用，更改后系统中所有的货币单位都将发生变更。' value={v('currency_symbol') as string} onChange={(x) => set('currency_symbol', x)} />
                    <SelectField
                      label='注册试用'
                      placeholder='关闭'
                      description='选择需要试用的订阅，如果没有选项请先前往订阅管理添加。'
                      value={num('try_out_plan_id')}
                      onChange={(x) => set('try_out_plan_id', Number(x) || 0)}
                      options={[
                        { value: '0', label: '关闭' },
                        ...(plans ?? []).map((p) => ({
                          value: String(p.id),
                          label: p.name,
                        })),
                      ]}
                    />
                    <TextField label='注册试用时长' placeholder='0' description='注册试用时长，单位为小时。' type='number' value={v('try_out_hour') as number} onChange={(x) => set('try_out_hour', Number(x) || 0)} />
                    <SwitchField label='停止新用户注册' description='开启后任何人都将无法进行注册。' value={!!num('stop_register')} onChange={(b) => set('stop_register', b ? 1 : 0)} />
                    <SwitchField label='工单等待回复限制' description='开启后，用户在管理员回复前无法在同一工单内连续发送消息。' value={v('ticket_must_wait_reply') as boolean} onChange={(b) => set('ticket_must_wait_reply', b)} />
                  </div>
                )}

                {/* 安全设置 */}
                {section === 'safe' && (
                  <div className='space-y-4'>
                    <TextField label='后台路径' placeholder='admin' description='后台管理路径，修改后将会改变原有的admin路径' value={v('secure_path') as string} onChange={(x) => set('secure_path', x)} />
                    <SwitchField label='邮箱验证' description='开启后将会强制要求用户进行邮箱验证。' value={v('email_verify') as boolean} onChange={(b) => set('email_verify', b)} />
                    <SwitchField label='安全模式' description='开启后除了站点URL以外的绑定本站点的域名访问都将会被403。' value={v('safe_mode_enable') as boolean} onChange={(b) => set('safe_mode_enable', b)} />
                    <SwitchField label='邮箱后缀白名单' description='开启后在名单中的邮箱后缀才允许进行注册。' value={v('email_whitelist_enable') as boolean} onChange={(b) => set('email_whitelist_enable', b)} />
                    {(v('email_whitelist_enable') as boolean) && (
                      <TextareaField
                        label='邮箱后缀'
                        description='输入允许的邮箱后缀，每行一个'
                        placeholder={'gmail.com\noutlook.com\nqq.com'}
                        value={(() => {
                          const s = v('email_whitelist_suffix') as
                            | string[]
                            | string
                            | null
                            | undefined
                          return Array.isArray(s) ? s.join('\n') : (s ?? '')
                        })()}
                        onChange={(x) =>
                          set(
                            'email_whitelist_suffix',
                            x
                              .split(/[\n,]/)
                              .map((t) => t.trim())
                              .filter(Boolean)
                          )
                        }
                      />
                    )}
                    <SwitchField label='禁止使用Gmail多别名' description='开启后Gmail多别名将无法注册。' value={v('email_gmail_limit_enable') as boolean} onChange={(b) => set('email_gmail_limit_enable', b)} />
                    <SwitchField label='启用验证码' description='开启后用户注册时需要通过验证码验证。' value={v('captcha_enable') as boolean} onChange={(b) => set('captcha_enable', b)} />
                    <SelectField
                      label='验证码类型'
                      description='选择要使用的验证码服务类型'
                      value={v('captcha_type') as string}
                      onChange={(x) => set('captcha_type', x)}
                      options={[
                        { value: 'recaptcha', label: 'Google reCAPTCHA v2' },
                        { value: 'recaptcha-v3', label: 'Google reCAPTCHA v3' },
                        { value: 'turnstile', label: 'Cloudflare Turnstile' },
                      ]}
                    />
                    <SwitchField label='IP注册限制' description='开启后将限制同一IP的注册次数。' value={v('register_limit_by_ip_enable') as boolean} onChange={(b) => set('register_limit_by_ip_enable', b)} />
                    <TextField label='注册次数' placeholder='输入最大注册次数' description='同一IP允许的最大注册次数' type='number' value={v('register_limit_count') as number} onChange={(x) => set('register_limit_count', Number(x) || 0)} />
                    <TextField label='限制时长' placeholder='输入限制时长（分钟）' description='注册限制的持续时间（分钟）' type='number' value={v('register_limit_expire') as number} onChange={(x) => set('register_limit_expire', Number(x) || 0)} />
                    <SwitchField label='密码尝试限制' description='开启后将限制密码尝试次数。' value={v('password_limit_enable') as boolean} onChange={(b) => set('password_limit_enable', b)} />
                    <TextField label='尝试次数' placeholder='输入最大尝试次数' description='允许的最大密码尝试次数' type='number' value={v('password_limit_count') as number} onChange={(x) => set('password_limit_count', Number(x) || 0)} />
                    <TextField label='锁定时长' placeholder='输入锁定时长（分钟）' description='账户锁定的持续时间（分钟）' type='number' value={v('password_limit_expire') as number} onChange={(x) => set('password_limit_expire', Number(x) || 0)} />
                  </div>
                )}

                {/* 订阅设置 */}
                {section === 'subscribe' && (
                  <div className='space-y-4'>
                    <TextField label='订阅路径' description='订阅路径，修改后将会改变原有的subscribe路径' value={v('subscribe_path') as string} onChange={(x) => set('subscribe_path', x)} />
                    <SelectField
                      label='月流量重置方式'
                      description='全局流量重置方式，默认每月1号。可以在订阅管理为订阅单独设置。'
                      value={num('reset_traffic_method')}
                      onChange={(x) => set('reset_traffic_method', Number(x))}
                      options={[
                        { value: '0', label: '每月1号' },
                        { value: '1', label: '按月重置' },
                        { value: '2', label: '不重置' },
                        { value: '3', label: '每年1月1号' },
                        { value: '4', label: '按年重置' },
                      ]}
                    />
                    <SwitchField label='允许用户更改订阅' description='开启后用户将会可以对订阅计划进行变更。' value={v('plan_change_enable') as boolean} onChange={(b) => set('plan_change_enable', b)} />
                    <SwitchField label='开启折抵方案' description='开启后用户更换订阅将会由系统对原有订阅进行折抵，方案参考文档。' value={v('surplus_enable') as boolean} onChange={(b) => set('surplus_enable', b)} />
                    <SwitchField label='在订阅中展示订阅信息' description='开启后将会在用户订阅节点时输出订阅信息。' value={v('show_info_to_server_enable') as boolean} onChange={(b) => set('show_info_to_server_enable', b)} />
                    <SwitchField label='在订阅中线路名称中显示协议名称' description='开启后订阅线路会附带协议名称（例如: [Hy2]香港）' value={v('show_protocol_to_server_enable') as boolean} onChange={(b) => set('show_protocol_to_server_enable', b)} />
                    <SwitchField label='默认到期提醒' description='开启后默认向用户发送订阅到期提醒。' value={v('default_remind_expire') as boolean} onChange={(b) => set('default_remind_expire', b)} />
                    <SwitchField label='默认流量提醒' description='开启后默认向用户发送订阅流量不足提醒。' value={v('default_remind_traffic') as boolean} onChange={(b) => set('default_remind_traffic', b)} />
                    <SelectField
                      label='当订阅新购时触发事件'
                      description='新购订阅完成时将触发该任务。'
                      value={num('new_order_event_id')}
                      onChange={(x) => set('new_order_event_id', Number(x))}
                      options={[
                        { value: '0', label: '不执行任何动作' },
                        { value: '1', label: '重置用户流量' },
                      ]}
                    />
                    <SelectField
                      label='当订阅续费时触发事件'
                      description='续费订阅完成时将触发该任务。'
                      value={num('renew_order_event_id')}
                      onChange={(x) => set('renew_order_event_id', Number(x))}
                      options={[
                        { value: '0', label: '不执行任何动作' },
                        { value: '1', label: '重置用户流量' },
                      ]}
                    />
                    <SelectField
                      label='当订阅变更时触发事件'
                      description='变更订阅完成时将触发该任务。'
                      value={num('change_order_event_id')}
                      onChange={(x) => set('change_order_event_id', Number(x))}
                      options={[
                        { value: '0', label: '不执行任何动作' },
                        { value: '1', label: '重置用户流量' },
                      ]}
                    />
                  </div>
                )}

                {/* 订阅模板 */}
                {section === 'subscribe_template' && (
                  <div className='space-y-4'>
                    <TextareaField label='Clash 订阅模板' description='配置 Clash 的订阅模板格式' rows={10} value={v('subscribe_template_clash') as string} onChange={(x) => set('subscribe_template_clash', x)} placeholder='留空使用默认模板' />
                    <TextareaField label='Clash Meta 订阅模板' description='配置 Clash Meta 的订阅模板格式' rows={10} value={v('subscribe_template_clashmeta') as string} onChange={(x) => set('subscribe_template_clashmeta', x)} placeholder='留空使用默认模板' />
                    <TextareaField label='Stash 订阅模板' description='配置 Stash 的订阅模板格式' rows={10} value={v('subscribe_template_stash') as string} onChange={(x) => set('subscribe_template_stash', x)} placeholder='留空使用默认模板' />
                    <TextareaField label='Sing-box 订阅模板' description='配置 Sing-box 的订阅模板格式' rows={10} value={v('subscribe_template_singbox') as string} onChange={(x) => set('subscribe_template_singbox', x)} placeholder='留空使用默认模板' />
                    <TextareaField label='Surge 配置模板' description='配置 Surge 订阅模板，支持 Surge 配置文件格式' rows={10} value={v('subscribe_template_surge') as string} onChange={(x) => set('subscribe_template_surge', x)} placeholder='留空使用默认模板' />
                    <TextareaField label='Surfboard 配置模版' description='配额 Surfboard 订阅模版' rows={10} value={v('subscribe_template_surfboard') as string} onChange={(x) => set('subscribe_template_surfboard', x)} placeholder='留空使用默认模板' />
                  </div>
                )}

                {/* 邀请&佣金设置 */}
                {section === 'invite' && (
                  <div className='space-y-4'>
                    <SwitchField label='开启强制邀请' description='开启后只有被邀请的用户才可以进行注册。' value={v('invite_force') as boolean} onChange={(b) => set('invite_force', b)} />
                    <TextField label='邀请佣金百分比' placeholder='请输入佣金百分比' description='默认全局的佣金分配比例，你可以在用户管理单独配置单个比例。' type='number' value={v('invite_commission') as number} onChange={(x) => set('invite_commission', Number(x) || 0)} />
                    <TextField label='用户可创建邀请码上限' placeholder='请输入创建上限' description='用户可创建邀请码上限' type='number' value={v('invite_gen_limit') as number} onChange={(x) => set('invite_gen_limit', Number(x) || 0)} />
                    <SwitchField label='邀请码永不失效' description='开启后邀请码被使用后将不会失效，否则使用过后即失效。' value={v('invite_never_expire') as boolean} onChange={(b) => set('invite_never_expire', b)} />
                    <SwitchField label='佣金仅首次发放' description='开启后被邀请人首次支付时才会产生佣金，可以在用户管理对用户进行单独配置。' value={v('commission_first_time_enable') as boolean} onChange={(b) => set('commission_first_time_enable', b)} />
                    <SwitchField label='佣金自动确认' description='开启后佣金将会在订单完成3日后自动进行确认。' value={v('commission_auto_check_enable') as boolean} onChange={(b) => set('commission_auto_check_enable', b)} />
                    <TextField label='提现单申请门槛(元)' placeholder='请输入提现门槛' description='小于门槛金额的提现单将不会被提交。' type='number' value={v('commission_withdraw_limit') as number} onChange={(x) => set('commission_withdraw_limit', x === '' ? null : Number(x))} />
                    <SwitchField label='关闭提现' description='关闭后将禁止用户申请提现，且邀请佣金将会直接进入用户余额。' value={v('withdraw_close_enable') as boolean} onChange={(b) => set('withdraw_close_enable', b)} />
                    <SwitchField label='三级分销' description='开启后将佣金将按照设置的3成比例进行分成，三成比例合计请不要大于100%。' value={v('commission_distribution_enable') as boolean} onChange={(b) => set('commission_distribution_enable', b)} />
                    <TextField label='一级邀请人比例' placeholder='请输入比例，如：50' description='一级邀请人比例' type='number' value={v('commission_distribution_l1') as number} onChange={(x) => set('commission_distribution_l1', x === '' ? null : Number(x))} />
                    <TextField label='二级邀请人比例' placeholder='请输入比例，如：50' description='二级邀请人比例' type='number' value={v('commission_distribution_l2') as number} onChange={(x) => set('commission_distribution_l2', x === '' ? null : Number(x))} />
                    <TextField label='三级邀请人比例' placeholder='请输入比例，如：50' description='三级邀请人比例' type='number' value={v('commission_distribution_l3') as number} onChange={(x) => set('commission_distribution_l3', x === '' ? null : Number(x))} />
                  </div>
                )}

                {/* 节点配置 */}
                {section === 'server' && (
                  <div className='space-y-4'>
                    <TextField label='通讯密钥' placeholder='请输入通讯密钥' description='Xboard与节点通讯的密钥，以便数据不会被他人获取。' value={v('server_token') as string} onChange={(x) => set('server_token', x)} />
                    <TextField label='节点拉取动作轮询间隔' placeholder='请输入拉取间隔' description='节点从面板获取数据的间隔频率。' type='number' value={v('server_pull_interval') as number} onChange={(x) => set('server_pull_interval', Number(x) || 0)} />
                    <TextField label='节点推送动作轮询间隔' placeholder='请输入推送间隔' description='节点推送数据到面板的间隔频率。' type='number' value={v('server_push_interval') as number} onChange={(x) => set('server_push_interval', Number(x) || 0)} />
                    <SelectField
                      label='流量统计模式'
                      description='控制节点额外上报的流量聚合维度；暂未升级的旧节点会继续按原方式工作。'
                      placeholder='请选择统计模式'
                      value={(v('traffic_stats_mode') as string) || 'off'}
                      onChange={(x) => set('traffic_stats_mode', x)}
                      options={[
                        { value: 'off', label: '关闭' },
                        { value: 'privacy', label: '隐私统计模式' },
                        { value: 'diagnostic', label: '授权诊断模式' },
                      ]}
                    />
                    <TextField label='流量统计周期' placeholder='请输入周期分钟数' description='节点、类别、域名流量统计的聚合周期，单位为分钟。' type='number' value={v('traffic_stats_interval') as number} onChange={(x) => set('traffic_stats_interval', Number(x) || 0)} />
                    <SelectField
                      label='设备限制模式'
                      description='宽松模式下，同一IP地址使用多个节点只统计为一个设备。'
                      placeholder='请选择设备限制模式'
                      value={num('device_limit_mode') ?? 0}
                      onChange={(x) => set('device_limit_mode', Number(x))}
                      options={[
                        { value: '0', label: '宽松模式' },
                        { value: '1', label: '严格模式' },
                      ]}
                    />
                    <SwitchField label='启用 WebSocket 通信' description='开启后节点将通过 WebSocket 与面板进行实时通信，延迟更低、推送更及时。' value={v('server_ws_enable') as boolean} onChange={(b) => set('server_ws_enable', b)} />
                    <TextField label='WebSocket 地址' placeholder='留空则使用站点网址' description='节点连接面板的 WebSocket 地址，留空则自动使用站点网址。' value={v('server_ws_url') as string} onChange={(x) => set('server_ws_url', x)} />
                  </div>
                )}

                {/* 邮件设置 */}
                {section === 'email' && (
                  <div className='space-y-4'>
                    <TextField label='SMTP主机' placeholder='smtp.gmail.com' description='SMTP服务器地址，例如：smtp.gmail.com' value={v('email_host') as string} onChange={(x) => set('email_host', x)} />
                    <TextField label='SMTP端口' placeholder='465' description='SMTP服务器端口，常用端口：25, 465, 587' value={v('email_port') as string} onChange={(x) => set('email_port', x)} />
                    <TextField label='SMTP用户名' placeholder='请输入' description='SMTP认证用户名' value={v('email_username') as string} onChange={(x) => set('email_username', x)} />
                    <TextField label='SMTP密码' placeholder='请输入' description='SMTP认证密码或应用专用密码' type='password' value={v('email_password') as string} onChange={(x) => set('email_password', x)} />
                    <SelectField
                      label='加密方式'
                      description='邮件加密方式'
                      value={(v('email_encryption') as string) || 'none'}
                      onChange={(x) => set('email_encryption', x === 'none' ? '' : x)}
                      options={[
                        { value: 'none', label: '无' },
                        { value: 'ssl', label: 'SSL/TLS' },
                        { value: 'tls', label: 'STARTTLS' },
                      ]}
                    />
                    <TextField label='发件人地址' placeholder='请输入' description='发件人邮箱地址' value={v('email_from_address') as string} onChange={(x) => set('email_from_address', x)} />
                    <SwitchField label='邮件提醒' description='开启后用户订阅即将到期或流量不足时会收到邮件通知。' value={v('remind_mail_enable') as boolean} onChange={(b) => set('remind_mail_enable', b)} />
                    <div className='space-y-2'>
                      <Button
                        variant='outline'
                        onClick={() => testMailMutation.mutate()}
                        disabled={testMailMutation.isPending}
                      >
                        <Send className='size-4' /> 发送测试邮件
                      </Button>
                      <p className='text-muted-foreground text-sm'>
                        发送测试邮件以验证配置（请先保存邮件配置）。
                      </p>
                    </div>
                  </div>
                )}

                {/* Telegram设置 */}
                {section === 'telegram' && (
                  <div className='space-y-4'>
                    <SwitchField label='启用Telegram绑定引导' description='开启后将在用户端显示Telegram绑定引导，帮助用户绑定Telegram账户以接收通知。' value={v('telegram_bot_enable') as boolean} onChange={(b) => set('telegram_bot_enable', b)} />
                    <TextField label='机器人令牌' placeholder='0000000000:xxxxxxxxx_xxxxxxxxxxxxxxx' description='请输入从Botfather获取的令牌。' value={v('telegram_bot_token') as string} onChange={(x) => set('telegram_bot_token', x)} />
                    <TextField label='Webhook Base URL' description='这里只填写基础地址，系统会自动拼接 Telegram 的完整 Webhook 回调路径。留空时默认使用站点网址。' placeholder='https://example.com' value={v('telegram_webhook_url') as string} onChange={(x) => set('telegram_webhook_url', x)} />
                    <TextField label='群组链接' placeholder='https://t.me/xxxxxx' description='填写后将在用户端显示或在需要的地方使用。' value={v('telegram_discuss_link') as string} onChange={(x) => set('telegram_discuss_link', x)} />
                    <div className='space-y-2'>
                      <Button
                        variant='outline'
                        onClick={() => webhookMutation.mutate()}
                        disabled={webhookMutation.isPending}
                      >
                        <Webhook className='size-4' /> 一键设置
                      </Button>
                      <p className='text-muted-foreground text-sm'>
                        设置机器人的webhook，不设置将无法收到Telegram通知。
                      </p>
                    </div>
                  </div>
                )}

                {/* APP设置 */}
                {section === 'app' && (
                  <div className='space-y-4'>
                    <TextField label='Windows版本' placeholder='请输入' description='Windows客户端当前版本号' value={v('windows_version') as string} onChange={(x) => set('windows_version', x)} />
                    <TextField label='Windows下载地址' placeholder='请输入' description='Windows客户端下载链接' value={v('windows_download_url') as string} onChange={(x) => set('windows_download_url', x)} />
                    <TextField label='macOS版本' placeholder='请输入' description='macOS客户端当前版本号' value={v('macos_version') as string} onChange={(x) => set('macos_version', x)} />
                    <TextField label='macOS下载地址' placeholder='请输入' description='macOS客户端下载链接' value={v('macos_download_url') as string} onChange={(x) => set('macos_download_url', x)} />
                    <TextField label='Android版本' placeholder='请输入' description='Android客户端当前版本号' value={v('android_version') as string} onChange={(x) => set('android_version', x)} />
                    <TextField label='Android下载地址' placeholder='请输入' description='Android客户端下载链接' value={v('android_download_url') as string} onChange={(x) => set('android_download_url', x)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Main>
    </>
  )
}
