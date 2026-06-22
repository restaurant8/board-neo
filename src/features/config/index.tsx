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
              <TabsTrigger value='invite'>邀请佣金</TabsTrigger>
              <TabsTrigger value='server'>服务器</TabsTrigger>
              <TabsTrigger value='email'>邮件</TabsTrigger>
              <TabsTrigger value='telegram'>Telegram</TabsTrigger>
              <TabsTrigger value='safe'>安全</TabsTrigger>
              <TabsTrigger value='app'>客户端</TabsTrigger>
            </TabsList>

            {/* 站点 */}
            <TabsContent value='site' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='站点名称' value={v('app_name') as string} onChange={(x) => set('app_name', x)} />
              <TextField label='站点描述' value={v('app_description') as string} onChange={(x) => set('app_description', x)} />
              <TextField label='站点 URL' placeholder='https://...' value={v('app_url') as string} onChange={(x) => set('app_url', x)} />
              <TextField label='订阅 URL' placeholder='https://...' value={v('subscribe_url') as string} onChange={(x) => set('subscribe_url', x)} />
              <TextField label='LOGO URL' placeholder='https://...' value={v('logo') as string} onChange={(x) => set('logo', x)} />
              <TextField label='服务条款 URL' placeholder='https://...' value={v('tos_url') as string} onChange={(x) => set('tos_url', x)} />
              <TextField label='货币代码' value={v('currency') as string} onChange={(x) => set('currency', x)} />
              <TextField label='货币符号' value={v('currency_symbol') as string} onChange={(x) => set('currency_symbol', x)} />
              <TextField label='试用套餐 ID' type='number' value={v('try_out_plan_id') as number} onChange={(x) => set('try_out_plan_id', Number(x) || 0)} />
              <TextField label='试用时长（小时）' type='number' value={v('try_out_hour') as number} onChange={(x) => set('try_out_hour', Number(x) || 0)} />
              <SwitchField label='强制 HTTPS' value={!!num('force_https')} onChange={(b) => set('force_https', b ? 1 : 0)} />
              <SwitchField label='停止注册' value={!!num('stop_register')} onChange={(b) => set('stop_register', b ? 1 : 0)} />
              <SwitchField label='工单必须等待回复' value={v('ticket_must_wait_reply') as boolean} onChange={(b) => set('ticket_must_wait_reply', b)} />
            </TabsContent>

            {/* 订阅 */}
            <TabsContent value='subscribe' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='订阅路径' description='订阅地址前缀，默认 s' value={v('subscribe_path') as string} onChange={(x) => set('subscribe_path', x)} />
              <SelectField
                label='流量重置方式'
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
              <SwitchField label='允许变更套餐' value={v('plan_change_enable') as boolean} onChange={(b) => set('plan_change_enable', b)} />
              <SwitchField label='启用余量折算' value={v('surplus_enable') as boolean} onChange={(b) => set('surplus_enable', b)} />
              <SwitchField label='向节点展示用户信息' value={v('show_info_to_server_enable') as boolean} onChange={(b) => set('show_info_to_server_enable', b)} />
              <SwitchField label='向节点展示协议' value={v('show_protocol_to_server_enable') as boolean} onChange={(b) => set('show_protocol_to_server_enable', b)} />
              <SwitchField label='默认到期提醒' value={v('default_remind_expire') as boolean} onChange={(b) => set('default_remind_expire', b)} />
              <SwitchField label='默认流量提醒' value={v('default_remind_traffic') as boolean} onChange={(b) => set('default_remind_traffic', b)} />
              <TextField label='新购事件 ID' type='number' value={v('new_order_event_id') as number} onChange={(x) => set('new_order_event_id', Number(x) || 0)} />
              <TextField label='续费事件 ID' type='number' value={v('renew_order_event_id') as number} onChange={(x) => set('renew_order_event_id', Number(x) || 0)} />
              <TextField label='变更事件 ID' type='number' value={v('change_order_event_id') as number} onChange={(x) => set('change_order_event_id', Number(x) || 0)} />
            </TabsContent>

            {/* 邀请佣金 */}
            <TabsContent value='invite' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='佣金比例（%）' type='number' value={v('invite_commission') as number} onChange={(x) => set('invite_commission', Number(x) || 0)} />
              <TextField label='邀请码生成上限' type='number' value={v('invite_gen_limit') as number} onChange={(x) => set('invite_gen_limit', Number(x) || 0)} />
              <TextField label='提现门槛' type='number' value={v('commission_withdraw_limit') as number} onChange={(x) => set('commission_withdraw_limit', x === '' ? null : Number(x))} />
              <SwitchField label='强制使用邀请码' value={v('invite_force') as boolean} onChange={(b) => set('invite_force', b)} />
              <SwitchField label='邀请码永不过期' value={v('invite_never_expire') as boolean} onChange={(b) => set('invite_never_expire', b)} />
              <SwitchField label='首单返佣' value={v('commission_first_time_enable') as boolean} onChange={(b) => set('commission_first_time_enable', b)} />
              <SwitchField label='自动确认佣金' value={v('commission_auto_check_enable') as boolean} onChange={(b) => set('commission_auto_check_enable', b)} />
              <SwitchField label='关闭提现' value={v('withdraw_close_enable') as boolean} onChange={(b) => set('withdraw_close_enable', b)} />
              <SwitchField label='启用三级分销' value={v('commission_distribution_enable') as boolean} onChange={(b) => set('commission_distribution_enable', b)} />
              <TextField label='一级分销比例（%）' type='number' value={v('commission_distribution_l1') as number} onChange={(x) => set('commission_distribution_l1', x === '' ? null : Number(x))} />
              <TextField label='二级分销比例（%）' type='number' value={v('commission_distribution_l2') as number} onChange={(x) => set('commission_distribution_l2', x === '' ? null : Number(x))} />
              <TextField label='三级分销比例（%）' type='number' value={v('commission_distribution_l3') as number} onChange={(x) => set('commission_distribution_l3', x === '' ? null : Number(x))} />
            </TabsContent>

            {/* 服务器 */}
            <TabsContent value='server' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='通讯密钥' description='长度需大于 16 位' value={v('server_token') as string} onChange={(x) => set('server_token', x)} />
              <TextField label='拉取间隔（秒）' type='number' value={v('server_pull_interval') as number} onChange={(x) => set('server_pull_interval', Number(x) || 0)} />
              <TextField label='推送间隔（秒）' type='number' value={v('server_push_interval') as number} onChange={(x) => set('server_push_interval', Number(x) || 0)} />
              <SelectField
                label='流量统计模式'
                value={v('traffic_stats_mode') as string}
                onChange={(x) => set('traffic_stats_mode', x)}
                options={[
                  { value: 'off', label: '关闭' },
                  { value: 'privacy', label: '隐私模式' },
                  { value: 'diagnostic', label: '诊断模式' },
                ]}
              />
              <TextField label='统计间隔（分钟）' type='number' value={v('traffic_stats_interval') as number} onChange={(x) => set('traffic_stats_interval', Number(x) || 0)} />
              <TextField label='设备限制模式' type='number' value={v('device_limit_mode') as number} onChange={(x) => set('device_limit_mode', Number(x) || 0)} />
              <SwitchField label='启用 WebSocket' value={v('server_ws_enable') as boolean} onChange={(b) => set('server_ws_enable', b)} />
              <TextField label='WebSocket URL' placeholder='https://...' value={v('server_ws_url') as string} onChange={(x) => set('server_ws_url', x)} />
            </TabsContent>

            {/* 邮件 */}
            <TabsContent value='email' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='SMTP 主机' value={v('email_host') as string} onChange={(x) => set('email_host', x)} />
              <TextField label='SMTP 端口' value={v('email_port') as string} onChange={(x) => set('email_port', x)} />
              <TextField label='SMTP 用户名' value={v('email_username') as string} onChange={(x) => set('email_username', x)} />
              <TextField label='SMTP 密码' type='password' value={v('email_password') as string} onChange={(x) => set('email_password', x)} />
              <SelectField
                label='加密方式'
                value={(v('email_encryption') as string) || 'none'}
                onChange={(x) => set('email_encryption', x === 'none' ? '' : x)}
                options={[
                  { value: 'tls', label: 'TLS' },
                  { value: 'ssl', label: 'SSL' },
                  { value: 'none', label: '无' },
                ]}
              />
              <TextField label='发件人地址' value={v('email_from_address') as string} onChange={(x) => set('email_from_address', x)} />
              <SwitchField label='启用到期/流量提醒邮件' value={v('remind_mail_enable') as boolean} onChange={(b) => set('remind_mail_enable', b)} />
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
              <SwitchField label='启用 Telegram 机器人' value={v('telegram_bot_enable') as boolean} onChange={(b) => set('telegram_bot_enable', b)} />
              <TextField label='Bot Token' value={v('telegram_bot_token') as string} onChange={(x) => set('telegram_bot_token', x)} />
              <TextField label='Webhook URL' description='留空则使用站点 URL' placeholder='https://...' value={v('telegram_webhook_url') as string} onChange={(x) => set('telegram_webhook_url', x)} />
              <TextField label='讨论组链接' placeholder='https://...' value={v('telegram_discuss_link') as string} onChange={(x) => set('telegram_discuss_link', x)} />
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
              <TextField label='后台路径 secure_path' description='最小 8 位，仅字母或数字' value={v('secure_path') as string} onChange={(x) => set('secure_path', x)} />
              <SwitchField label='开启邮箱验证' value={v('email_verify') as boolean} onChange={(b) => set('email_verify', b)} />
              <SwitchField label='安全模式' value={v('safe_mode_enable') as boolean} onChange={(b) => set('safe_mode_enable', b)} />
              <SwitchField label='邮箱后缀白名单' value={v('email_whitelist_enable') as boolean} onChange={(b) => set('email_whitelist_enable', b)} />
              <SwitchField label='限制 Gmail 多别名' value={v('email_gmail_limit_enable') as boolean} onChange={(b) => set('email_gmail_limit_enable', b)} />
              <SwitchField label='启用人机验证' value={v('captcha_enable') as boolean} onChange={(b) => set('captcha_enable', b)} />
              <SelectField
                label='人机验证类型'
                value={v('captcha_type') as string}
                onChange={(x) => set('captcha_type', x)}
                options={[
                  { value: 'recaptcha', label: 'reCAPTCHA' },
                  { value: 'recaptcha-v3', label: 'reCAPTCHA v3' },
                  { value: 'turnstile', label: 'Turnstile' },
                ]}
              />
              <SwitchField label='按 IP 限制注册' value={v('register_limit_by_ip_enable') as boolean} onChange={(b) => set('register_limit_by_ip_enable', b)} />
              <TextField label='注册限制次数' type='number' value={v('register_limit_count') as number} onChange={(x) => set('register_limit_count', Number(x) || 0)} />
              <TextField label='注册限制时间（分钟）' type='number' value={v('register_limit_expire') as number} onChange={(x) => set('register_limit_expire', Number(x) || 0)} />
              <SwitchField label='密码错误限制' value={v('password_limit_enable') as boolean} onChange={(b) => set('password_limit_enable', b)} />
              <TextField label='密码错误次数' type='number' value={v('password_limit_count') as number} onChange={(x) => set('password_limit_count', Number(x) || 0)} />
              <TextField label='密码错误锁定（分钟）' type='number' value={v('password_limit_expire') as number} onChange={(x) => set('password_limit_expire', Number(x) || 0)} />
            </TabsContent>

            {/* 客户端 */}
            <TabsContent value='app' className='grid max-w-2xl gap-4 pt-4'>
              <TextField label='Windows 版本' value={v('windows_version') as string} onChange={(x) => set('windows_version', x)} />
              <TextField label='Windows 下载地址' value={v('windows_download_url') as string} onChange={(x) => set('windows_download_url', x)} />
              <TextField label='macOS 版本' value={v('macos_version') as string} onChange={(x) => set('macos_version', x)} />
              <TextField label='macOS 下载地址' value={v('macos_download_url') as string} onChange={(x) => set('macos_download_url', x)} />
              <TextField label='Android 版本' value={v('android_version') as string} onChange={(x) => set('android_version', x)} />
              <TextField label='Android 下载地址' value={v('android_download_url') as string} onChange={(x) => set('android_download_url', x)} />
            </TabsContent>
          </Tabs>
        )}
      </Main>
    </>
  )
}
