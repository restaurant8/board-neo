import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Send, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

/** Flatten the grouped config into a single key→value map for editing. */
function flatten(data: ConfigData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  Object.values(data).forEach((group) => {
    if (group && typeof group === 'object') Object.assign(out, group)
  })
  return out
}

export function ConfigPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })

  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())

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

      <Main className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>系统配置</h2>
            <p className='text-muted-foreground'>
              管理站点、订阅、佣金、支付、邮件、Telegram 与安全相关设置。
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || dirty.size === 0}
          >
            <Save className='size-4' /> 保存{dirty.size > 0 ? `（${dirty.size}）` : ''}
          </Button>
        </div>

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : (
          <Tabs defaultValue='site' className='w-full'>
            <TabsList className='flex-wrap'>
              <TabsTrigger value='site'>站点</TabsTrigger>
              <TabsTrigger value='subscribe'>订阅</TabsTrigger>
              <TabsTrigger value='subscribe_template'>订阅模板</TabsTrigger>
              <TabsTrigger value='invite'>邀请佣金</TabsTrigger>
              <TabsTrigger value='server'>服务器</TabsTrigger>
              <TabsTrigger value='email'>邮件</TabsTrigger>
              <TabsTrigger value='telegram'>Telegram</TabsTrigger>
              <TabsTrigger value='safe'>安全</TabsTrigger>
              <TabsTrigger value='app'>客户端</TabsTrigger>
            </TabsList>

            {/* 站点 */}
            <TabsContent value='site' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='站点名称' placeholder='请输入站点名称' description='用于显示需要站点名称的地方。' value={v('app_name') as string} onChange={(x) => set('app_name', x)} />
              <TextField label='站点描述' placeholder='请输入站点描述' description='用于显示需要站点描述的地方。' value={v('app_description') as string} onChange={(x) => set('app_description', x)} />
              <TextField label='站点 URL' placeholder='请输入站点URL，末尾不要/' description='当前网站最新网址，将会在邮件等需要用于网址处体现。' value={v('app_url') as string} onChange={(x) => set('app_url', x)} />
              <TextField label='订阅 URL' placeholder="用于订阅所使用，多个订阅地址用','隔开.留空则为站点URL。" description='用于订阅所使用，留空则为站点URL。' value={v('subscribe_url') as string} onChange={(x) => set('subscribe_url', x)} />
              <TextField label='LOGO URL' placeholder='请输入LOGO URL，末尾不要/' description='用于显示需要LOGO的地方。' value={v('logo') as string} onChange={(x) => set('logo', x)} />
              <TextField label='服务条款 URL' placeholder='请输入用户条款URL，末尾不要/' description='用于跳转到用户条款(TOS)' value={v('tos_url') as string} onChange={(x) => set('tos_url', x)} />
              <TextField label='货币代码' placeholder='CNY' description='仅用于展示使用，更改后系统中所有的货币单位都将发生变更。' value={v('currency') as string} onChange={(x) => set('currency', x)} />
              <TextField label='货币符号' placeholder='¥' description='仅用于展示使用，更改后系统中所有的货币单位都将发生变更。' value={v('currency_symbol') as string} onChange={(x) => set('currency_symbol', x)} />
              <TextField label='试用套餐 ID' placeholder='关闭' description='选择需要试用的订阅，如果没有选项请先前往订阅管理添加。' type='number' value={v('try_out_plan_id') as number} onChange={(x) => set('try_out_plan_id', Number(x) || 0)} />
              <TextField label='试用时长（小时）' placeholder='0' description='注册试用时长，单位为小时。' type='number' value={v('try_out_hour') as number} onChange={(x) => set('try_out_hour', Number(x) || 0)} />
              <SwitchField label='强制 HTTPS' description='当站点没有使用HTTPS，CDN或反代开启强制HTTPS时需要开启。' value={!!num('force_https')} onChange={(b) => set('force_https', b ? 1 : 0)} />
              <SwitchField label='停止注册' description='开启后任何人都将无法进行注册。' value={!!num('stop_register')} onChange={(b) => set('stop_register', b ? 1 : 0)} />
              <SwitchField label='工单必须等待回复' description='开启后，用户在管理员回复前无法在同一工单内连续发送消息。' value={v('ticket_must_wait_reply') as boolean} onChange={(b) => set('ticket_must_wait_reply', b)} />
            </TabsContent>

            {/* 订阅 */}
            <TabsContent value='subscribe' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='订阅路径' description='订阅路径，修改后将会改变原有的subscribe路径' value={v('subscribe_path') as string} onChange={(x) => set('subscribe_path', x)} />
              <SelectField
                label='流量重置方式'
                description='全局流量重置方式，默认每月1号。可以在订阅管理为订阅单独设置。'
                value={num('reset_traffic_method')}
                onChange={(x) => set('reset_traffic_method', Number(x))}
                options={[
                  { value: '0', label: '每月1号' },
                  { value: '1', label: '按订阅周期' },
                  { value: '2', label: '不重置' },
                  { value: '3', label: '每年1月1日' },
                  { value: '4', label: '按年付月度重置' },
                ]}
              />
              <SwitchField label='允许变更套餐' description='开启后用户将会可以对订阅计划进行变更。' value={v('plan_change_enable') as boolean} onChange={(b) => set('plan_change_enable', b)} />
              <SwitchField label='启用余量折算' description='开启后用户更换订阅将会由系统对原有订阅进行折抵，方案参考文档。' value={v('surplus_enable') as boolean} onChange={(b) => set('surplus_enable', b)} />
              <SwitchField label='向节点展示用户信息' description='开启后将会在用户订阅节点时输出订阅信息。' value={v('show_info_to_server_enable') as boolean} onChange={(b) => set('show_info_to_server_enable', b)} />
              <SwitchField label='向节点展示协议' description='开启后订阅线路会附带协议名称（例如: [Hy2]香港）' value={v('show_protocol_to_server_enable') as boolean} onChange={(b) => set('show_protocol_to_server_enable', b)} />
              <SwitchField label='默认到期提醒' description='开启后默认向用户发送订阅到期提醒。' value={v('default_remind_expire') as boolean} onChange={(b) => set('default_remind_expire', b)} />
              <SwitchField label='默认流量提醒' description='开启后默认向用户发送订阅流量不足提醒。' value={v('default_remind_traffic') as boolean} onChange={(b) => set('default_remind_traffic', b)} />
              <TextField label='新购事件 ID' description='新购订阅完成时将触发该任务。0=不执行任何动作，1=重置用户流量。' type='number' value={v('new_order_event_id') as number} onChange={(x) => set('new_order_event_id', Number(x) || 0)} />
              <TextField label='续费事件 ID' description='续费订阅完成时将触发该任务。0=不执行任何动作，1=重置用户流量。' type='number' value={v('renew_order_event_id') as number} onChange={(x) => set('renew_order_event_id', Number(x) || 0)} />
              <TextField label='变更事件 ID' description='变更订阅完成时将触发该任务。0=不执行任何动作，1=重置用户流量。' type='number' value={v('change_order_event_id') as number} onChange={(x) => set('change_order_event_id', Number(x) || 0)} />
            </TabsContent>

            {/* 订阅模板 */}
            <TabsContent value='subscribe_template' className='grid max-w-3xl gap-4 pt-4'>
              <p className='text-muted-foreground text-sm'>
                自定义各客户端的订阅模板。留空则使用系统内置默认模板。
              </p>
              <TextareaField label='Clash' description='配置 Clash 的订阅模板格式' rows={10} value={v('subscribe_template_clash') as string} onChange={(x) => set('subscribe_template_clash', x)} placeholder='留空使用默认模板' />
              <TextareaField label='Clash Meta / Mihomo' description='配置 Clash Meta 的订阅模板格式' rows={10} value={v('subscribe_template_clashmeta') as string} onChange={(x) => set('subscribe_template_clashmeta', x)} placeholder='留空使用默认模板' />
              <TextareaField label='Stash' description='配置 Stash 的订阅模板格式' rows={10} value={v('subscribe_template_stash') as string} onChange={(x) => set('subscribe_template_stash', x)} placeholder='留空使用默认模板' />
              <TextareaField label='Sing-box' description='配置 Sing-box 的订阅模板格式' rows={10} value={v('subscribe_template_singbox') as string} onChange={(x) => set('subscribe_template_singbox', x)} placeholder='留空使用默认模板' />
              <TextareaField label='Surge' description='配置 Surge 订阅模板，支持 Surge 配置文件格式' rows={10} value={v('subscribe_template_surge') as string} onChange={(x) => set('subscribe_template_surge', x)} placeholder='留空使用默认模板' />
              <TextareaField label='Surfboard' description='配额 Surfboard 订阅模版' rows={10} value={v('subscribe_template_surfboard') as string} onChange={(x) => set('subscribe_template_surfboard', x)} placeholder='留空使用默认模板' />
            </TabsContent>

            {/* 邀请佣金 */}
            <TabsContent value='invite' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='佣金比例（%）' placeholder='请输入佣金百分比' description='默认全局的佣金分配比例，你可以在用户管理单独配置单个比例。' type='number' value={v('invite_commission') as number} onChange={(x) => set('invite_commission', Number(x) || 0)} />
              <TextField label='邀请码生成上限' placeholder='请输入创建上限' description='用户可创建邀请码上限' type='number' value={v('invite_gen_limit') as number} onChange={(x) => set('invite_gen_limit', Number(x) || 0)} />
              <TextField label='提现门槛' placeholder='请输入提现门槛' description='小于门槛金额的提现单将不会被提交。单位：元。' type='number' value={v('commission_withdraw_limit') as number} onChange={(x) => set('commission_withdraw_limit', x === '' ? null : Number(x))} />
              <SwitchField label='强制使用邀请码' description='开启后只有被邀请的用户才可以进行注册。' value={v('invite_force') as boolean} onChange={(b) => set('invite_force', b)} />
              <SwitchField label='邀请码永不过期' description='开启后邀请码被使用后将不会失效，否则使用过后即失效。' value={v('invite_never_expire') as boolean} onChange={(b) => set('invite_never_expire', b)} />
              <SwitchField label='首单返佣' description='开启后被邀请人首次支付时才会产生佣金，可以在用户管理对用户进行单独配置。' value={v('commission_first_time_enable') as boolean} onChange={(b) => set('commission_first_time_enable', b)} />
              <SwitchField label='自动确认佣金' description='开启后佣金将会在订单完成3日后自动进行确认。' value={v('commission_auto_check_enable') as boolean} onChange={(b) => set('commission_auto_check_enable', b)} />
              <SwitchField label='关闭提现' description='关闭后将禁止用户申请提现，且邀请佣金将会直接进入用户余额。' value={v('withdraw_close_enable') as boolean} onChange={(b) => set('withdraw_close_enable', b)} />
              <SwitchField label='启用三级分销' description='开启后将佣金将按照设置的3成比例进行分成，三成比例合计请不要大于100%。' value={v('commission_distribution_enable') as boolean} onChange={(b) => set('commission_distribution_enable', b)} />
              <TextField label='一级分销比例（%）' placeholder='请输入比例，如：50' description='一级邀请人比例' type='number' value={v('commission_distribution_l1') as number} onChange={(x) => set('commission_distribution_l1', x === '' ? null : Number(x))} />
              <TextField label='二级分销比例（%）' placeholder='请输入比例，如：50' description='二级邀请人比例' type='number' value={v('commission_distribution_l2') as number} onChange={(x) => set('commission_distribution_l2', x === '' ? null : Number(x))} />
              <TextField label='三级分销比例（%）' placeholder='请输入比例，如：50' description='三级邀请人比例' type='number' value={v('commission_distribution_l3') as number} onChange={(x) => set('commission_distribution_l3', x === '' ? null : Number(x))} />
            </TabsContent>

            {/* 服务器 */}
            <TabsContent value='server' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='通讯密钥' placeholder='请输入通讯密钥' description='Xboard与节点通讯的密钥，以便数据不会被他人获取。' value={v('server_token') as string} onChange={(x) => set('server_token', x)} />
              <TextField label='拉取间隔（秒）' placeholder='请输入拉取间隔' description='节点从面板获取数据的间隔频率。单位：秒。' type='number' value={v('server_pull_interval') as number} onChange={(x) => set('server_pull_interval', Number(x) || 0)} />
              <TextField label='推送间隔（秒）' placeholder='请输入推送间隔' description='节点推送数据到面板的间隔频率。单位：秒。' type='number' value={v('server_push_interval') as number} onChange={(x) => set('server_push_interval', Number(x) || 0)} />
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
              <TextField label='流量统计周期（分钟）' placeholder='请输入周期分钟数' description='节点、类别、域名流量统计的聚合周期，单位为分钟。' type='number' value={v('traffic_stats_interval') as number} onChange={(x) => set('traffic_stats_interval', Number(x) || 0)} />
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
              <SwitchField label='启用 WebSocket' description='开启后节点将通过 WebSocket 与面板进行实时通信，延迟更低、推送更及时。' value={v('server_ws_enable') as boolean} onChange={(b) => set('server_ws_enable', b)} />
              <TextField label='WebSocket URL' placeholder='留空则使用站点网址' description='节点连接面板的 WebSocket 地址，留空则自动使用站点网址。' value={v('server_ws_url') as string} onChange={(x) => set('server_ws_url', x)} />
            </TabsContent>

            {/* 邮件 */}
            <TabsContent value='email' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='SMTP 主机' placeholder='smtp.gmail.com' description='SMTP服务器地址，例如：smtp.gmail.com' value={v('email_host') as string} onChange={(x) => set('email_host', x)} />
              <TextField label='SMTP 端口' placeholder='465' description='SMTP服务器端口，常用端口：25, 465, 587' value={v('email_port') as string} onChange={(x) => set('email_port', x)} />
              <TextField label='SMTP 用户名' placeholder='请输入' description='SMTP认证用户名' value={v('email_username') as string} onChange={(x) => set('email_username', x)} />
              <TextField label='SMTP 密码' placeholder='请输入' description='SMTP认证密码或应用专用密码' type='password' value={v('email_password') as string} onChange={(x) => set('email_password', x)} />
              <SelectField
                label='加密方式'
                description='邮件加密方式'
                value={(v('email_encryption') as string) || 'none'}
                onChange={(x) => set('email_encryption', x === 'none' ? '' : x)}
                options={[
                  { value: 'tls', label: 'TLS' },
                  { value: 'ssl', label: 'SSL' },
                  { value: 'none', label: '无' },
                ]}
              />
              <TextField label='发件人地址' placeholder='请输入' description='发件人邮箱地址' value={v('email_from_address') as string} onChange={(x) => set('email_from_address', x)} />
              <SwitchField label='启用到期/流量提醒邮件' description='开启后用户订阅即将到期或流量不足时会收到邮件通知。' value={v('remind_mail_enable') as boolean} onChange={(b) => set('remind_mail_enable', b)} />
              <div>
                <Button
                  variant='outline'
                  onClick={() => testMailMutation.mutate()}
                  disabled={testMailMutation.isPending}
                >
                  <Send className='size-4' /> 发送测试邮件
                </Button>
                <p className='text-muted-foreground mt-1 text-xs'>
                  将向当前管理员邮箱发送测试邮件（请先保存邮件配置）。
                </p>
              </div>
            </TabsContent>

            {/* Telegram */}
            <TabsContent value='telegram' className='grid max-w-2xl gap-4 pt-4'>
              <SwitchField label='启用 Telegram 机器人' description='开启后将在用户端显示Telegram绑定引导，帮助用户绑定Telegram账户以接收通知。' value={v('telegram_bot_enable') as boolean} onChange={(b) => set('telegram_bot_enable', b)} />
              <TextField label='Bot Token' placeholder='0000000000:xxxxxxxxx_xxxxxxxxxxxxxxx' description='请输入从Botfather获取的令牌。' value={v('telegram_bot_token') as string} onChange={(x) => set('telegram_bot_token', x)} />
              <TextField label='Webhook URL' description='这里只填写基础地址，系统会自动拼接 Telegram 的完整 Webhook 回调路径。留空时默认使用站点网址。' placeholder='https://example.com' value={v('telegram_webhook_url') as string} onChange={(x) => set('telegram_webhook_url', x)} />
              <TextField label='讨论组链接' placeholder='https://t.me/xxxxxx' description='填写后将在用户端显示或在需要的地方使用。' value={v('telegram_discuss_link') as string} onChange={(x) => set('telegram_discuss_link', x)} />
              <div>
                <Button
                  variant='outline'
                  onClick={() => webhookMutation.mutate()}
                  disabled={webhookMutation.isPending}
                >
                  <Webhook className='size-4' /> 设置 Webhook
                </Button>
                <p className='text-muted-foreground mt-1 text-xs'>
                  使用上方 Bot Token 调用 Telegram 注册 Webhook 与命令。
                </p>
              </div>
            </TabsContent>

            {/* 安全 */}
            <TabsContent value='safe' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='后台路径 secure_path' placeholder='admin' description='后台管理路径，修改后将会改变原有的admin路径' value={v('secure_path') as string} onChange={(x) => set('secure_path', x)} />
              <SwitchField label='开启邮箱验证' description='开启后将会强制要求用户进行邮箱验证。' value={v('email_verify') as boolean} onChange={(b) => set('email_verify', b)} />
              <SwitchField label='安全模式' description='开启后除了站点URL以外的绑定本站点的域名访问都将会被403。' value={v('safe_mode_enable') as boolean} onChange={(b) => set('safe_mode_enable', b)} />
              <SwitchField label='邮箱后缀白名单' description='开启后在名单中的邮箱后缀才允许进行注册。' value={v('email_whitelist_enable') as boolean} onChange={(b) => set('email_whitelist_enable', b)} />
              <SwitchField label='限制 Gmail 多别名' description='开启后Gmail多别名将无法注册。' value={v('email_gmail_limit_enable') as boolean} onChange={(b) => set('email_gmail_limit_enable', b)} />
              <SwitchField label='启用人机验证' description='开启后用户注册时需要通过验证码验证。' value={v('captcha_enable') as boolean} onChange={(b) => set('captcha_enable', b)} />
              <SelectField
                label='人机验证类型'
                description='选择要使用的验证码服务类型'
                value={v('captcha_type') as string}
                onChange={(x) => set('captcha_type', x)}
                options={[
                  { value: 'recaptcha', label: 'reCAPTCHA' },
                  { value: 'recaptcha-v3', label: 'reCAPTCHA v3' },
                  { value: 'turnstile', label: 'Turnstile' },
                ]}
              />
              <SwitchField label='按 IP 限制注册' description='开启后将限制同一IP的注册次数。' value={v('register_limit_by_ip_enable') as boolean} onChange={(b) => set('register_limit_by_ip_enable', b)} />
              <TextField label='注册限制次数' placeholder='输入最大注册次数' description='同一IP允许的最大注册次数' type='number' value={v('register_limit_count') as number} onChange={(x) => set('register_limit_count', Number(x) || 0)} />
              <TextField label='注册限制时间（分钟）' placeholder='输入限制时长（分钟）' description='注册限制的持续时间（分钟）' type='number' value={v('register_limit_expire') as number} onChange={(x) => set('register_limit_expire', Number(x) || 0)} />
              <SwitchField label='密码错误限制' description='开启后将限制密码尝试次数。' value={v('password_limit_enable') as boolean} onChange={(b) => set('password_limit_enable', b)} />
              <TextField label='密码错误次数' placeholder='输入最大尝试次数' description='允许的最大密码尝试次数' type='number' value={v('password_limit_count') as number} onChange={(x) => set('password_limit_count', Number(x) || 0)} />
              <TextField label='密码错误锁定（分钟）' placeholder='输入锁定时长（分钟）' description='账户锁定的持续时间（分钟）' type='number' value={v('password_limit_expire') as number} onChange={(x) => set('password_limit_expire', Number(x) || 0)} />
            </TabsContent>

            {/* 客户端 */}
            <TabsContent value='app' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='Windows 版本' placeholder='请输入' description='Windows客户端当前版本号' value={v('windows_version') as string} onChange={(x) => set('windows_version', x)} />
              <TextField label='Windows 下载地址' placeholder='请输入' description='Windows客户端下载链接' value={v('windows_download_url') as string} onChange={(x) => set('windows_download_url', x)} />
              <TextField label='macOS 版本' placeholder='请输入' description='macOS客户端当前版本号' value={v('macos_version') as string} onChange={(x) => set('macos_version', x)} />
              <TextField label='macOS 下载地址' placeholder='请输入' description='macOS客户端下载链接' value={v('macos_download_url') as string} onChange={(x) => set('macos_download_url', x)} />
              <TextField label='Android 版本' placeholder='请输入' description='Android客户端当前版本号' value={v('android_version') as string} onChange={(x) => set('android_version', x)} />
              <TextField label='Android 下载地址' placeholder='请输入' description='Android客户端下载链接' value={v('android_download_url') as string} onChange={(x) => set('android_download_url', x)} />
            </TabsContent>
          </Tabs>
        )}
      </Main>
    </>
  )
}
