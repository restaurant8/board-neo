import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

export type CertConfig = Record<string, unknown>

export type AdvancedConfigValue = {
  cert_config: CertConfig
  custom_outbounds: unknown[]
  custom_routes: unknown[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: AdvancedConfigValue
  /** 保存即把合并结果回写到主表单。 */
  onSave: (value: AdvancedConfigValue) => void
}

/**
 * 证书模式（对应 cert_config.cert_mode）。
 * 取值沿用项目既有约定（http / dns / self / reality / none）：
 * 后端 ServerService 仅判断 `cert_mode !== 'none'` 后将整个 cert_config 透传给节点，
 * 值的语义由节点后端解释，故此处保持与已部署/已存数据一致。
 * content（Cert Push）对应取值为 'reality'（仅标签显示为 content）。
 */
const CERT_MODES = [
  { value: 'none', label: '不使用 (none)' },
  { value: 'http', label: 'http-01 (ACME)' },
  { value: 'dns', label: 'dns-01 (ACME)' },
  { value: 'self', label: 'self-signed' },
  { value: 'reality', label: 'content (Cert Push)' },
]

function str(obj: Record<string, unknown>, key: string): string {
  const v = obj[key]
  return v == null ? '' : String(v)
}

export function AdvancedConfigDialog({
  open,
  onOpenChange,
  value,
  onSave,
}: Props) {
  const [cert, setCert] = useState<CertConfig>({})
  const [outbounds, setOutbounds] = useState('[]')
  const [routes, setRoutes] = useState('[]')

  useEffect(() => {
    if (!open) return
    const c = { ...(value.cert_config ?? {}) }
    // 兼容旧字段 mode -> cert_mode
    if (c.mode != null && c.cert_mode == null) {
      c.cert_mode = c.mode
      delete c.mode
    }
    if (c.cert_mode == null) c.cert_mode = 'none'
    setCert(c)
    setOutbounds(JSON.stringify(value.custom_outbounds ?? [], null, 2))
    setRoutes(JSON.stringify(value.custom_routes ?? [], null, 2))
  }, [open, value])

  const setCertField = (key: string, v: unknown) =>
    setCert((prev) => ({ ...prev, [key]: v }))

  const certMode = str(cert, 'cert_mode') || 'none'

  const handleSave = () => {
    let parsedOutbounds: unknown[] = []
    let parsedRoutes: unknown[] = []
    try {
      const o = outbounds.trim() ? JSON.parse(outbounds) : []
      if (!Array.isArray(o)) throw new Error()
      parsedOutbounds = o
    } catch {
      toast.error('自定义 Outbounds 必须是合法 JSON 数组')
      return
    }
    try {
      const r = routes.trim() ? JSON.parse(routes) : []
      if (!Array.isArray(r)) throw new Error()
      parsedRoutes = r
    } catch {
      toast.error('自定义 Routes 必须是合法 JSON 数组')
      return
    }
    onSave({
      cert_config: cert,
      custom_outbounds: parsedOutbounds,
      custom_routes: parsedRoutes,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>高级协议配置</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue='tls' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='tls'>TLS</TabsTrigger>
            <TabsTrigger value='outbounds'>自定义 Outbounds</TabsTrigger>
            <TabsTrigger value='routes'>自定义 Routes</TabsTrigger>
          </TabsList>

          <TabsContent value='tls' className='grid gap-4 pt-2'>
            <div className='grid gap-2'>
              <Label>证书模式</Label>
              <Select
                value={certMode}
                onValueChange={(v) => setCertField('cert_mode', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CERT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {certMode === 'http' && (
              <>
                <p className='text-muted-foreground text-xs'>
                  HTTP-01 模式：需要 80 端口可正常访问以完成认证
                </p>
                <div className='grid gap-2'>
                  <Label>证书域名</Label>
                  <Input
                    value={str(cert, 'domain')}
                    onChange={(e) => setCertField('domain', e.target.value)}
                    placeholder='example.com'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>通知邮箱</Label>
                  <Input
                    value={str(cert, 'email')}
                    onChange={(e) => setCertField('email', e.target.value)}
                    placeholder='admin@example.com'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>认证端口</Label>
                  <Input
                    type='number'
                    value={str(cert, 'port')}
                    onChange={(e) =>
                      setCertField(
                        'port',
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    placeholder='80'
                  />
                  <p className='text-muted-foreground text-xs'>
                    ACME 认证端口（默认 80）
                  </p>
                </div>
              </>
            )}

            {certMode === 'dns' && (
              <>
                <p className='text-muted-foreground text-xs'>
                  DNS-01 模式：通过 DNS 解析记录认证，支持申请泛域名证书
                </p>
                <div className='grid gap-2'>
                  <Label>证书域名</Label>
                  <Input
                    value={str(cert, 'domain')}
                    onChange={(e) => setCertField('domain', e.target.value)}
                    placeholder='example.com'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>通知邮箱</Label>
                  <Input
                    value={str(cert, 'email')}
                    onChange={(e) => setCertField('email', e.target.value)}
                    placeholder='admin@example.com'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>DNS 提供商</Label>
                  <Input
                    value={str(cert, 'dns_provider')}
                    onChange={(e) =>
                      setCertField('dns_provider', e.target.value)
                    }
                    placeholder='cloudflare / alidns / dnspod'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>环境变量 (API 密钥)</Label>
                  <Textarea
                    rows={4}
                    className='font-mono text-xs'
                    value={str(cert, 'dns_env')}
                    onChange={(e) => setCertField('dns_env', e.target.value)}
                    placeholder={
                      'CF_API_TOKEN=xxxxxx\nALIDNS_ACCESS_KEY_ID=xxxx'
                    }
                  />
                  <p className='text-muted-foreground text-xs'>
                    每行一个 KEY=VALUE 配置
                  </p>
                </div>
                <a
                  href='#'
                  className='text-primary inline-flex items-center gap-1 text-xs hover:underline'
                >
                  查看 DNS 提供商配置指南
                  <ExternalLink className='size-3' />
                </a>
              </>
            )}

            {certMode === 'self' && (
              <>
                <p className='text-muted-foreground text-xs'>
                  自签名模式：仅需填写域名，证书由节点后端自动生成（10年有效期）
                </p>
                <div className='grid gap-2'>
                  <Label>证书域名</Label>
                  <Input
                    value={str(cert, 'domain')}
                    onChange={(e) => setCertField('domain', e.target.value)}
                    placeholder='example.com'
                  />
                </div>
              </>
            )}

            {certMode === 'reality' && (
              <>
                <p className='text-muted-foreground text-xs'>
                  内容推送模式：直接将证书内容下发至节点
                </p>
                <div className='grid gap-2'>
                  <Label>证书域名</Label>
                  <Input
                    value={str(cert, 'domain')}
                    onChange={(e) => setCertField('domain', e.target.value)}
                    placeholder='example.com'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>证书内容 (Public Key)</Label>
                  <Textarea
                    rows={6}
                    className='font-mono text-xs'
                    value={str(cert, 'cert')}
                    onChange={(e) => setCertField('cert', e.target.value)}
                    placeholder='-----BEGIN CERTIFICATE-----'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>密钥内容 (Private Key)</Label>
                  <Textarea
                    rows={6}
                    className='font-mono text-xs'
                    value={str(cert, 'key')}
                    onChange={(e) => setCertField('key', e.target.value)}
                    placeholder='-----BEGIN RSA PRIVATE KEY-----'
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value='outbounds' className='grid gap-2 pt-2'>
            <Label>custom_outbounds（JSON 数组）</Label>
            <Textarea
              rows={14}
              className='font-mono text-xs'
              value={outbounds}
              onChange={(e) => setOutbounds(e.target.value)}
              placeholder='[]'
            />
          </TabsContent>

          <TabsContent value='routes' className='grid gap-2 pt-2'>
            <Label>custom_routes（JSON 数组）</Label>
            <Textarea
              rows={14}
              className='font-mono text-xs'
              value={routes}
              onChange={(e) => setRoutes(e.target.value)}
              placeholder='[]'
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
