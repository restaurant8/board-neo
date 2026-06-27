import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Settings2, X } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { fetchConfig } from '@/features/config/api'
import { fetchMachines } from '@/features/server-machine/api'
import { fetchServerGroups } from '@/features/server-group/api'
import { fetchServerRoutes } from '@/features/server-route/api'
import { MultiCheck } from '@/components/multi-check'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  SERVER_TYPES,
  SERVER_TYPE_COLOR,
  SERVER_TYPE_LABEL,
  type Server,
  type ServerType,
  saveNode,
} from '../api'
import {
  AdvancedConfigDialog,
  type AdvancedConfigValue,
} from './advanced-config-dialog'
import { EchGenerateDialog } from './ech-generate-dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: Server | null
}

/* -------------------------------------------------------------------------- */
/* 常量 — 全部来自 Server::PROTOCOL_CONFIGURATIONS / CIPHER_CONFIGURATIONS     */
/* -------------------------------------------------------------------------- */

const GB = 1024 * 1024 * 1024

/** anytls padding_scheme 默认方案（来自 PROTOCOL_CONFIGURATIONS[anytls]）。 */
const ANYTLS_DEFAULT_PADDING = [
  'stop=8',
  '0=30-30',
  '1=100-400',
  '2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000',
  '3=9-9,500-1000',
  '4=500-1000',
  '5=500-1000',
  '6=500-1000',
  '7=500-1000',
]

/** protocol_settings 默认值（逐字段对应 PROTOCOL_CONFIGURATIONS 的 default）。 */
const PROTOCOL_DEFAULTS: Record<ServerType, Record<string, unknown>> = {
  shadowsocks: {
    cipher: 'aes-128-gcm',
    obfs: '',
    obfs_settings: { path: '', host: '' },
    plugin: '',
    plugin_opts: '',
  },
  vmess: {
    tls: 0,
    network: 'tcp',
    network_settings: {},
    tls_settings: { server_name: '', allow_insecure: false },
  },
  vless: {
    tls: 0,
    tls_settings: { server_name: '', allow_insecure: false },
    flow: '',
    encryption: { enabled: false, encryption: '', decryption: '' },
    network: 'tcp',
    network_settings: {},
    reality_settings: {
      server_name: '',
      server_port: '',
      public_key: '',
      private_key: '',
      short_id: '',
      allow_insecure: false,
    },
  },
  trojan: {
    tls: 1,
    network: 'tcp',
    network_settings: {},
    tls_settings: { server_name: '', allow_insecure: false },
    reality_settings: {
      server_name: '',
      server_port: '',
      public_key: '',
      private_key: '',
      short_id: '',
      allow_insecure: false,
    },
  },
  hysteria: {
    version: 2,
    bandwidth: { up: null, down: null },
    obfs: { open: false, type: 'salamander', password: '' },
    tls: { server_name: '', allow_insecure: false },
    hop_interval: null,
  },
  tuic: {
    version: 5,
    congestion_control: 'cubic',
    alpn: ['h3'],
    udp_relay_mode: 'native',
    tls: { server_name: '', allow_insecure: false },
  },
  anytls: {
    padding_scheme: [...ANYTLS_DEFAULT_PADDING],
    tls: { server_name: '', allow_insecure: false },
    alpn: '',
  },
  socks: {
    tls: 0,
    tls_settings: { server_name: '', allow_insecure: false },
  },
  naive: {
    tls: 0,
    tls_settings: { server_name: '', allow_insecure: false },
  },
  http: {
    tls: 0,
    tls_settings: { server_name: '', allow_insecure: false },
  },
  mieru: { transport: 'TCP', traffic_pattern: '' },
}

/** 走数组式 tls_settings（SNI / allow_insecure / ech 在 tls_settings.*）。 */
const TLS_SETTINGS_TYPES: ServerType[] = [
  'vmess',
  'vless',
  'trojan',
  'socks',
  'naive',
  'http',
]
/** 走对象式 tls（SNI / allow_insecure / ech 在 tls.*）。 */
const TLS_OBJECT_TYPES: ServerType[] = ['hysteria', 'tuic', 'anytls']

const SS_CIPHERS = [
  'aes-128-gcm',
  'aes-256-gcm',
  'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-chacha20-poly1305',
]
const NETWORKS = [
  'tcp',
  'ws',
  'grpc',
  'http',
  'httpupgrade',
  'splithttp',
  'kcp',
  'quic',
]
const TLS_OFF_ON = [
  { value: '0', label: '关闭' },
  { value: '1', label: 'TLS' },
]
const TLS_OFF_ON_REALITY = [
  { value: '0', label: '关闭' },
  { value: '1', label: 'TLS' },
  { value: '2', label: 'Reality' },
]

/* -------------------------------------------------------------------------- */
/* 路径式读写 protocol_settings（结构化字段与高级 JSON 共享同一对象，无损）       */
/* -------------------------------------------------------------------------- */

type Dict = Record<string, unknown>

function getPath(obj: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Dict)[key]
    return undefined
  }, obj)
}

function setPath(obj: Dict, path: string, value: unknown): Dict {
  const keys = path.split('.')
  const next: Dict = { ...obj }
  let cursor: Dict = next
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    const child = cursor[k]
    cursor[k] =
      child && typeof child === 'object' && !Array.isArray(child)
        ? { ...(child as Dict) }
        : {}
    cursor = cursor[k] as Dict
  }
  cursor[keys[keys.length - 1]] = value
  return next
}

/* -------------------------------------------------------------------------- */
/* 基础表单 state                                                              */
/* -------------------------------------------------------------------------- */

type RateRange = { start: string; end: string; rate: string }

type BaseState = {
  type: ServerType
  name: string
  rate: string
  rate_time_enable: boolean
  rate_time_ranges: RateRange[]
  transfer_enable_gb: string
  code: string
  tags: string[]
  group_ids: number[]
  host: string
  dns_auto_sync: boolean
  dns_cloudflare_zone_id: string
  port: string
  server_port: string
  parent_id: string
  route_ids: number[]
  machine_id: string
  show: boolean
  enabled: boolean
}

const EMPTY_BASE: BaseState = {
  type: 'shadowsocks',
  name: '',
  rate: '1',
  rate_time_enable: false,
  rate_time_ranges: [],
  transfer_enable_gb: '',
  code: '',
  tags: [],
  group_ids: [],
  host: '',
  dns_auto_sync: false,
  dns_cloudflare_zone_id: '',
  port: '',
  server_port: '',
  parent_id: '',
  route_ids: [],
  machine_id: '',
  show: true,
  enabled: true,
}

export function NodeMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()
  const [echOpen, setEchOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const { data: groups } = useQuery({
    queryKey: ['server-groups'],
    queryFn: fetchServerGroups,
    enabled: open,
  })
  const { data: routes } = useQuery({
    queryKey: ['server-routes'],
    queryFn: fetchServerRoutes,
    enabled: open,
  })
  const { data: machines } = useQuery({
    queryKey: ['server-machines'],
    queryFn: fetchMachines,
    enabled: open,
  })
  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => import('../api').then((m) => m.getNodes()),
    enabled: open,
  })
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    enabled: open,
  })

  const cfZones = config?.server?.cloudflare_dns_zones ?? []

  const [base, setBase] = useState<BaseState>(EMPTY_BASE)
  /** 协议配置唯一真理对象（结构化字段 + 高级 JSON 兜底共享）。 */
  const [ps, setPs] = useState<Dict>({})
  /** 高级弹窗管理的字段（cert_config / custom_outbounds / custom_routes）。 */
  const [advanced, setAdvanced] = useState<AdvancedConfigValue>({
    cert_config: {},
    custom_outbounds: [],
    custom_routes: [],
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (!open) return
    setTagInput('')
    if (current) {
      const te = current.transfer_enable
      setBase({
        type: current.type,
        name: current.name ?? '',
        rate: String(current.rate ?? '1'),
        rate_time_enable: !!current.rate_time_enable,
        rate_time_ranges: (current.rate_time_ranges ?? []).map((r) => ({
          start: r.start ?? '',
          end: r.end ?? '',
          rate: String(r.rate ?? ''),
        })),
        transfer_enable_gb: te ? String(te / GB) : '',
        code: current.code ?? '',
        tags: current.tags ?? [],
        group_ids: current.group_ids ?? [],
        host: current.host ?? '',
        dns_auto_sync: !!current.dns_auto_sync,
        dns_cloudflare_zone_id: current.dns_cloudflare_zone_id ?? '',
        port: String(current.port ?? ''),
        server_port: String(current.server_port ?? ''),
        parent_id: current.parent_id != null ? String(current.parent_id) : '',
        route_ids: current.route_ids ?? [],
        machine_id: current.machine_id != null ? String(current.machine_id) : '',
        show: !!current.show,
        enabled: !!current.enabled,
      })
      const loadedPs = (current.protocol_settings ?? {}) as Dict
      setPs(loadedPs)
      setAdvanced({
        // cert_config 实际嵌套在 protocol_settings 内（对齐原版/后端存储位置），
        // 顶层 current.cert_config 仅作历史数据兜底。
        cert_config: ((loadedPs.cert_config as Dict) ??
          (current.cert_config as Dict) ??
          {}) as Dict,
        custom_outbounds: current.custom_outbounds ?? [],
        custom_routes: current.custom_routes ?? [],
      })
    } else {
      setBase(EMPTY_BASE)
      setPs({ ...PROTOCOL_DEFAULTS.shadowsocks })
      setAdvanced({ cert_config: {}, custom_outbounds: [], custom_routes: [] })
    }
  }, [open, current])

  const set = (path: string, value: unknown) =>
    setPs((prev) => setPath(prev, path, value))

  /** 切换协议类型：载入该协议默认 protocol_settings。 */
  const onTypeChange = (type: ServerType) => {
    setBase((b) => ({ ...b, type }))
    setPs({ ...(PROTOCOL_DEFAULTS[type] ?? {}) })
  }

  // SNI / allow_insecure / ECH 显隐（对齐原版，避免与 Reality 字段重复）：
  // - 对象式 TLS 协议（hysteria/tuic/anytls）恒有 TLS，始终显示；
  // - 数组式 TLS 协议（vmess/vless/trojan/socks/naive/http）仅在 tls=1(普通 TLS) 时显示；
  //   tls=0(关闭) 不显示，tls=2(Reality) 交由协议配置块内的 Reality 字段维护。
  const showTlsSettings = useMemo(() => {
    if (TLS_OBJECT_TYPES.includes(base.type)) return true
    if (TLS_SETTINGS_TYPES.includes(base.type))
      return Number(getPath(ps, 'tls')) === 1
    return false
  }, [base.type, ps])

  /** SNI / allow_insecure / ech 的路径前缀（按协议 TLS 形态）。 */
  const tlsPrefix = useMemo(
    () => (TLS_SETTINGS_TYPES.includes(base.type) ? 'tls_settings' : 'tls'),
    [base.type]
  )

  const mutation = useMutation({
    mutationFn: () => {
      const transfer_enable = base.transfer_enable_gb
        ? Math.round(Number(base.transfer_enable_gb) * GB)
        : 0
      return saveNode({
        id: current?.id,
        type: base.type,
        name: base.name,
        rate: base.rate,
        rate_time_enable: base.rate_time_enable,
        rate_time_ranges: base.rate_time_enable
          ? base.rate_time_ranges
              .filter((r) => r.start && r.end)
              .map((r) => ({
                start: r.start,
                end: r.end,
                rate: Number(r.rate) || 0,
              }))
          : [],
        transfer_enable,
        code: base.code || null,
        tags: base.tags,
        group_ids: base.group_ids,
        host: base.host,
        dns_auto_sync: base.dns_auto_sync,
        dns_cloudflare_zone_id: base.dns_cloudflare_zone_id || null,
        port: base.port,
        server_port: base.server_port,
        parent_id: base.parent_id ? Number(base.parent_id) : null,
        route_ids: base.route_ids,
        machine_id: base.machine_id ? Number(base.machine_id) : null,
        show: base.show ? 1 : 0,
        enabled: base.enabled,
        // cert_config 嵌入 protocol_settings（对齐原版/后端存储位置）
        protocol_settings: { ...ps, cert_config: advanced.cert_config },
        custom_outbounds: advanced.custom_outbounds,
        custom_routes: advanced.custom_routes,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['nodes'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const handleEchGenerated = (r: { key: string; config: string }) => {
    const ech = { enabled: true, key: r.key, config: r.config }
    setPs((prev) => setPath(prev, `${tlsPrefix}.ech`, ech))
    toast.success('已回填 ECH 到协议配置')
  }

  /* 标签 chip 输入 */
  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (!base.tags.includes(t)) setBase((b) => ({ ...b, tags: [...b.tags, t] }))
    setTagInput('')
  }
  const removeTag = (t: string) =>
    setBase((b) => ({ ...b, tags: b.tags.filter((x) => x !== t) }))

  /* rate_time_ranges 增删 */
  const addRange = () =>
    setBase((b) => ({
      ...b,
      rate_time_ranges: [
        ...b.rate_time_ranges,
        { start: '00:00', end: '23:59', rate: '1' },
      ],
    }))
  const updateRange = (i: number, key: keyof RateRange, v: string) =>
    setBase((b) => ({
      ...b,
      rate_time_ranges: b.rate_time_ranges.map((r, idx) =>
        idx === i ? { ...r, [key]: v } : r
      ),
    }))
  const removeRange = (i: number) =>
    setBase((b) => ({
      ...b,
      rate_time_ranges: b.rate_time_ranges.filter((_, idx) => idx !== i),
    }))

  /* 受控取值便捷器 */
  const str = (path: string) => {
    const v = getPath(ps, path)
    return v == null ? '' : String(v)
  }
  const num = str
  const bool = (path: string) => !!getPath(ps, path)
  const arr = (path: string) => {
    const v = getPath(ps, path)
    return Array.isArray(v) ? v.join(',') : v == null ? '' : String(v)
  }
  /** 数组字段按换行呈现（如 anytls padding_scheme）。 */
  const lines = (path: string) => {
    const v = getPath(ps, path)
    return Array.isArray(v) ? v.join('\n') : v == null ? '' : String(v)
  }
  const echEnabled = bool(`${tlsPrefix}.ech.enabled`)

  const groupOptions = (groups ?? []).map((g) => ({
    value: String(g.id),
    label: g.name,
  }))
  const routeOptions = (routes ?? []).map((r) => ({
    value: String(r.id),
    label: r.remarks || `#${r.id}`,
  }))
  const parentOptions = (nodes ?? []).filter((n) => n.id !== current?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='sm:max-w-3xl'
        onInteractOutside={(e) => {
          // 嵌套弹窗（高级设置 / ECH）打开时，关闭它们不应连带关闭主弹窗
          if (advancedOpen || echOpen) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (advancedOpen || echOpen) e.preventDefault()
        }}
      >
        <DialogHeader>
          <div className='flex items-center justify-between gap-4'>
            <div className='flex items-center gap-2'>
              <DialogTitle>{isEdit ? '编辑节点' : '新建节点'}</DialogTitle>
              <Badge variant='secondary'>{SERVER_TYPE_LABEL[base.type]}</Badge>
            </div>
            {/* 右上角协议类型下拉（新建/编辑均可改） */}
            <Select
              value={base.type}
              onValueChange={(v) => onTypeChange(v as ServerType)}
            >
              <SelectTrigger className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className='flex items-center gap-2'>
                      <span
                        className='inline-block size-2 shrink-0 rounded-full'
                        style={{ backgroundColor: SERVER_TYPE_COLOR[t] }}
                      />
                      {SERVER_TYPE_LABEL[t]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogDescription>
            按所选协议填写结构化字段；证书 / Outbounds / Routes 在「高级设置」中维护。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[70vh] pe-3'>
          <div className='grid gap-4'>
            {/* ----------------------------- 基础信息 ----------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>基础信息</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <Field label='节点名称'>
                    <Input
                      value={base.name}
                      onChange={(e) =>
                        setBase((b) => ({ ...b, name: e.target.value }))
                      }
                      placeholder='如 香港节点01'
                    />
                  </Field>
                  <Field label='基础倍率'>
                    <Input
                      value={base.rate}
                      onChange={(e) =>
                        setBase((b) => ({ ...b, rate: e.target.value }))
                      }
                      placeholder='如 1'
                    />
                  </Field>
                </div>

                {/* 动态倍率 */}
                <div className='grid gap-3 rounded-md border p-3'>
                  <div className='flex items-center gap-2'>
                    <Switch
                      checked={base.rate_time_enable}
                      onCheckedChange={(c) =>
                        setBase((b) => ({ ...b, rate_time_enable: c }))
                      }
                    />
                    <Label>启用动态倍率</Label>
                  </div>
                  {base.rate_time_enable && (
                    <div className='grid gap-2'>
                      {base.rate_time_ranges.map((r, i) => (
                        <div key={i} className='flex items-center gap-2'>
                          <Input
                            type='time'
                            value={r.start}
                            onChange={(e) =>
                              updateRange(i, 'start', e.target.value)
                            }
                          />
                          <span className='text-muted-foreground'>~</span>
                          <Input
                            type='time'
                            value={r.end}
                            onChange={(e) =>
                              updateRange(i, 'end', e.target.value)
                            }
                          />
                          <Input
                            className='w-24'
                            value={r.rate}
                            onChange={(e) =>
                              updateRange(i, 'rate', e.target.value)
                            }
                            placeholder='倍率'
                          />
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => removeRange(i)}
                          >
                            <X className='size-4' />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='w-fit'
                        onClick={addRange}
                      >
                        <Plus className='size-4' /> 添加时间段
                      </Button>
                    </div>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <Field label='流量限制 (GB)' hint='0 或留空 = 不限制'>
                    <Input
                      value={base.transfer_enable_gb}
                      onChange={(e) =>
                        setBase((b) => ({
                          ...b,
                          transfer_enable_gb: e.target.value,
                        }))
                      }
                      placeholder='如 100'
                    />
                  </Field>
                  <Field label='自定义节点ID (code)' hint='选填'>
                    <Input
                      value={base.code}
                      onChange={(e) =>
                        setBase((b) => ({ ...b, code: e.target.value }))
                      }
                    />
                  </Field>
                </div>

                {/* 标签 chip */}
                <Field label='节点标签'>
                  <div className='flex flex-wrap items-center gap-2 rounded-md border p-2'>
                    {base.tags.map((t) => (
                      <Badge key={t} variant='secondary' className='gap-1'>
                        {t}
                        <button type='button' onClick={() => removeTag(t)}>
                          <X className='size-3' />
                        </button>
                      </Badge>
                    ))}
                    <input
                      className='min-w-32 flex-1 bg-transparent text-sm outline-none'
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      placeholder='输入后回车添加'
                    />
                  </div>
                </Field>

                <Field label='权限组'>
                  <MultiCheck
                    options={groupOptions}
                    selected={base.group_ids.map(String)}
                    onChange={(next) =>
                      setBase((b) => ({ ...b, group_ids: next.map(Number) }))
                    }
                    empty='暂无权限组'
                  />
                </Field>
              </CardContent>
            </Card>

            {/* ----------------------------- 网络 / DNS ----------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>网络与地址</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4'>
                <Field label='节点地址 (host)'>
                  <Input
                    value={base.host}
                    onChange={(e) =>
                      setBase((b) => ({ ...b, host: e.target.value }))
                    }
                    placeholder='如 1.2.3.4 或 node.example.com'
                  />
                </Field>

                <div className='grid gap-3 rounded-md border p-3'>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      checked={base.dns_auto_sync}
                      onCheckedChange={(c) =>
                        setBase((b) => ({ ...b, dns_auto_sync: !!c }))
                      }
                    />
                    <Label>Cloudflare DNS 自动同步</Label>
                  </div>
                  <Field label='Cloudflare Zone'>
                    {cfZones.length > 0 ? (
                      <Select
                        value={base.dns_cloudflare_zone_id || undefined}
                        onValueChange={(v) =>
                          setBase((b) => ({ ...b, dns_cloudflare_zone_id: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='选择 Zone' />
                        </SelectTrigger>
                        <SelectContent>
                          {cfZones.map((z) => (
                            <SelectItem key={z.zone_id} value={z.zone_id}>
                              {z.remark || z.zone_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={base.dns_cloudflare_zone_id}
                        onChange={(e) =>
                          setBase((b) => ({
                            ...b,
                            dns_cloudflare_zone_id: e.target.value,
                          }))
                        }
                        placeholder='请先在系统配置添加 Zone'
                      />
                    )}
                  </Field>
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <Field label='连接端口 (port)' hint='支持端口跳跃，如 1000-2000'>
                    <Input
                      value={base.port}
                      onChange={(e) =>
                        setBase((b) => ({ ...b, port: e.target.value }))
                      }
                      placeholder='如 443'
                    />
                  </Field>
                  <Field label='服务端口 (server_port)'>
                    <Input
                      value={base.server_port}
                      onChange={(e) =>
                        setBase((b) => ({ ...b, server_port: e.target.value }))
                      }
                      placeholder='如 443'
                    />
                  </Field>
                </div>

                {/* SNI / allow_insecure / ECH — 仅普通 TLS 模式（Reality 用自有字段） */}
                {showTlsSettings && (
                  <>
                    <div className='grid grid-cols-2 gap-4'>
                      <Field label='服务器名称指示 (SNI)'>
                        <Input
                          value={str(`${tlsPrefix}.server_name`)}
                          onChange={(e) =>
                            set(`${tlsPrefix}.server_name`, e.target.value)
                          }
                          placeholder='如 node.example.com'
                        />
                      </Field>
                      <div className='flex items-end gap-2 pb-2'>
                        <Switch
                          checked={bool(`${tlsPrefix}.allow_insecure`)}
                          onCheckedChange={(c) =>
                            set(`${tlsPrefix}.allow_insecure`, c)
                          }
                        />
                        <Label>允许不安全连接</Label>
                      </div>
                    </div>

                    <div className='grid gap-3 rounded-md border p-3'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={echEnabled}
                            onCheckedChange={(c) =>
                              set(`${tlsPrefix}.ech.enabled`, c)
                            }
                          />
                          <Label>ECH（Encrypted Client Hello）</Label>
                        </div>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => setEchOpen(true)}
                        >
                          <KeyRound className='size-4' /> 生成 ECH
                        </Button>
                      </div>
                      {echEnabled && (
                        <div className='grid gap-3'>
                          <Field label='ECH config'>
                            <Textarea
                              rows={3}
                              className='font-mono text-xs'
                              value={str(`${tlsPrefix}.ech.config`)}
                              onChange={(e) =>
                                set(`${tlsPrefix}.ech.config`, e.target.value)
                              }
                            />
                          </Field>
                          <Field label='ECH key'>
                            <Textarea
                              rows={3}
                              className='font-mono text-xs'
                              value={str(`${tlsPrefix}.ech.key`)}
                              onChange={(e) =>
                                set(`${tlsPrefix}.ech.key`, e.target.value)
                              }
                            />
                          </Field>
                          <Field label='ECH query_server_name'>
                            <Input
                              value={str(`${tlsPrefix}.ech.query_server_name`)}
                              onChange={(e) =>
                                set(
                                  `${tlsPrefix}.ech.query_server_name`,
                                  e.target.value
                                )
                              }
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ----------------------------- 协议专属配置 ----------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  协议配置 · {SERVER_TYPE_LABEL[base.type]}
                </CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4'>
                <ProtocolFields
                  type={base.type}
                  str={str}
                  num={num}
                  bool={bool}
                  arr={arr}
                  lines={lines}
                  set={set}
                  setPs={setPs}
                />
              </CardContent>
            </Card>

            {/* ----------------------------- 关联 ----------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>关联设置</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <Field label='父级节点'>
                    <Select
                      value={base.parent_id || 'none'}
                      onValueChange={(v) =>
                        setBase((b) => ({
                          ...b,
                          parent_id: v === 'none' ? '' : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='none'>无</SelectItem>
                        {parentOptions.map((n) => (
                          <SelectItem key={n.id} value={String(n.id)}>
                            {n.name}（#{n.id}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label='绑定服务器 (machine)'>
                    <Select
                      value={base.machine_id || 'none'}
                      onValueChange={(v) =>
                        setBase((b) => ({
                          ...b,
                          machine_id: v === 'none' ? '' : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='none'>独立部署</SelectItem>
                        {(machines ?? []).map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label='路由组'>
                  <MultiCheck
                    options={routeOptions}
                    selected={base.route_ids.map(String)}
                    onChange={(next) =>
                      setBase((b) => ({ ...b, route_ids: next.map(Number) }))
                    }
                    empty='暂无路由规则'
                  />
                </Field>
                {/* 显示/启用 不在编辑表单维护，与官方一致：由节点列表的「显隐」开关 + 批量启用/禁用控制 */}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className='sm:justify-between'>
          <Button variant='outline' onClick={() => setAdvancedOpen(true)}>
            <Settings2 className='size-4' /> 高级设置
          </Button>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              提交
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <EchGenerateDialog
        open={echOpen}
        onOpenChange={setEchOpen}
        onGenerated={handleEchGenerated}
      />
      <AdvancedConfigDialog
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        value={advanced}
        onSave={setAdvanced}
      />
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* 公共小组件                                                                  */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      {children}
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  )
}

function TlsSelect({
  value,
  reality,
  onChange,
}: {
  value: string
  reality?: boolean
  onChange: (v: number) => void
}) {
  const opts = reality ? TLS_OFF_ON_REALITY : TLS_OFF_ON
  return (
    <Select
      value={value === '' ? '0' : value}
      onValueChange={(v) => onChange(Number(v))}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function NetworkSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={value || 'tcp'} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {NETWORKS.map((n) => (
          <SelectItem key={n} value={n}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** network_settings 结构化字段（随 network：path/host/serviceName）。 */
function NetworkSettings({ str, set }: Pick<FieldProps, 'str' | 'set'>) {
  return (
    <div className='grid grid-cols-3 gap-4 rounded-md border p-3'>
      <Field label='path（ws/http 路径）'>
        <Input
          value={str('network_settings.path')}
          onChange={(e) => set('network_settings.path', e.target.value)}
          placeholder='如 /ws'
        />
      </Field>
      <Field label='host（Host 头）'>
        <Input
          value={str('network_settings.host')}
          onChange={(e) => set('network_settings.host', e.target.value)}
          placeholder='如 cdn.example.com'
        />
      </Field>
      <Field label='serviceName（gRPC）'>
        <Input
          value={str('network_settings.serviceName')}
          onChange={(e) => set('network_settings.serviceName', e.target.value)}
          placeholder='如 grpc-service'
        />
      </Field>
    </div>
  )
}

/** Reality 配置块（vless tls=2 / trojan）。 */
function RealityFields({ str, bool, set }: Pick<FieldProps, 'str' | 'bool' | 'set'>) {
  return (
    <div className='grid gap-3 rounded-md border p-3'>
      <Label className='text-sm font-semibold'>Reality 配置</Label>
      <div className='grid grid-cols-2 gap-4'>
        <Field label='server_name'>
          <Input
            value={str('reality_settings.server_name')}
            onChange={(e) => set('reality_settings.server_name', e.target.value)}
            placeholder='如 www.microsoft.com'
          />
        </Field>
        <Field label='server_port'>
          <Input
            value={str('reality_settings.server_port')}
            onChange={(e) => set('reality_settings.server_port', e.target.value)}
            placeholder='如 443'
          />
        </Field>
        <Field label='public_key'>
          <Input
            value={str('reality_settings.public_key')}
            onChange={(e) => set('reality_settings.public_key', e.target.value)}
          />
        </Field>
        <Field label='private_key'>
          <Input
            value={str('reality_settings.private_key')}
            onChange={(e) => set('reality_settings.private_key', e.target.value)}
          />
        </Field>
        <Field label='short_id'>
          <Input
            value={str('reality_settings.short_id')}
            onChange={(e) => set('reality_settings.short_id', e.target.value)}
          />
        </Field>
      </div>
      <div className='flex items-center gap-2'>
        <Switch
          checked={bool('reality_settings.allow_insecure')}
          onCheckedChange={(c) => set('reality_settings.allow_insecure', c)}
        />
        <Label>allow_insecure（允许不安全）</Label>
      </div>
    </div>
  )
}

/** 通用多路复用块（vmess/vless/trojan/mieru）。 */
function MultiplexFields({ bool, num, str, set }: Pick<FieldProps, 'bool' | 'num' | 'str' | 'set'>) {
  const enabled = bool('multiplex.enabled')
  return (
    <div className='grid gap-3 rounded-md border p-3'>
      <div className='flex items-center gap-2'>
        <Switch
          checked={enabled}
          onCheckedChange={(c) => set('multiplex.enabled', c)}
        />
        <Label>多路复用 (multiplex)</Label>
      </div>
      {enabled && (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='protocol'>
              <Select
                value={str('multiplex.protocol') || 'yamux'}
                onValueChange={(v) => set('multiplex.protocol', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='smux'>smux</SelectItem>
                  <SelectItem value='yamux'>yamux</SelectItem>
                  <SelectItem value='h2mux'>h2mux</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='max_connections'>
              <Input
                value={num('multiplex.max_connections')}
                onChange={(e) =>
                  set(
                    'multiplex.max_connections',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
              />
            </Field>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={bool('multiplex.padding')}
              onCheckedChange={(c) => set('multiplex.padding', c)}
            />
            <Label>padding（填充）</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={bool('multiplex.brutal.enabled')}
              onCheckedChange={(c) => set('multiplex.brutal.enabled', c)}
            />
            <Label>Brutal 加速</Label>
          </div>
          {bool('multiplex.brutal.enabled') && (
            <div className='grid grid-cols-2 gap-4'>
              <Field label='brutal up_mbps'>
                <Input
                  value={num('multiplex.brutal.up_mbps')}
                  onChange={(e) =>
                    set(
                      'multiplex.brutal.up_mbps',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
              </Field>
              <Field label='brutal down_mbps'>
                <Input
                  value={num('multiplex.brutal.down_mbps')}
                  onChange={(e) =>
                    set(
                      'multiplex.brutal.down_mbps',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
              </Field>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** 通用 uTLS 块（vmess/vless/trojan）。 */
function UtlsFields({ bool, str, set }: Pick<FieldProps, 'bool' | 'str' | 'set'>) {
  const enabled = bool('utls.enabled')
  return (
    <div className='grid gap-3 rounded-md border p-3'>
      <div className='flex items-center gap-2'>
        <Switch
          checked={enabled}
          onCheckedChange={(c) => set('utls.enabled', c)}
        />
        <Label>uTLS（指纹伪装）</Label>
      </div>
      {enabled && (
        <Field label='fingerprint'>
          <Input
            value={str('utls.fingerprint') || ''}
            onChange={(e) => set('utls.fingerprint', e.target.value)}
            placeholder='如 chrome'
          />
        </Field>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 每协议结构化字段                                                            */
/* -------------------------------------------------------------------------- */

type FieldProps = {
  type: ServerType
  str: (path: string) => string
  num: (path: string) => string
  bool: (path: string) => boolean
  arr: (path: string) => string
  lines: (path: string) => string
  set: (path: string, value: unknown) => void
  setPs: React.Dispatch<React.SetStateAction<Dict>>
}

function ProtocolFields(props: FieldProps) {
  const { type, str, num, bool, arr, lines, set, setPs } = props
  switch (type) {
    case 'shadowsocks':
      return (
        <>
          <Field label='加密方式 (cipher)'>
            <Select
              value={str('cipher') || 'aes-128-gcm'}
              onValueChange={(v) => set('cipher', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SS_CIPHERS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='混淆 (obfs)' hint='如 http；留空表示不混淆'>
            <Input
              value={str('obfs')}
              onChange={(e) => set('obfs', e.target.value)}
            />
          </Field>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='obfs path'>
              <Input
                value={str('obfs_settings.path')}
                onChange={(e) => set('obfs_settings.path', e.target.value)}
                placeholder='如 /'
              />
            </Field>
            <Field label='obfs host'>
              <Input
                value={str('obfs_settings.host')}
                onChange={(e) => set('obfs_settings.host', e.target.value)}
                placeholder='如 www.bing.com'
              />
            </Field>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='plugin'>
              <Input
                value={str('plugin')}
                onChange={(e) => set('plugin', e.target.value)}
              />
            </Field>
            <Field label='plugin_opts'>
              <Input
                value={str('plugin_opts')}
                onChange={(e) => set('plugin_opts', e.target.value)}
              />
            </Field>
          </div>
        </>
      )

    case 'vmess':
      return (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='TLS'>
              <TlsSelect value={num('tls')} onChange={(v) => set('tls', v)} />
            </Field>
            <Field label='传输协议 (network)'>
              <NetworkSelect
                value={str('network')}
                onChange={(v) => set('network', v)}
              />
            </Field>
          </div>
          <NetworkSettings str={str} set={set} />
          <MultiplexFields bool={bool} num={num} str={str} set={set} />
          <UtlsFields bool={bool} str={str} set={set} />
        </>
      )

    case 'vless':
      return (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='TLS'>
              <TlsSelect
                value={num('tls')}
                reality
                onChange={(v) => set('tls', v)}
              />
            </Field>
            <Field label='传输协议 (network)'>
              <NetworkSelect
                value={str('network')}
                onChange={(v) => set('network', v)}
              />
            </Field>
          </div>
          <Field label='flow' hint='如 xtls-rprx-vision；留空表示不启用'>
            <Input
              value={str('flow')}
              onChange={(e) => set('flow', e.target.value)}
            />
          </Field>
          <NetworkSettings str={str} set={set} />
          <div className='grid gap-3 rounded-md border p-3'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={bool('encryption.enabled')}
                onCheckedChange={(c) => set('encryption.enabled', c)}
              />
              <Label>启用 encryption（VLESS 加密）</Label>
            </div>
            {bool('encryption.enabled') && (
              <div className='grid grid-cols-2 gap-4'>
                <Field label='encryption（客户端公钥）'>
                  <Input
                    value={str('encryption.encryption')}
                    onChange={(e) => set('encryption.encryption', e.target.value)}
                  />
                </Field>
                <Field label='decryption（服务端私钥）'>
                  <Input
                    value={str('encryption.decryption')}
                    onChange={(e) => set('encryption.decryption', e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
          {num('tls') === '2' && (
            <RealityFields str={str} bool={bool} set={set} />
          )}
          <MultiplexFields bool={bool} num={num} str={str} set={set} />
          <UtlsFields bool={bool} str={str} set={set} />
        </>
      )

    case 'trojan':
      return (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='TLS'>
              <TlsSelect
                value={num('tls')}
                reality
                onChange={(v) => set('tls', v)}
              />
            </Field>
            <Field label='传输协议 (network)'>
              <NetworkSelect
                value={str('network')}
                onChange={(v) => set('network', v)}
              />
            </Field>
          </div>
          <NetworkSettings str={str} set={set} />
          {num('tls') === '2' && (
            <RealityFields str={str} bool={bool} set={set} />
          )}
          <MultiplexFields bool={bool} num={num} str={str} set={set} />
          <UtlsFields bool={bool} str={str} set={set} />
        </>
      )

    case 'hysteria':
      return (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='版本 (version)'>
              <Select
                value={num('version') || '2'}
                onValueChange={(v) => set('version', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='1'>1</SelectItem>
                  <SelectItem value='2'>2</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='hop_interval（端口跳跃间隔秒）'>
              <Input
                value={num('hop_interval')}
                onChange={(e) =>
                  set(
                    'hop_interval',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
                placeholder='如 30'
              />
            </Field>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='上行带宽 bandwidth.up（Mbps）'>
              <Input
                value={num('bandwidth.up')}
                onChange={(e) =>
                  set(
                    'bandwidth.up',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
              />
            </Field>
            <Field label='下行带宽 bandwidth.down（Mbps）'>
              <Input
                value={num('bandwidth.down')}
                onChange={(e) =>
                  set(
                    'bandwidth.down',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
              />
            </Field>
          </div>
          <Field label='alpn' hint='如 h3'>
            <Input
              value={str('alpn')}
              onChange={(e) => set('alpn', e.target.value)}
            />
          </Field>
          <div className='grid gap-3 rounded-md border p-3'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={bool('obfs.open')}
                onCheckedChange={(c) => set('obfs.open', c)}
              />
              <Label>启用混淆 (obfs.open)</Label>
            </div>
            {bool('obfs.open') && (
              <div className='grid grid-cols-2 gap-4'>
                <Field label='obfs.type'>
                  <Input
                    value={str('obfs.type')}
                    onChange={(e) => set('obfs.type', e.target.value)}
                    placeholder='如 salamander'
                  />
                </Field>
                <Field label='obfs.password'>
                  <Input
                    value={str('obfs.password')}
                    onChange={(e) => set('obfs.password', e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        </>
      )

    case 'tuic':
      return (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='版本 (version)'>
              <Select
                value={num('version') || '5'}
                onValueChange={(v) => set('version', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='4'>4</SelectItem>
                  <SelectItem value='5'>5</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='拥塞控制 (congestion_control)'>
              <Select
                value={str('congestion_control') || 'cubic'}
                onValueChange={(v) => set('congestion_control', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='cubic'>cubic</SelectItem>
                  <SelectItem value='bbr'>bbr</SelectItem>
                  <SelectItem value='new_reno'>new_reno</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='udp_relay_mode'>
              <Select
                value={str('udp_relay_mode') || 'native'}
                onValueChange={(v) => set('udp_relay_mode', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='native'>native</SelectItem>
                  <SelectItem value='quic'>quic</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='alpn（逗号分隔）' hint='如 h3'>
              <Input
                value={arr('alpn')}
                onChange={(e) =>
                  set(
                    'alpn',
                    e.target.value
                      ? e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      : []
                  )
                }
              />
            </Field>
          </div>
        </>
      )

    case 'mieru':
      return (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <Field label='传输方式 (transport)'>
              <Select
                value={str('transport') || 'TCP'}
                onValueChange={(v) => set('transport', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='TCP'>TCP</SelectItem>
                  <SelectItem value='UDP'>UDP</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='traffic_pattern'>
              <Input
                value={str('traffic_pattern')}
                onChange={(e) => set('traffic_pattern', e.target.value)}
              />
            </Field>
          </div>
          <MultiplexFields bool={bool} num={num} str={str} set={set} />
        </>
      )

    case 'anytls':
      return (
        <>
          <Field label='alpn' hint='如 h2,http/1.1'>
            <Input
              value={str('alpn')}
              onChange={(e) => set('alpn', e.target.value)}
            />
          </Field>
          <div className='grid gap-2'>
            <div className='flex items-center justify-between'>
              <Label>填充方案 (padding_scheme)</Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() =>
                  setPs((prev) =>
                    setPath(prev, 'padding_scheme', [...ANYTLS_DEFAULT_PADDING])
                  )
                }
              >
                使用默认方案
              </Button>
            </div>
            <Textarea
              rows={10}
              className='font-mono text-xs'
              value={lines('padding_scheme')}
              onChange={(e) =>
                set(
                  'padding_scheme',
                  e.target.value
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean)
                )
              }
              placeholder='每行一条规则，如 stop=8'
            />
          </div>
        </>
      )

    case 'socks':
    case 'naive':
    case 'http':
      return (
        <Field label='TLS'>
          <TlsSelect value={num('tls')} onChange={(v) => set('tls', v)} />
        </Field>
      )

    default:
      return null
  }
}

