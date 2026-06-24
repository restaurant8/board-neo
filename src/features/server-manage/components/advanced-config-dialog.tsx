import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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

/** 证书模式（对应 ServerService 读取的 cert_config.cert_mode）。 */
const CERT_MODES = [
  { value: 'none', label: '不使用 (none)' },
  { value: 'http', label: 'HTTP-01 (ACME)' },
  { value: 'dns', label: 'DNS-01 (ACME)' },
  { value: 'self', label: '自签名 (self-signed)' },
  { value: 'reality', label: '证书推送 (content / Cert Push)' },
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
  const showContent = certMode === 'reality' || certMode === 'self'
  const showAcme = certMode === 'http' || certMode === 'dns'

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
          <DialogDescription>
            证书模式、自定义 Outbounds / Routes；保存后合并进节点提交对象。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue='tls' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='tls'>TLS</TabsTrigger>
            <TabsTrigger value='outbounds'>自定义 Outbounds</TabsTrigger>
            <TabsTrigger value='routes'>自定义 Routes</TabsTrigger>
          </TabsList>

          <TabsContent value='tls' className='grid gap-4 pt-2'>
            <div className='grid gap-2'>
              <Label>证书模式 (cert_mode)</Label>
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
              <p className='text-muted-foreground text-xs'>
                选择「不使用」时不会向节点下发证书配置。
              </p>
            </div>

            {showAcme && (
              <div className='grid grid-cols-2 gap-4'>
                <div className='grid gap-2'>
                  <Label>域名 (domain)</Label>
                  <Input
                    value={str(cert, 'domain')}
                    onChange={(e) => setCertField('domain', e.target.value)}
                    placeholder='如 node.example.com'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>邮箱 (email)</Label>
                  <Input
                    value={str(cert, 'email')}
                    onChange={(e) => setCertField('email', e.target.value)}
                    placeholder='如 admin@example.com'
                  />
                </div>
              </div>
            )}

            {showContent && (
              <>
                <div className='grid gap-2'>
                  <Label>证书 (cert)</Label>
                  <Textarea
                    rows={6}
                    className='font-mono text-xs'
                    value={str(cert, 'cert')}
                    onChange={(e) => setCertField('cert', e.target.value)}
                    placeholder='-----BEGIN CERTIFICATE-----'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>私钥 (key)</Label>
                  <Textarea
                    rows={6}
                    className='font-mono text-xs'
                    value={str(cert, 'key')}
                    onChange={(e) => setCertField('key', e.target.value)}
                    placeholder='-----BEGIN PRIVATE KEY-----'
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
          <Button onClick={handleSave}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
