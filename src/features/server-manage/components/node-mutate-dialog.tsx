import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronsUpDown,
  KeyRound,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import nacl from 'tweetnacl'
import { cn } from '@/lib/utils'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
    plugin: '',
    plugin_opts: '',
    client_fingerprint: '',
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

/** shadowsocks 预设加密方式（对齐原版 config.ciphers）。 */
const SS_CIPHERS = [
  'aes-128-gcm',
  'aes-192-gcm',
  'aes-256-gcm',
  'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-chacha20-poly1305',
]
/** shadowsocks 插件（对齐原版 config.plugins）。none 对应「不使用插件」。 */
const SS_PLUGINS = [
  { value: 'none', label: 'None' },
  { value: 'obfs', label: 'Simple Obfs' },
  { value: 'v2ray-plugin', label: 'V2Ray Plugin' },
  { value: 'gost-plugin', label: 'Gost Plugin' },
  { value: 'shadow-tls', label: 'Shadow TLS' },
  { value: 'restls', label: 'ResTLS' },
  { value: 'kcptun', label: 'KCPTun' },
]
/** 各插件的配置提示（对齐原版 dynamic_form.shadowsocks.plugin.*_hint）。 */
const SS_PLUGIN_HINTS: Record<string, string> = {
  obfs: '提示：配置格式如 obfs=http;obfs-host=www.bing.com;path=/',
  'v2ray-plugin':
    '提示：WebSocket模式格式为 mode=websocket;host=mydomain.me;path=/;tls=true，QUIC模式格式为 mode=quic;host=mydomain.me',
  'gost-plugin': '提示：配置格式如 mode=websocket;host=mydomain.me;path=/;tls=true',
  'shadow-tls':
    '提示：配置格式如 host=cloud.tencent.com;password=auth_password;version=3',
  restls:
    '提示：配置格式如 host=www.microsoft.com;password=auth_password;version-hint=tls13;restls-script=300?100<1,400~100',
  kcptun: '提示：配置格式如 key=psk;crypt=aes-128-gcm;mode=fast;mtu=1350',
}
/** 客户端指纹（对齐原版 config.clientFingerprints，用于 ss / uTLS）。 */
const CLIENT_FINGERPRINTS = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'safari', label: 'Safari' },
  { value: 'ios', label: 'iOS' },
]
/** vless 流控（对齐原版 config.flowOptions）。 */
const VLESS_FLOWS = [
  'none',
  'xtls-rprx-direct',
  'xtls-rprx-splice',
  'xtls-rprx-vision',
]
/** hysteria ALPN（对齐原版 config.alpnOptions）。 */
const HYSTERIA_ALPN = ['hysteria', 'http/1.1', 'h2', 'h3']
/** tuic 版本（对齐原版 config.versions，渲染为 V5/V4）。 */
const TUIC_VERSIONS = ['5', '4']
/** tuic 拥塞控制（对齐原版 config.congestionControls，渲染为大写）。 */
const TUIC_CONGESTION = ['bbr', 'cubic', 'new_reno']
/** tuic UDP 中继模式（对齐原版 config.udpRelayModes）。 */
const TUIC_UDP_MODES = [
  { value: 'native', label: 'Native' },
  { value: 'quic', label: 'QUIC' },
]
/** tuic ALPN 多选（对齐原版 config.alpnOptions）。 */
const TUIC_ALPN = [
  { value: 'h3', label: 'HTTP/3' },
  { value: 'h2', label: 'HTTP/2' },
  { value: 'http/1.1', label: 'HTTP/1.1' },
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
/** TLS 开关（vmess/socks/naive/http：不支持 / 支持，对齐原版 tls.disabled/enabled）。 */
const TLS_SUPPORT = [
  { value: '0', label: '不支持' },
  { value: '1', label: '支持' },
]
/** 安全性（vless/trojan：无 / TLS / Reality，对齐原版 tls.none/tls/reality）。 */
const TLS_NONE_TLS_REALITY = [
  { value: '0', label: '无' },
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
/* 客户端生成器（对齐原版：无需后端，纯前端生成）                                 */
/* -------------------------------------------------------------------------- */

/** Uint8Array → base64url（对齐原版 reality key 编码）。 */
function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Reality 密钥对（X25519 = nacl.box.keyPair，对齐原版 O4t）。 */
function generateRealityKeypair(): { privateKey: string; publicKey: string } {
  const kp = nacl.box.keyPair()
  return {
    privateKey: toBase64Url(kp.secretKey),
    publicKey: toBase64Url(kp.publicKey),
  }
}

/** Short ID：随机 hex，长度为 2 的倍数、2~16 位（对齐原版 M4t）。 */
function generateShortId(): string {
  const len = 2 * Math.floor(8 * Math.random()) + 2
  const bytes = new Uint8Array(Math.ceil(len / 2))
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, len)
}

/** 随机密码：A-Za-z0-9 共 62 字符，默认 16 位（对齐原版混淆密码生成）。 */
function generateRandomPassword(length = 16): string {
  const cs =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => cs[b % 62])
    .join('')
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
        className='max-w-xl gap-0 overflow-hidden p-0 sm:rounded-2xl'
        onInteractOutside={(e) => {
          // 嵌套弹窗（高级设置 / ECH）打开时，关闭它们不应连带关闭主弹窗
          if (advancedOpen || echOpen) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (advancedOpen || echOpen) e.preventDefault()
        }}
      >
        <DialogHeader className='border-b bg-muted/20 px-6 pb-4 pt-6'>
          <div className='flex items-center justify-between pr-8'>
            <div className='flex items-center gap-3'>
              <DialogTitle className='font-mono text-lg tracking-tight'>
                {isEdit ? '编辑节点' : '新建节点'}
              </DialogTitle>
              <span
                className='rounded px-2 py-0.5 font-mono text-xs text-white'
                style={{ background: SERVER_TYPE_COLOR[base.type] }}
              >
                {SERVER_TYPE_LABEL[base.type]}
              </span>
            </div>
            {/* 右上角协议类型下拉（新建/编辑均可改） */}
            <Select
              value={base.type}
              onValueChange={(v) => onTypeChange(v as ServerType)}
            >
              <SelectTrigger className='h-8 w-[150px] border-2 font-mono text-xs'>
                <SelectValue placeholder='选择协议类型' />
              </SelectTrigger>
              <SelectContent>
                {SERVER_TYPES.map((t) => (
                  <SelectItem
                    key={t}
                    value={t}
                    className='cursor-pointer font-mono text-xs'
                  >
                    <div className='flex items-center gap-2'>
                      <span
                        className='h-2.5 w-2.5 rounded-full'
                        style={{ background: SERVER_TYPE_COLOR[t] }}
                      />
                      {SERVER_TYPE_LABEL[t]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogDescription className='font-mono text-xs opacity-70'>
            管理所有节点，包括添加、删除、编辑等操作。
          </DialogDescription>
        </DialogHeader>

        <div className='flex h-[75vh] min-h-[500px] flex-col'>
          <div className='flex-1 space-y-8 overflow-y-auto px-6 py-6'>
            {/* ----------------------------- 基础信息 ----------------------------- */}
            <div className='space-y-4'>
              <div className='flex gap-4'>
                <Field label='节点名称' className='flex-[2]'>
                  <Input
                    value={base.name}
                    onChange={(e) =>
                      setBase((b) => ({ ...b, name: e.target.value }))
                    }
                    placeholder='请输入节点名称'
                    className='h-9 font-mono text-xs'
                  />
                </Field>
                <Field label='基础倍率' className='flex-[1]'>
                  <div className='relative'>
                    <Input
                      type='number'
                      min='0'
                      step='0.1'
                      value={base.rate}
                      onChange={(e) =>
                        setBase((b) => ({ ...b, rate: e.target.value }))
                      }
                      className='h-9 pr-8 font-mono text-xs'
                    />
                    <span className='absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground'>
                      x
                    </span>
                  </div>
                </Field>
              </div>

              {/* 动态倍率 */}
              <div className='grid gap-2'>
                <div className='flex items-center justify-between'>
                  <div>
                    <Label className='font-mono text-[12px] text-foreground/80'>
                      启用动态倍率
                    </Label>
                    <div className='font-mono text-[11px] opacity-70'>
                      根据时间段设置不同的倍率乘数
                    </div>
                  </div>
                  <Switch
                    checked={base.rate_time_enable}
                    onCheckedChange={(c) =>
                      setBase((b) => ({ ...b, rate_time_enable: c }))
                    }
                    className='scale-90'
                  />
                </div>
                {base.rate_time_enable && (
                  <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
                    <div className='flex items-center justify-between'>
                      <Label className='font-mono text-[12px] text-foreground/80'>
                        时间段规则
                      </Label>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='h-7 px-2 font-mono text-[10px]'
                        onClick={addRange}
                      >
                        <Plus className='mr-1 size-3' /> 添加规则
                      </Button>
                    </div>
                    {base.rate_time_ranges.map((r, i) => (
                      <div
                        key={i}
                        className='space-y-3 rounded-lg border bg-background p-3'
                      >
                        <div className='flex items-center justify-between'>
                          <span className='font-mono text-[11px] font-bold'>
                            规则 {i + 1}
                          </span>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='size-7 text-muted-foreground hover:text-destructive'
                            onClick={() => removeRange(i)}
                          >
                            <X className='size-3.5' />
                          </Button>
                        </div>
                        <div className='grid grid-cols-3 gap-3'>
                          <Field label='开始时间' labelClassName='text-[11px]'>
                            <Input
                              type='time'
                              value={r.start}
                              onChange={(e) =>
                                updateRange(i, 'start', e.target.value)
                              }
                              className='h-8 px-2 font-mono text-xs'
                            />
                          </Field>
                          <Field label='结束时间' labelClassName='text-[11px]'>
                            <Input
                              type='time'
                              value={r.end}
                              onChange={(e) =>
                                updateRange(i, 'end', e.target.value)
                              }
                              className='h-8 px-2 font-mono text-xs'
                            />
                          </Field>
                          <Field label='倍率乘数' labelClassName='text-[11px]'>
                            <Input
                              type='number'
                              min='0'
                              step='0.1'
                              value={r.rate}
                              onChange={(e) =>
                                updateRange(i, 'rate', e.target.value)
                              }
                              className='h-8 px-2 font-mono text-xs'
                              placeholder='1.0'
                            />
                          </Field>
                        </div>
                      </div>
                    ))}
                    {base.rate_time_ranges.length === 0 && (
                      <div className='py-4 text-center font-mono text-[10px] italic text-muted-foreground'>
                        暂无规则，点击上方按钮添加
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className='flex gap-3'>
                <Field
                  label='流量限制'
                  className='flex-1'
                  labelClassName='text-[11px] text-muted-foreground'
                  suffix='(GB)'
                >
                  <Input
                    type='number'
                    min='0'
                    step='1'
                    value={base.transfer_enable_gb}
                    onChange={(e) =>
                      setBase((b) => ({
                        ...b,
                        transfer_enable_gb: e.target.value,
                      }))
                    }
                    placeholder='0 表示不限制'
                    className='h-8 font-mono text-xs'
                  />
                </Field>
                <Field
                  label='自定义节点ID'
                  className='flex-1'
                  labelClassName='text-[11px] text-muted-foreground'
                  suffix='(选填)'
                >
                  <Input
                    value={base.code}
                    onChange={(e) =>
                      setBase((b) => ({ ...b, code: e.target.value }))
                    }
                    placeholder='请输入自定义节点ID'
                    className='h-8 font-mono text-xs'
                  />
                </Field>
              </div>

              {/* 标签 chip */}
              <Field label='节点标签'>
                <div className='flex min-h-9 flex-wrap items-center gap-2 rounded-md border px-2 py-1 font-mono text-xs'>
                  {base.tags.map((t) => (
                    <Badge key={t} variant='secondary' className='gap-1'>
                      {t}
                      <button type='button' onClick={() => removeTag(t)}>
                        <X className='size-3' />
                      </button>
                    </Badge>
                  ))}
                  <input
                    className='min-w-32 flex-1 bg-transparent outline-none'
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder='输入后回车添加标签'
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
            </div>

            {/* ----------------------------- 网络 / DNS ----------------------------- */}
            <div className='space-y-4'>
              <Field label='节点地址'>
                <Input
                  value={base.host}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, host: e.target.value }))
                  }
                  placeholder='请输入节点域名或者IP'
                  className='h-9 font-mono text-xs'
                />
              </Field>

              <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
                <div className='flex items-center gap-2'>
                  <Checkbox
                    checked={base.dns_auto_sync}
                    onCheckedChange={(c) =>
                      setBase((b) => ({ ...b, dns_auto_sync: !!c }))
                    }
                  />
                  <Label className='font-mono text-[12px] text-foreground/80'>
                    Cloudflare DNS 自动同步
                  </Label>
                </div>
                <Field label='Cloudflare Zone'>
                  {cfZones.length > 0 ? (
                    <Select
                      value={base.dns_cloudflare_zone_id || undefined}
                      onValueChange={(v) =>
                        setBase((b) => ({ ...b, dns_cloudflare_zone_id: v }))
                      }
                    >
                      <SelectTrigger className='h-9 font-mono text-xs'>
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
                      className='h-9 font-mono text-xs'
                    />
                  )}
                </Field>
              </div>

              <div className='flex gap-4'>
                <Field label='连接端口' className='flex-1'>
                  <Input
                    value={base.port}
                    onChange={(e) =>
                      setBase((b) => ({ ...b, port: e.target.value }))
                    }
                    placeholder='用户连接端口'
                    className='h-9 font-mono text-xs'
                  />
                </Field>
                <Field label='服务端口' className='flex-1'>
                  <Input
                    value={base.server_port}
                    onChange={(e) =>
                      setBase((b) => ({ ...b, server_port: e.target.value }))
                    }
                    placeholder='请输入服务端口'
                    className='h-9 font-mono text-xs'
                  />
                </Field>
              </div>

              {/* SNI / allow_insecure / ECH — 仅普通 TLS 模式（Reality 用自有字段） */}
              {showTlsSettings && (
                <>
                  <div className='flex gap-4'>
                    <Field label='服务器名称指示(SNI)' className='flex-1'>
                      <Input
                        value={str(`${tlsPrefix}.server_name`)}
                        onChange={(e) =>
                          set(`${tlsPrefix}.server_name`, e.target.value)
                        }
                        placeholder='当节点地址与证书不一致时用于证书验证'
                        className='h-9 font-mono text-xs'
                      />
                    </Field>
                    <div className='flex items-end gap-2 pb-2'>
                      <Switch
                        checked={bool(`${tlsPrefix}.allow_insecure`)}
                        onCheckedChange={(c) =>
                          set(`${tlsPrefix}.allow_insecure`, c)
                        }
                        className='scale-90'
                      />
                      <Label className='font-mono text-[12px] text-foreground/80'>
                        允许不安全连接
                      </Label>
                    </div>
                  </div>

                  <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Switch
                          checked={echEnabled}
                          onCheckedChange={(c) =>
                            set(`${tlsPrefix}.ech.enabled`, c)
                          }
                          className='scale-90'
                        />
                        <Label className='font-mono text-[12px] text-foreground/80'>
                          ECH（Encrypted Client Hello）
                        </Label>
                      </div>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='h-7 px-2 font-mono text-[10px]'
                        onClick={() => setEchOpen(true)}
                      >
                        <KeyRound className='mr-1 size-3' /> 自动生成 ECH 密钥对
                      </Button>
                    </div>
                    {echEnabled && (
                      <div className='space-y-3'>
                        <Field label='ECH 配置 (PEM)'>
                          <Textarea
                            rows={3}
                            className='border-border/50 bg-muted/30 font-mono text-[11px]'
                            value={str(`${tlsPrefix}.ech.config`)}
                            onChange={(e) =>
                              set(`${tlsPrefix}.ech.config`, e.target.value)
                            }
                          />
                        </Field>
                        <Field label='ECH Key'>
                          <Textarea
                            rows={3}
                            className='border-border/50 bg-muted/30 font-mono text-[11px]'
                            value={str(`${tlsPrefix}.ech.key`)}
                            onChange={(e) =>
                              set(`${tlsPrefix}.ech.key`, e.target.value)
                            }
                          />
                        </Field>
                        <Field label='ECH 查询域名'>
                          <Input
                            value={str(`${tlsPrefix}.ech.query_server_name`)}
                            onChange={(e) =>
                              set(
                                `${tlsPrefix}.ech.query_server_name`,
                                e.target.value
                              )
                            }
                            placeholder='可选，用于覆盖 HTTPS 记录查询域名'
                            className='h-9 font-mono text-xs'
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ----------------------------- 协议专属配置 ----------------------------- */}
            <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <span className='h-2 w-2 rounded-full' style={{ background: SERVER_TYPE_COLOR[base.type] }} />
                <Label className='font-mono text-[12px] font-bold tracking-wide text-foreground/80'>
                  协议配置 · {SERVER_TYPE_LABEL[base.type]}
                </Label>
              </div>
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
            </div>

            {/* ----------------------------- 关联 ----------------------------- */}
            <div className='space-y-4'>
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
                  <SelectTrigger className='h-9 font-mono text-xs'>
                    <SelectValue placeholder='选择父节点' />
                  </SelectTrigger>
                  <SelectContent className='font-mono text-xs'>
                    <SelectItem value='none' className='text-xs'>
                      无
                    </SelectItem>
                    {parentOptions.map((n) => (
                      <SelectItem
                        key={n.id}
                        value={String(n.id)}
                        className='cursor-pointer text-xs'
                      >
                        {n.name}（#{n.id}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
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
              <Field label='绑定服务器'>
                <Select
                  value={base.machine_id || 'none'}
                  onValueChange={(v) =>
                    setBase((b) => ({
                      ...b,
                      machine_id: v === 'none' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger className='h-9 font-mono text-xs'>
                    <SelectValue placeholder='选择服务器（可选）' />
                  </SelectTrigger>
                  <SelectContent className='font-mono text-xs'>
                    <SelectItem value='none' className='text-xs'>
                      独立部署
                    </SelectItem>
                    {(machines ?? []).map((m) => (
                      <SelectItem
                        key={m.id}
                        value={String(m.id)}
                        className='cursor-pointer text-xs'
                      >
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {/* 显示/启用 不在编辑表单维护，与官方一致：由节点列表的「显隐」开关 + 批量启用/禁用控制 */}
            </div>
          </div>
        </div>

        <DialogFooter className='flex flex-row items-center justify-between border-t bg-muted/20 px-6 py-4 sm:space-x-0'>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => setAdvancedOpen(true)}
              className='flex h-7 items-center gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 font-mono text-[11px] hover:bg-muted'
            >
              <Settings2 className='size-3 text-muted-foreground' />
              <span className='opacity-80'>高级设置</span>
            </Button>
          </div>
          <div className='flex items-center gap-3'>
            <Button
              type='button'
              variant='ghost'
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              className='h-8 px-4 font-mono text-xs font-bold'
            >
              取消
            </Button>
            <Button
              type='button'
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className='h-8 bg-primary px-8 font-mono text-xs font-bold text-primary-foreground hover:bg-primary/90'
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
  className,
  labelClassName,
  suffix,
}: {
  label: string
  children: React.ReactNode
  hint?: string
  className?: string
  labelClassName?: string
  suffix?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label
        className={cn(
          'font-mono text-[12px] text-foreground/80',
          labelClassName
        )}
      >
        {label}
        {suffix && (
          <span className='ml-1 text-[9px] text-muted-foreground'>{suffix}</span>
        )}
      </Label>
      {children}
      {hint && (
        <p className='font-mono text-[11px] text-muted-foreground'>{hint}</p>
      )}
    </div>
  )
}

function TlsSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: number) => void
}) {
  const opts = options
  return (
    <Select
      value={value === '' ? '0' : value}
      onValueChange={(v) => onChange(Number(v))}
    >
      <SelectTrigger className='h-9 font-mono text-xs'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className='font-mono text-xs'>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value} className='text-xs'>
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
      <SelectTrigger className='h-9 font-mono text-xs'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className='font-mono text-xs'>
        {NETWORKS.map((n) => (
          <SelectItem key={n} value={n} className='text-xs'>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** 加密算法可搜索下拉（预设 + 自定义，对齐原版 shadowsocks cipher 组合框）。 */
function CipherCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const isCustom = !!value && !SS_CIPHERS.includes(value)
  const kw = search.trim().toLowerCase()
  const filtered = SS_CIPHERS.filter((c) => c.toLowerCase().includes(kw))
  const showCustomFromSearch =
    !!search.trim() && !SS_CIPHERS.some((c) => c === search.trim())
  const pick = (v: string) => {
    onChange(v)
    setSearch('')
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='h-9 w-full justify-between font-mono text-xs font-normal'
        >
          <span className='truncate'>{value || '选择加密算法'}</span>
          <ChevronsUpDown className='ml-2 size-3.5 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[--radix-popover-trigger-width] p-0'
        align='start'
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索或输入自定义加密方式...'
            value={search}
            onValueChange={setSearch}
            className='font-mono text-xs'
          />
          <CommandList>
            <CommandEmpty className='py-4 text-center font-mono text-xs text-muted-foreground'>
              未找到匹配的加密方式
            </CommandEmpty>
            {showCustomFromSearch && (
              <CommandGroup heading='自定义加密方式'>
                <CommandItem
                  value={`__custom_${search}`}
                  onSelect={() => pick(search.trim())}
                  className='font-mono text-xs'
                >
                  使用 “{search.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
            {isCustom && !showCustomFromSearch && (
              <CommandGroup heading='当前值'>
                <CommandItem value={value} className='font-mono text-xs'>
                  <Check className='mr-2 size-3.5 opacity-100' />
                  {value}
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading='预设加密方式'>
                {filtered.map((c) => (
                  <CommandItem
                    key={c}
                    value={c}
                    onSelect={() => pick(c)}
                    className='font-mono text-xs'
                  >
                    <Check
                      className={cn(
                        'mr-2 size-3.5',
                        value === c ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {c}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** network_settings 结构化字段（随 network：path/host/serviceName）。 */
function NetworkSettings({ str, set }: Pick<FieldProps, 'str' | 'set'>) {
  return (
    <div className='grid grid-cols-1 gap-4 rounded-xl border bg-muted/5 p-4 sm:grid-cols-3'>
      <Field label='path（ws/http 路径）'>
        <Input
          value={str('network_settings.path')}
          onChange={(e) => set('network_settings.path', e.target.value)}
          placeholder='如 /ws'
          className='h-9 font-mono text-xs'
        />
      </Field>
      <Field label='host（Host 头）'>
        <Input
          value={str('network_settings.host')}
          onChange={(e) => set('network_settings.host', e.target.value)}
          placeholder='如 cdn.example.com'
          className='h-9 font-mono text-xs'
        />
      </Field>
      <Field label='serviceName（gRPC）'>
        <Input
          value={str('network_settings.serviceName')}
          onChange={(e) => set('network_settings.serviceName', e.target.value)}
          placeholder='如 grpc-service'
          className='h-9 font-mono text-xs'
        />
      </Field>
    </div>
  )
}

/** Reality 配置块（vless tls=2 / trojan）。 */
function RealityFields({ str, bool, set }: Pick<FieldProps, 'str' | 'bool' | 'set'>) {
  const genKeypair = () => {
    try {
      const kp = generateRealityKeypair()
      set('reality_settings.private_key', kp.privateKey)
      set('reality_settings.public_key', kp.publicKey)
      toast.success('密钥对生成成功')
    } catch {
      toast.error('生成密钥对失败')
    }
  }
  const genShortId = () => {
    set('reality_settings.short_id', generateShortId())
    toast.success('Short ID 生成成功')
  }
  return (
    <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
      <div className='flex items-center justify-between'>
        <Label className='font-mono text-[12px] font-bold tracking-wide text-foreground/80'>
          Reality 配置
        </Label>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-7 px-2 font-mono text-[10px]'
          onClick={genKeypair}
        >
          <KeyRound className='mr-1 size-3' /> 生成密钥对
        </Button>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field label='伪装站点(dest)'>
          <Input
            value={str('reality_settings.server_name')}
            onChange={(e) => set('reality_settings.server_name', e.target.value)}
            placeholder='例如：example.com'
            className='h-9 font-mono text-xs'
          />
        </Field>
        <Field label='端口(port)'>
          <Input
            value={str('reality_settings.server_port')}
            onChange={(e) => set('reality_settings.server_port', e.target.value)}
            placeholder='例如：443'
            className='h-9 font-mono text-xs'
          />
        </Field>
        <Field label='公钥(Public key)'>
          <Input
            value={str('reality_settings.public_key')}
            onChange={(e) => set('reality_settings.public_key', e.target.value)}
            className='h-9 font-mono text-xs'
          />
        </Field>
        <Field label='私钥(Private key)'>
          <Input
            value={str('reality_settings.private_key')}
            onChange={(e) => set('reality_settings.private_key', e.target.value)}
            className='h-9 font-mono text-xs'
          />
        </Field>
        <Field
          label='Short ID'
          hint='客户端可用的 shortId 列表，可用于区分不同的客户端，使用0-f的十六进制字符'
        >
          <div className='relative'>
            <Input
              value={str('reality_settings.short_id')}
              onChange={(e) => set('reality_settings.short_id', e.target.value)}
              placeholder='可留空，长度为2的倍数，最长16位'
              className='h-9 pr-9 font-mono text-xs'
            />
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute right-0 top-0 h-full px-2 text-muted-foreground hover:text-foreground'
              onClick={genShortId}
            >
              <RefreshCw className='size-3.5' />
            </Button>
          </div>
        </Field>
      </div>
      <div className='flex items-center gap-2'>
        <Switch
          checked={bool('reality_settings.allow_insecure')}
          onCheckedChange={(c) => set('reality_settings.allow_insecure', c)}
          className='scale-90'
        />
        <Label className='font-mono text-[12px] text-foreground/80'>
          允许不安全?
        </Label>
      </div>
    </div>
  )
}

/** 通用多路复用块（vmess/vless/trojan/mieru）。 */
function MultiplexFields({ bool, num, str, set }: Pick<FieldProps, 'bool' | 'num' | 'str' | 'set'>) {
  const enabled = bool('multiplex.enabled')
  return (
    <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
      <div className='flex items-center justify-between'>
        <div>
          <Label className='font-mono text-[12px] text-foreground/80'>
            多路复用 (Multiplex)
          </Label>
          <div className='font-mono text-[11px] opacity-70'>
            通过单条 TCP 连接传输多个流，降低握手延迟
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(c) => set('multiplex.enabled', c)}
          className='scale-90'
        />
      </div>
      {enabled && (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='复用协议'>
              <Select
                value={str('multiplex.protocol') || 'yamux'}
                onValueChange={(v) => set('multiplex.protocol', v)}
              >
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='font-mono text-xs'>
                  <SelectItem value='smux' className='text-xs'>
                    smux
                  </SelectItem>
                  <SelectItem value='yamux' className='text-xs'>
                    yamux
                  </SelectItem>
                  <SelectItem value='h2mux' className='text-xs'>
                    h2mux
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='最大连接数'>
              <Input
                value={num('multiplex.max_connections')}
                onChange={(e) =>
                  set(
                    'multiplex.max_connections',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
                className='h-9 font-mono text-xs'
              />
            </Field>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={bool('multiplex.padding')}
              onCheckedChange={(c) => set('multiplex.padding', c)}
              className='scale-90'
            />
            <Label className='font-mono text-[12px] text-foreground/80'>
              启用填充
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={bool('multiplex.brutal.enabled')}
              onCheckedChange={(c) => set('multiplex.brutal.enabled', c)}
              className='scale-90'
            />
            <Label className='font-mono text-[12px] text-foreground/80'>
              TCP Brutal (激进拥塞控制)
            </Label>
          </div>
          {bool('multiplex.brutal.enabled') && (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <Field label='上行带宽'>
                <Input
                  value={num('multiplex.brutal.up_mbps')}
                  onChange={(e) =>
                    set(
                      'multiplex.brutal.up_mbps',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                  className='h-9 font-mono text-xs'
                />
              </Field>
              <Field label='下行带宽'>
                <Input
                  value={num('multiplex.brutal.down_mbps')}
                  onChange={(e) =>
                    set(
                      'multiplex.brutal.down_mbps',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                  className='h-9 font-mono text-xs'
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
    <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
      <div className='flex items-center gap-2'>
        <Switch
          checked={enabled}
          onCheckedChange={(c) => set('utls.enabled', c)}
          className='scale-90'
        />
        <Label className='font-mono text-[12px] text-foreground/80'>
          uTLS（指纹伪装）
        </Label>
      </div>
      {enabled && (
        <Field label='fingerprint'>
          <Select
            value={str('utls.fingerprint') || 'chrome'}
            onValueChange={(v) => set('utls.fingerprint', v)}
          >
            <SelectTrigger className='h-9 font-mono text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='font-mono text-xs'>
              <SelectItem value='chrome' className='text-xs'>
                Chrome
              </SelectItem>
              <SelectItem value='firefox' className='text-xs'>
                Firefox
              </SelectItem>
              <SelectItem value='safari' className='text-xs'>
                Safari
              </SelectItem>
              <SelectItem value='ios' className='text-xs'>
                iOS
              </SelectItem>
            </SelectContent>
          </Select>
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
    case 'shadowsocks': {
      const plugin = str('plugin') || 'none'
      return (
        <>
          <Field label='加密算法' hint='选择预设加密方式或输入自定义加密方式'>
            <CipherCombobox
              value={str('cipher') || 'aes-128-gcm'}
              onChange={(v) => set('cipher', v)}
            />
          </Field>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='插件'>
              <Select
                value={plugin}
                onValueChange={(v) => set('plugin', v === 'none' ? '' : v)}
              >
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue placeholder='选择插件' />
                </SelectTrigger>
                <SelectContent className='font-mono text-xs'>
                  {SS_PLUGINS.map((p) => (
                    <SelectItem key={p.value} value={p.value} className='text-xs'>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label='客户端指纹' hint='客户端伪装指纹，用于降低被识别风险'>
              <Select
                value={str('client_fingerprint') || undefined}
                onValueChange={(v) => set('client_fingerprint', v)}
              >
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue placeholder='选择客户端指纹' />
                </SelectTrigger>
                <SelectContent className='font-mono text-xs'>
                  {CLIENT_FINGERPRINTS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className='text-xs'>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field
            label='插件选项'
            hint={
              SS_PLUGIN_HINTS[plugin] ??
              '按照 key=value;key2=value2 格式输入插件选项'
            }
          >
            <Input
              value={str('plugin_opts')}
              onChange={(e) => set('plugin_opts', e.target.value)}
              placeholder='例如: mode=tls;host=bing.com'
              className='h-9 font-mono text-xs'
            />
          </Field>
        </>
      )
    }

    case 'vmess':
      return (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='TLS'>
              <TlsSelect
                value={num('tls')}
                options={TLS_SUPPORT}
                onChange={(v) => set('tls', v)}
              />
            </Field>
            <Field label='传输协议'>
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
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='安全性'>
              <TlsSelect
                value={num('tls')}
                options={TLS_NONE_TLS_REALITY}
                onChange={(v) => set('tls', v)}
              />
            </Field>
            <Field label='传输协议'>
              <NetworkSelect
                value={str('network')}
                onChange={(v) => set('network', v)}
              />
            </Field>
          </div>
          <Field label='流控'>
            <Select
              value={str('flow') || 'none'}
              onValueChange={(v) => set('flow', v === 'none' ? '' : v)}
            >
              <SelectTrigger className='h-9 font-mono text-xs'>
                <SelectValue placeholder='选择流控' />
              </SelectTrigger>
              <SelectContent className='font-mono text-xs'>
                {VLESS_FLOWS.map((f) => (
                  <SelectItem key={f} value={f} className='text-xs'>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <NetworkSettings str={str} set={set} />
          <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <Label className='font-mono text-[12px] text-foreground/80'>
                  VLESS Encryption
                </Label>
                <div className='font-mono text-[11px] opacity-70'>
                  启用 VLESS 加密
                </div>
              </div>
              <Switch
                checked={bool('encryption.enabled')}
                onCheckedChange={(c) => set('encryption.enabled', c)}
                className='scale-90'
              />
            </div>
            {bool('encryption.enabled') && (
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <Field label='encryption'>
                  <Input
                    value={str('encryption.encryption')}
                    onChange={(e) =>
                      set('encryption.encryption', e.target.value)
                    }
                    placeholder='./xray vlessenc 生成'
                    className='h-9 font-mono text-xs'
                  />
                </Field>
                <Field label='decryption'>
                  <Input
                    value={str('encryption.decryption')}
                    onChange={(e) =>
                      set('encryption.decryption', e.target.value)
                    }
                    placeholder='./xray vlessenc 生成'
                    className='h-9 font-mono text-xs'
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
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='安全性'>
              <TlsSelect
                value={num('tls')}
                options={TLS_NONE_TLS_REALITY}
                onChange={(v) => set('tls', v)}
              />
            </Field>
            <Field label='传输协议'>
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
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='协议版本'>
              <Select
                value={num('version') || '2'}
                onValueChange={(v) => set('version', Number(v))}
              >
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='font-mono text-xs'>
                  <SelectItem value='1' className='text-xs'>
                    1
                  </SelectItem>
                  <SelectItem value='2' className='text-xs'>
                    2
                  </SelectItem>
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
                className='h-9 font-mono text-xs'
              />
            </Field>
          </div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='上行宽带' suffix='Mbps，留空则使用BBR'>
              <Input
                value={num('bandwidth.up')}
                onChange={(e) =>
                  set(
                    'bandwidth.up',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
                placeholder='请输入上行宽带'
                className='h-9 font-mono text-xs'
              />
            </Field>
            <Field label='下行宽带' suffix='Mbps，留空则使用BBR'>
              <Input
                value={num('bandwidth.down')}
                onChange={(e) =>
                  set(
                    'bandwidth.down',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
                placeholder='请输入下行宽带'
                className='h-9 font-mono text-xs'
              />
            </Field>
          </div>
          <Field label='ALPN'>
            <Select
              value={str('alpn') || 'h3'}
              onValueChange={(v) => set('alpn', v)}
            >
              <SelectTrigger className='h-9 font-mono text-xs'>
                <SelectValue placeholder='ALPN' />
              </SelectTrigger>
              <SelectContent className='font-mono text-xs'>
                {HYSTERIA_ALPN.map((a) => (
                  <SelectItem key={a} value={a} className='text-xs'>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className='space-y-3 rounded-xl border bg-muted/5 p-4'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={bool('obfs.open')}
                onCheckedChange={(c) => set('obfs.open', c)}
                className='scale-90'
              />
              <Label className='font-mono text-[12px] text-foreground/80'>
                混淆
              </Label>
            </div>
            {bool('obfs.open') && (
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <Field label='混淆实现'>
                  <Select
                    value={str('obfs.type') || 'salamander'}
                    onValueChange={(v) => set('obfs.type', v)}
                  >
                    <SelectTrigger className='h-9 font-mono text-xs'>
                      <SelectValue placeholder='选择混淆实现' />
                    </SelectTrigger>
                    <SelectContent className='font-mono text-xs'>
                      <SelectItem value='salamander' className='text-xs'>
                        Salamander
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label='混淆密码'>
                  <div className='relative'>
                    <Input
                      value={str('obfs.password')}
                      onChange={(e) => set('obfs.password', e.target.value)}
                      placeholder='请输入混淆密码'
                      className='h-9 pr-9 font-mono text-xs'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='absolute right-0 top-0 h-full px-2 text-muted-foreground hover:text-foreground'
                      onClick={() => {
                        set('obfs.password', generateRandomPassword())
                        toast.success('混淆密码生成成功')
                      }}
                    >
                      <RefreshCw className='size-3.5' />
                    </Button>
                  </div>
                </Field>
              </div>
            )}
          </div>
        </>
      )

    case 'tuic':
      return (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='协议版本'>
              <Select
                value={num('version') || '5'}
                onValueChange={(v) => set('version', Number(v))}
              >
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue placeholder='选择TUIC版本' />
                </SelectTrigger>
                <SelectContent className='font-mono text-xs'>
                  {TUIC_VERSIONS.map((v) => (
                    <SelectItem key={v} value={v} className='text-xs'>
                      V{v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label='拥塞控制'>
              <Select
                value={str('congestion_control') || 'cubic'}
                onValueChange={(v) => set('congestion_control', v)}
              >
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue placeholder='选择拥塞控制算法' />
                </SelectTrigger>
                <SelectContent className='font-mono text-xs'>
                  {TUIC_CONGESTION.map((c) => (
                    <SelectItem key={c} value={c} className='text-xs'>
                      {c.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label='UDP中继模式'>
            <Select
              value={str('udp_relay_mode') || 'native'}
              onValueChange={(v) => set('udp_relay_mode', v)}
            >
              <SelectTrigger className='h-9 font-mono text-xs'>
                <SelectValue placeholder='选择UDP中继模式' />
              </SelectTrigger>
              <SelectContent className='font-mono text-xs'>
                {TUIC_UDP_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value} className='text-xs'>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='ALPN'>
            <MultiCheck
              options={TUIC_ALPN}
              selected={(() => {
                const v = arr('alpn')
                return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []
              })()}
              onChange={(next) => set('alpn', next)}
              empty='未找到可用的ALPN协议'
            />
          </Field>
        </>
      )

    case 'mieru':
      return (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='传输协议'>
              <Select
                value={str('transport') || 'TCP'}
                onValueChange={(v) => set('transport', v)}
              >
                <SelectTrigger className='h-9 font-mono text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='font-mono text-xs'>
                  <SelectItem value='TCP' className='text-xs'>
                    TCP
                  </SelectItem>
                  <SelectItem value='UDP' className='text-xs'>
                    UDP
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='流量 (Base64)'>
              <Input
                value={str('traffic_pattern')}
                onChange={(e) => set('traffic_pattern', e.target.value)}
                placeholder='请输入 Base64 字符串用于微调网络行为'
                className='h-9 font-mono text-xs'
              />
            </Field>
          </div>
          <MultiplexFields bool={bool} num={num} str={str} set={set} />
        </>
      )

    case 'anytls':
      return (
        <>
          <Field label='ALPN' hint='如 h2,http/1.1'>
            <Input
              value={str('alpn')}
              onChange={(e) => set('alpn', e.target.value)}
              className='h-9 font-mono text-xs'
            />
          </Field>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label className='font-mono text-[12px] text-foreground/80'>
                填充方案
              </Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 px-2 font-mono text-[10px]'
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
              className='border-border/50 bg-muted/30 font-mono text-[11px]'
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
          <TlsSelect
            value={num('tls')}
            options={TLS_SUPPORT}
            onChange={(v) => set('tls', v)}
          />
        </Field>
      )

    default:
      return null
  }
}

