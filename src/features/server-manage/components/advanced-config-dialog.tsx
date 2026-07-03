import { type ReactNode, useState } from 'react'
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
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

export type CertConfig = Record<string, unknown>

export type AdvancedConfigValue = {
  cert_config: CertConfig
  custom_outbounds: unknown[]
  custom_routes: unknown[]
}

/** protocol_settings.multiplex（vmess/vless/trojan，对齐原版 f4t schema）。 */
export type MultiplexValue = {
  enabled?: boolean
  protocol?: string
  max_connections?: number
  padding?: boolean
  brutal?: { enabled?: boolean; up_mbps?: number; down_mbps?: number }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: AdvancedConfigValue
  /** 保存即把合并结果回写到主表单。 */
  onSave: (value: AdvancedConfigValue) => void
  /** 是否展示「多路复用」Tab（仅 vmess/vless/trojan，对齐原版）。 */
  hasMultiplex?: boolean
  multiplex?: MultiplexValue | null
  onMultiplexChange?: (m: MultiplexValue) => void
}

/**
 * 证书模式（对应 protocol_settings.cert_config.cert_mode）。
 * 取值严格对齐原版：none / http / dns / self / content。
 */
const CERT_MODES = [
  { value: 'none', label: '不使用 (none)' },
  { value: 'http', label: 'http-01 (ACME)' },
  { value: 'dns', label: 'dns-01 (ACME)' },
  { value: 'self', label: 'self-signed' },
  { value: 'content', label: 'content (Cert Push)' },
]

function str(obj: Record<string, unknown>, key: string): string {
  const v = obj[key]
  return v == null ? '' : String(v)
}

/**
 * dns_env 在后端/原版里是对象（z.record(string)），但编辑用逐行 KEY=VALUE 文本。
 * 载入时对象→文本；保存时文本→对象。避免直接 String(obj) 显示成 [object Object]。
 */
function dnsEnvToText(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}=${val ?? ''}`)
      .join('\n')
  }
  return String(v)
}
function dnsEnvToObject(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s) continue
    const i = s.indexOf('=')
    if (i === -1) continue
    const k = s.slice(0, i).trim()
    if (k) out[k] = s.slice(i + 1).trim()
  }
  return out
}

export function AdvancedConfigDialog({
  open,
  onOpenChange,
  value,
  onSave,
  hasMultiplex = false,
  multiplex,
  onMultiplexChange,
}: Props) {
  const [cert, setCert] = useState<CertConfig>({})
  const [outbounds, setOutbounds] = useState('[]')
  const [routes, setRoutes] = useState('[]')
  const [mux, setMux] = useState<MultiplexValue>({})
  // 「打开时装载」用渲染期间派生重置（React 官方模式），避免 effect 里同步 setState
  const [loaded, setLoaded] = useState<{
    open: boolean
    value: AdvancedConfigValue
    multiplex?: MultiplexValue | null
  } | null>(null)

  if (
    loaded?.open !== open ||
    loaded?.value !== value ||
    loaded?.multiplex !== multiplex
  ) {
    setLoaded({ open, value, multiplex })
    if (open) {
      const c = { ...(value.cert_config ?? {}) }
      // 兼容旧字段 mode -> cert_mode
      if (c.mode != null && c.cert_mode == null) {
        c.cert_mode = c.mode
        delete c.mode
      }
      if (c.cert_mode == null) c.cert_mode = 'none'
      // dns_env 存储为对象，编辑用逐行文本
      c.dns_env = dnsEnvToText(c.dns_env)
      setCert(c)
      setOutbounds(JSON.stringify(value.custom_outbounds ?? [], null, 2))
      setRoutes(JSON.stringify(value.custom_routes ?? [], null, 2))
      setMux({ ...(multiplex ?? {}) })
    }
  }

  const setCertField = (key: string, v: unknown) =>
    setCert((prev) => ({ ...prev, [key]: v }))

  const certMode = str(cert, 'cert_mode') || 'none'

  /** 解析 JSON 数组文本；空文本视为 []，非法或非数组返回 null。 */
  const parseJsonArray = (text: string): unknown[] | null => {
    try {
      const v = text.trim() ? JSON.parse(text) : []
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }

  const handleSave = () => {
    const parsedOutbounds = parseJsonArray(outbounds)
    if (!parsedOutbounds) {
      toast.error('自定义 Outbounds 必须是合法 JSON 数组')
      return
    }
    const parsedRoutes = parseJsonArray(routes)
    if (!parsedRoutes) {
      toast.error('自定义 Routes 必须是合法 JSON 数组')
      return
    }
    onSave({
      // dns_env 回存为对象（后端/原版结构）
      cert_config: { ...cert, dns_env: dnsEnvToObject(str(cert, 'dns_env')) },
      custom_outbounds: parsedOutbounds,
      custom_routes: parsedRoutes,
    })
    if (hasMultiplex) onMultiplexChange?.(mux)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <Tabs defaultValue='tls' className='w-full'>
          <DialogHeader className='px-6 pb-2 pt-6'>
            <div className='mb-2 flex items-center justify-between'>
              <DialogTitle className='font-mono text-sm tracking-wide'>
                高级协议配置
              </DialogTitle>
            </div>
            <TabsList
              className='grid w-full rounded-lg bg-muted/50 p-1'
              style={{
                gridTemplateColumns: `repeat(${hasMultiplex ? 4 : 3}, minmax(0, 1fr))`,
              }}
            >
              <TabsTrigger
                value='tls'
                className='text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm'
              >
                TLS
              </TabsTrigger>
              {hasMultiplex && (
                <TabsTrigger
                  value='multiplex'
                  className='text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm'
                >
                  多路复用
                </TabsTrigger>
              )}
              <TabsTrigger
                value='outbounds'
                className='text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm'
              >
                自定义 Outbounds
              </TabsTrigger>
              <TabsTrigger
                value='routes'
                className='text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm'
              >
                自定义 Routes
              </TabsTrigger>
            </TabsList>
          </DialogHeader>

          {/* 中间内容区可滚动，避免证书内容过长把底部 Save 顶出视口 */}
          <div className='max-h-[60vh] min-h-[350px] overflow-y-auto px-6 py-4'>
          {hasMultiplex && (
            <TabsContent
              value='multiplex'
              className='mt-0 space-y-4 duration-200 animate-in fade-in-50'
            >
              <MultiplexPanel mux={mux} setMux={setMux} />
            </TabsContent>
          )}
          <TabsContent value='tls' className='mt-0 grid gap-4 duration-200 animate-in fade-in-50'>
            <div className='grid gap-2'>
              <Label className='font-mono text-[11px] text-muted-foreground'>
                证书模式
              </Label>
              <Select
                value={certMode}
                onValueChange={(v) => setCertField('cert_mode', v)}
              >
                <SelectTrigger className='font-mono text-xs'>
                  <SelectValue placeholder='none' />
                </SelectTrigger>
                <SelectContent>
                  {CERT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='font-mono text-[11px] text-muted-foreground'>
                选择证书申请方式，仅部分后端节点支持
              </p>
            </div>

            {(certMode === 'http' ||
              certMode === 'dns' ||
              certMode === 'self' ||
              certMode === 'content') && (
              <Separator className='opacity-40' />
            )}

            {certMode === 'http' && (
              <>
                <p className='font-mono text-[11px] text-muted-foreground'>
                  HTTP-01 模式：需要 80 端口可正常访问以完成认证
                </p>
                <div className='grid grid-cols-2 gap-4'>
                  <CertField label='证书域名'>
                    <Input
                      value={str(cert, 'domain')}
                      onChange={(e) => setCertField('domain', e.target.value)}
                      placeholder='example.com'
                      className='font-mono text-xs'
                    />
                  </CertField>
                  <CertField label='通知邮箱'>
                    <Input
                      value={str(cert, 'email')}
                      onChange={(e) => setCertField('email', e.target.value)}
                      placeholder='admin@example.com'
                      className='font-mono text-xs'
                    />
                  </CertField>
                </div>
                <CertField label='认证端口'>
                  <Input
                    type='number'
                    value={str(cert, 'http_port')}
                    onChange={(e) =>
                      setCertField(
                        'http_port',
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    placeholder='80'
                    className='font-mono text-xs'
                  />
                  <p className='font-mono text-[11px] text-muted-foreground'>
                    ACME 认证端口 (默认 80)
                  </p>
                </CertField>
              </>
            )}

            {certMode === 'dns' && (
              <>
                <p className='font-mono text-[11px] text-muted-foreground'>
                  DNS-01 模式：通过 DNS 解析记录认证，支持申请泛域名证书
                </p>
                <div className='grid grid-cols-2 gap-4'>
                  <CertField label='证书域名'>
                    <Input
                      value={str(cert, 'domain')}
                      onChange={(e) => setCertField('domain', e.target.value)}
                      placeholder='example.com'
                      className='font-mono text-xs'
                    />
                  </CertField>
                  <CertField label='通知邮箱'>
                    <Input
                      value={str(cert, 'email')}
                      onChange={(e) => setCertField('email', e.target.value)}
                      placeholder='admin@example.com'
                      className='font-mono text-xs'
                    />
                  </CertField>
                </div>
                <CertField label='DNS 提供商'>
                  <Input
                    value={str(cert, 'dns_provider')}
                    onChange={(e) =>
                      setCertField('dns_provider', e.target.value)
                    }
                    placeholder='cloudflare / alidns / dnspod'
                    className='font-mono text-xs'
                  />
                  <a
                    href='https://go-acme.github.io/lego/dns/'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline'
                  >
                    查看 DNS 提供商配置指南
                    <ExternalLink className='size-3' />
                  </a>
                </CertField>
                <CertField label='环境变量 (API 密钥)'>
                  <Textarea
                    rows={4}
                    className='border-border/50 bg-muted/30 font-mono text-[11px]'
                    value={str(cert, 'dns_env')}
                    onChange={(e) => setCertField('dns_env', e.target.value)}
                    placeholder={'CF_API_TOKEN=xxxxxx\nALIDNS_ACCESS_KEY_ID=xxxx'}
                  />
                  <p className='font-mono text-[11px] text-muted-foreground'>
                    每行一个 KEY=VALUE 配置
                  </p>
                </CertField>
              </>
            )}

            {certMode === 'self' && (
              <>
                <p className='font-mono text-[11px] text-muted-foreground'>
                  自签名模式：仅需填写域名，证书由节点后端自动生成（10年有效期）
                </p>
                <CertField label='证书域名'>
                  <Input
                    value={str(cert, 'domain')}
                    onChange={(e) => setCertField('domain', e.target.value)}
                    placeholder='example.com'
                    className='font-mono text-xs'
                  />
                </CertField>
              </>
            )}

            {certMode === 'content' && (
              <>
                <p className='font-mono text-[11px] text-muted-foreground'>
                  内容推送模式：直接将证书内容下发至节点
                </p>
                <CertField label='证书域名'>
                  <Input
                    value={str(cert, 'domain')}
                    onChange={(e) => setCertField('domain', e.target.value)}
                    placeholder='example.com'
                    className='font-mono text-xs'
                  />
                </CertField>
                <CertField label='证书内容 (Public Key)'>
                  <Textarea
                    rows={6}
                    className='border-border/50 bg-muted/30 font-mono text-[11px]'
                    value={str(cert, 'cert_content')}
                    onChange={(e) => setCertField('cert_content', e.target.value)}
                    placeholder='-----BEGIN CERTIFICATE-----'
                  />
                </CertField>
                <CertField label='密钥内容 (Private Key)'>
                  <Textarea
                    rows={6}
                    className='border-border/50 bg-muted/30 font-mono text-[11px]'
                    value={str(cert, 'key_content')}
                    onChange={(e) => setCertField('key_content', e.target.value)}
                    placeholder='-----BEGIN RSA PRIVATE KEY-----'
                  />
                </CertField>
              </>
            )}
          </TabsContent>

          <TabsContent
            value='outbounds'
            className='mt-0 duration-200 animate-in fade-in-50'
          >
            <div className='space-y-3'>
              <Label className='font-mono text-[11px] italic text-muted-foreground'>
                自定义Outbounds (JSON)
              </Label>
              <Textarea
                rows={14}
                className='min-h-[300px] border-border/50 bg-muted/30 font-mono text-[11px] focus-visible:border-border focus-visible:ring-0'
                value={outbounds}
                onChange={(e) => setOutbounds(e.target.value)}
                placeholder='[{"tag": "proxy", "protocol": "shadowsocks", ...}]'
                spellCheck={false}
              />
            </div>
          </TabsContent>

          <TabsContent
            value='routes'
            className='mt-0 duration-200 animate-in fade-in-50'
          >
            <div className='space-y-3'>
              <Label className='font-mono text-[11px] italic text-muted-foreground'>
                自定义Routes (JSON)
              </Label>
              <Textarea
                rows={14}
                className='min-h-[300px] border-border/50 bg-muted/30 font-mono text-[11px] focus-visible:border-border focus-visible:ring-0'
                value={routes}
                onChange={(e) => setRoutes(e.target.value)}
                placeholder='[{"tag": "direct", "outbound": "direct", ...}]'
                spellCheck={false}
              />
            </div>
          </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className='flex flex-row items-center justify-end gap-3 border-t bg-muted/20 px-6 py-4 sm:space-x-0'>
          <Button
            type='button'
            variant='ghost'
            onClick={() => onOpenChange(false)}
            className='h-8 px-4 font-mono text-xs font-bold'
          >
            取消
          </Button>
          <Button
            type='button'
            onClick={handleSave}
            className='h-8 bg-primary px-8 font-mono text-xs font-bold text-primary-foreground hover:bg-primary/90'
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CertField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className='grid gap-2'>
      <Label className='font-mono text-[11px] text-muted-foreground'>
        {label}
      </Label>
      {children}
    </div>
  )
}

/** 多路复用面板（对齐原版 w4t：开关卡片 + 协议/连接数 + 填充 + Brutal）。 */
function MultiplexPanel({
  mux,
  setMux,
}: {
  mux: MultiplexValue
  setMux: React.Dispatch<React.SetStateAction<MultiplexValue>>
}) {
  const brutal = mux.brutal ?? {}
  return (
    <div className='space-y-4 rounded-lg border bg-muted/10 p-4'>
      <div className='flex flex-row items-center justify-between'>
        <div className='space-y-0.5'>
          <Label className='font-mono text-[13px] font-bold'>
            多路复用 (Multiplex)
          </Label>
          <p className='text-[11px] text-muted-foreground'>
            通过单条 TCP 连接传输多个流，降低握手延迟
          </p>
        </div>
        <Switch
          checked={!!mux.enabled}
          onCheckedChange={(c) =>
            setMux((m) => ({
              protocol: 'smux',
              max_connections: 4,
              padding: false,
              brutal: { enabled: false, up_mbps: 100, down_mbps: 100 },
              ...m,
              enabled: c,
            }))
          }
        />
      </div>
      {mux.enabled && (
        <div className='space-y-4 border-t border-dashed pt-2'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label className='font-mono text-[12px] text-foreground/80'>
                复用协议
              </Label>
              <Select
                value={mux.protocol || 'smux'}
                onValueChange={(v) => setMux((m) => ({ ...m, protocol: v }))}
              >
                <SelectTrigger className='h-8 w-full font-mono text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='smux' className='font-mono text-xs'>
                    smux
                  </SelectItem>
                  <SelectItem value='yamux' className='font-mono text-xs'>
                    yamux
                  </SelectItem>
                  <SelectItem value='h2mux' className='font-mono text-xs'>
                    h2mux
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className='text-[10px] text-muted-foreground opacity-70'>
                {mux.protocol === 'h2mux'
                  ? '适合高延迟、大带宽且不需要 Brutal 的环境'
                  : '通用模式，兼容性最好'}
              </p>
            </div>
            <div className='space-y-2'>
              <Label className='font-mono text-[12px] text-foreground/80'>
                最大连接数
              </Label>
              <Input
                type='number'
                className='h-8 font-mono text-xs'
                value={mux.max_connections ?? ''}
                onChange={(e) =>
                  setMux((m) => ({
                    ...m,
                    max_connections: Number(e.target.value),
                  }))
                }
              />
              <p className='text-[10px] text-muted-foreground opacity-70'>
                最大建立的物理 TCP 数量
              </p>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='flex flex-row items-center justify-between rounded-md border bg-muted/5 p-2'>
              <div className='space-y-0.5'>
                <Label className='font-mono text-[12px] text-foreground/80'>
                  启用填充
                </Label>
                <p className='text-[10px] leading-tight text-muted-foreground'>
                  填充数据包以对抗流量特征分析
                </p>
              </div>
              <Switch
                className='scale-75'
                checked={!!mux.padding}
                onCheckedChange={(c) => setMux((m) => ({ ...m, padding: c }))}
              />
            </div>
          </div>
          <div className='mt-2 space-y-3 rounded bg-primary/5 p-3'>
            <div className='flex flex-row items-center justify-between'>
              <div className='space-y-0.5'>
                <Label className='font-mono text-[12px] font-medium text-primary'>
                  TCP Brutal (激进拥塞控制)
                </Label>
              </div>
              <Switch
                checked={!!brutal.enabled}
                onCheckedChange={(c) =>
                  setMux((m) => ({
                    ...m,
                    brutal: {
                      up_mbps: 100,
                      down_mbps: 100,
                      ...m.brutal,
                      enabled: c,
                    },
                  }))
                }
              />
            </div>
            {brutal.enabled && (
              <div className='grid grid-cols-1 gap-3 duration-200 animate-in fade-in zoom-in'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label className='font-mono text-[11px] text-foreground/70'>
                      上行带宽
                    </Label>
                    <div className='relative'>
                      <Input
                        type='number'
                        className='h-8 pr-12 font-mono text-xs'
                        value={brutal.up_mbps ?? ''}
                        onChange={(e) =>
                          setMux((m) => ({
                            ...m,
                            brutal: {
                              ...m.brutal,
                              up_mbps: Number(e.target.value),
                            },
                          }))
                        }
                      />
                      <span className='absolute right-2 top-2 font-mono text-[9px] text-muted-foreground'>
                        Mbps
                      </span>
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label className='font-mono text-[11px] text-foreground/70'>
                      下行带宽
                    </Label>
                    <div className='relative'>
                      <Input
                        type='number'
                        className='h-8 pr-12 font-mono text-xs'
                        value={brutal.down_mbps ?? ''}
                        onChange={(e) =>
                          setMux((m) => ({
                            ...m,
                            brutal: {
                              ...m.brutal,
                              down_mbps: Number(e.target.value),
                            },
                          }))
                        }
                      />
                      <span className='absolute right-2 top-2 font-mono text-[9px] text-muted-foreground'>
                        Mbps
                      </span>
                    </div>
                  </div>
                </div>
                <p className='px-1 font-mono text-[10px] italic leading-relaxed text-primary/70'>
                  * TCP Brutal
                  是双边加速算法，建议带宽设为机器实际带宽的
                  80%-90%，开启后 BBR 将失效。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
