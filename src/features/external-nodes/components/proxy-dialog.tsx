import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  type ExternalNodeSource,
  type ExternalPullProxySettings,
  saveExternalPullProxy,
  testExternalPullProxy,
} from '../api'

type ProxyForm = {
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: ExternalPullProxySettings
  testSource?: ExternalNodeSource
}

export function ExternalPullProxyDialog({
  open,
  onOpenChange,
  current,
  testSource,
}: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ProxyForm>({
    enabled: current.enabled,
    host: current.host,
    port: current.port || 1080,
    username: current.username,
    password: '',
  })

  const payload = () => ({
    enabled: form.enabled,
    host: form.host.trim(),
    port: form.port,
    username: form.username.trim(),
    password: form.password,
  })

  const validate = () => {
    if (!form.enabled) return true
    if (!form.host.trim()) {
      toast.error('请输入 SOCKS5 代理地址')
      return false
    }
    if (!form.port || form.port < 1 || form.port > 65535) {
      toast.error('请输入有效的 SOCKS5 代理端口')
      return false
    }
    if (!!form.username.trim() !== !!form.password) {
      const keepingExistingPassword =
        current.password_configured && form.username.trim() === current.username
      if (!keepingExistingPassword) {
        toast.error('SOCKS5 代理用户名和密码必须同时填写')
        return false
      }
    }
    return true
  }

  const saveMutation = useMutation({
    mutationFn: saveExternalPullProxy,
    onSuccess: () => {
      toast.success('统一拉取代理设置已保存')
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      await saveExternalPullProxy(payload())
      if (!testSource?.subscription_url) {
        return null
      }
      return testExternalPullProxy({
        source_id: testSource.id,
        subscription_url: testSource.subscription_url,
        user_agent: testSource.user_agent,
        proxy_mode: 'inherit',
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      if (!result) {
        toast.success('设置已保存；添加订阅来源后可测试实际拉取')
        return
      }
      toast.success(
        `${result.via_proxy ? '代理' : '直连'}拉取成功，收到 ${formatBytes(result.bytes)}，耗时 ${result.elapsed_ms}ms`
      )
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      toast.warning('统一代理设置已保存，但测试拉取失败')
      handleServerError(error)
    },
  })

  const busy = saveMutation.isPending || testMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>统一订阅拉取代理</DialogTitle>
          <DialogDescription>
            仅作用于选择“使用统一设置”的外部订阅拉取，不会修改服务器、Nginx、PHP
            或其他功能的网络代理。
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-2'>
          <div className='flex items-center gap-3 rounded-md border p-4'>
            <Switch
              id='external-global-proxy-enabled'
              checked={form.enabled}
              onCheckedChange={(enabled) =>
                setForm((value) => ({ ...value, enabled }))
              }
            />
            <div>
              <Label htmlFor='external-global-proxy-enabled'>
                启用统一 SOCKS5 代理
              </Label>
              <p className='text-xs text-muted-foreground'>
                关闭时，继承统一设置的来源将直接连接上游。
              </p>
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='代理地址'>
              <Input
                disabled={!form.enabled}
                value={form.host}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    host: event.target.value,
                  }))
                }
                placeholder='127.0.0.1 或 proxy.example.com'
              />
            </Field>
            <Field label='代理端口'>
              <Input
                disabled={!form.enabled}
                type='number'
                min={1}
                max={65535}
                value={form.port}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    port: Number(event.target.value),
                  }))
                }
                placeholder='1080'
              />
            </Field>
            <Field label='用户名（可选）'>
              <Input
                disabled={!form.enabled}
                autoComplete='off'
                value={form.username}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    username: event.target.value,
                  }))
                }
              />
            </Field>
            <Field
              label='密码（可选）'
              hint={
                current.password_configured
                  ? '已保存；留空保持原密码。清空用户名可移除认证。'
                  : undefined
              }
            >
              <Input
                disabled={!form.enabled}
                type='password'
                autoComplete='new-password'
                value={form.password}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    password: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <p className='text-xs text-muted-foreground'>
            目标域名仍由本站服务器解析并校验公网 IP，不使用代理端
            DNS，以免绕过现有的 SSRF 内网防护。
          </p>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={busy}
            onClick={() => validate() && testMutation.mutate()}
          >
            {testMutation.isPending ? '测试中…' : '保存并测试'}
          </Button>
          <Button
            type='button'
            disabled={busy}
            onClick={() => validate() && saveMutation.mutate(payload())}
          >
            {saveMutation.isPending ? '保存中…' : '保存设置'}
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
