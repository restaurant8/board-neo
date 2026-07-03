import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronsUpDown,
  Info,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Settings2,
  X,
} from 'lucide-react'
import { Command as CommandPrimitive } from 'cmdk'
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
  PopoverAnchor,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  SERVER_TYPES,
  SERVER_TYPE_COLOR,
  SERVER_TYPE_LABEL,
  type Server,
  type ServerType,
  generateEchKey,
  saveNode,
} from '../api'
import {
  AdvancedConfigDialog,
  type AdvancedConfigValue,
} from './advanced-config-dialog'

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

/** ech 子对象默认值（对齐原版 v4t schema default）。 */
const ECH_DEFAULT = {
  enabled: false,
  config: '',
  query_server_name: '',
  key: '',
}
/** utls 子对象默认值（对齐原版 _4t schema default）。 */
const UTLS_DEFAULT = { enabled: false, fingerprint: 'chrome' }
/** multiplex 子对象默认值（对齐原版 f4t schema default）。 */
const MULTIPLEX_DEFAULT = {
  enabled: false,
  protocol: 'smux',
  max_connections: 4,
  padding: false,
  brutal: { enabled: false, up_mbps: 100, down_mbps: 100 },
}

/** protocol_settings 默认值（逐字段对齐原版各协议 zod schema 的 default）。 */
const PROTOCOL_DEFAULTS: Record<ServerType, Record<string, unknown>> = {
  shadowsocks: {
    cipher: 'aes-128-gcm',
    plugin: '',
    plugin_opts: '',
    client_fingerprint: 'chrome',
  },
  vmess: {
    tls: 0,
    tls_settings: {
      server_name: '',
      allow_insecure: false,
      ech: { ...ECH_DEFAULT },
    },
    utls: { ...UTLS_DEFAULT },
    network: 'tcp',
    network_settings: {},
    multiplex: { ...MULTIPLEX_DEFAULT },
  },
  vless: {
    tls: 0,
    tls_settings: {
      server_name: '',
      allow_insecure: false,
      ech: { ...ECH_DEFAULT },
    },
    utls: { ...UTLS_DEFAULT },
    reality_settings: {
      server_port: 443,
      server_name: '',
      allow_insecure: false,
      public_key: '',
      private_key: '',
      short_id: '',
      fingerprint: 'chrome',
    },
    network: 'tcp',
    network_settings: {},
    flow: '',
    multiplex: { ...MULTIPLEX_DEFAULT },
    encryption: { enabled: false, encryption: '', decryption: '' },
  },
  trojan: {
    tls: 1,
    tls_settings: {
      server_name: '',
      allow_insecure: false,
      ech: { ...ECH_DEFAULT },
    },
    server_name: '',
    allow_insecure: false,
    reality_settings: {
      server_port: 443,
      server_name: '',
      allow_insecure: false,
      public_key: '',
      private_key: '',
      short_id: '',
    },
    utls: { ...UTLS_DEFAULT },
    network: 'tcp',
    network_settings: {},
    multiplex: { ...MULTIPLEX_DEFAULT },
  },
  hysteria: {
    version: 2,
    alpn: 'h2',
    obfs: { open: false, type: 'salamander', password: '' },
    tls: { server_name: '', allow_insecure: false, ech: { ...ECH_DEFAULT } },
    bandwidth: { up: '', down: '' },
  },
  tuic: {
    version: 5,
    congestion_control: 'bbr',
    alpn: ['h3'],
    udp_relay_mode: 'native',
    tls: { server_name: '', allow_insecure: false, ech: { ...ECH_DEFAULT } },
  },
  anytls: {
    padding_scheme: [],
    tls: { server_name: '', allow_insecure: false, ech: { ...ECH_DEFAULT } },
  },
  socks: {},
  naive: {
    tls: 0,
    tls_settings: {
      server_name: '',
      allow_insecure: false,
      ech: { ...ECH_DEFAULT },
    },
  },
  http: {
    tls: 0,
    tls_settings: {
      server_name: '',
      allow_insecure: false,
      ech: { ...ECH_DEFAULT },
    },
  },
  mieru: { transport: 'TCP', traffic_pattern: '' },
}

/** 带 multiplex 的协议（高级设置弹窗展示「多路复用」Tab，对齐原版 hasMultiplex）。 */
const MULTIPLEX_TYPES: ServerType[] = ['vmess', 'vless', 'trojan']

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
/** uTLS 指纹（对齐原版 b4t，比 ss 客户端指纹多 Edge/Random）。 */
const UTLS_FINGERPRINTS = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'safari', label: 'Safari' },
  { value: 'ios', label: 'iOS' },
  { value: 'edge', label: 'Edge' },
  { value: 'random', label: 'Random' },
]
/** vmess/trojan 传输协议（对齐原版 networkOptions）。 */
const VMESS_NETWORKS = [
  { value: 'tcp', label: 'TCP' },
  { value: 'ws', label: 'Websocket' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'h2', label: 'HTTP/2' },
  { value: 'httpupgrade', label: 'HttpUpgrade' },
  { value: 'xhttp', label: 'XHTTP' },
]
/** vless 传输协议（对齐原版：多 mKCP）。 */
const VLESS_NETWORKS = [
  { value: 'tcp', label: 'TCP' },
  { value: 'ws', label: 'Websocket' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'h2', label: 'HTTP/2' },
  { value: 'kcp', label: 'mKCP' },
  { value: 'httpupgrade', label: 'HttpUpgrade' },
  { value: 'xhttp', label: 'XHTTP' },
]

/** network_settings JSON 模板（对齐原版 m4t 的 templates）。 */
const NETWORK_TEMPLATES: Record<string, { label: string; content: unknown }> = {
  tcp: {
    label: 'TCP',
    content: { acceptProxyProtocol: false, header: { type: 'none' } },
  },
  'tcp-http': {
    label: 'TCP + HTTP',
    content: {
      acceptProxyProtocol: false,
      header: {
        type: 'http',
        request: {
          version: '1.1',
          method: 'GET',
          path: ['/'],
          headers: { Host: ['www.example.com'] },
        },
        response: { version: '1.1', status: '200', reason: 'OK' },
      },
    },
  },
  grpc: { label: 'gRPC', content: { serviceName: 'GunService' } },
  ws: {
    label: 'WebSocket',
    content: { path: '/', headers: { Host: 'v2ray.com' } },
  },
  h2: { label: 'HTTP/2', content: { path: '/', host: ['www.google.com'] } },
  httpupgrade: {
    label: 'HttpUpgrade',
    content: {
      acceptProxyProtocol: false,
      path: '/',
      host: 'xray.com',
      headers: { key: 'value' },
    },
  },
  xhttp: {
    label: 'XHTTP',
    content: {
      host: 'example.com',
      path: '/yourpath',
      mode: 'auto',
      extra: {
        headers: {},
        xPaddingBytes: '100-1000',
        noGRPCHeader: false,
        noSSEHeader: false,
        scMaxEachPostBytes: 1e6,
        scMinPostsIntervalMs: 30,
        scMaxBufferedPosts: 30,
        xmux: {
          maxConcurrency: '16-32',
          maxConnections: 0,
          cMaxReuseTimes: '64-128',
          cMaxLifetimeMs: 0,
          hMaxRequestTimes: '800-900',
          hKeepAlivePeriod: 0,
        },
        downloadSettings: {
          address: '',
          port: 443,
          network: 'xhttp',
          security: 'tls',
          tlsSettings: {},
          xhttpSettings: { path: '/yourpath' },
          sockopt: {},
        },
      },
    },
  },
}
/** 各传输协议可用的模板 key（对齐原版 m4t.getTemplates）。 */
function templatesForType(type: string): string[] {
  switch (type) {
    case 'tcp':
      return ['tcp', 'tcp-http']
    case 'grpc':
      return ['grpc']
    case 'ws':
      return ['ws']
    case 'h2':
      return ['h2']
    case 'httpupgrade':
      return ['httpupgrade']
    case 'xhttp':
      return ['xhttp']
    default:
      return []
  }
}

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
  const [advancedOpen, setAdvancedOpen] = useState(false)
  /** 协议卡片内嵌弹窗（如「编辑协议」network_settings JSON）打开中。 */
  const [protoDialogOpen, setProtoDialogOpen] = useState(false)
  // 嵌套弹窗（高级设置 / 编辑协议）关闭时，其焦点归还/指针事件会以「点击主弹窗之外」
  // 的形式触达主弹窗；此时 open state 已被置 false，仅靠 state 判定会漏挡。
  // 用一个 ref 在嵌套弹窗打开期间「武装」，并延迟到关闭后的下一拍再解除，吞掉这枚尾随事件。
  const nestedGuardRef = useRef(false)
  useEffect(() => {
    if (advancedOpen || protoDialogOpen) {
      nestedGuardRef.current = true
      return
    }
    if (!nestedGuardRef.current) return
    const id = window.setTimeout(() => {
      nestedGuardRef.current = false
    }, 150)
    return () => window.clearTimeout(id)
  }, [advancedOpen, protoDialogOpen])
  const nestedActive = () =>
    advancedOpen || protoDialogOpen || nestedGuardRef.current

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
  // 「打开时装载」用渲染期间派生重置（React 官方模式），避免 effect 里同步 setState
  const [loaded, setLoaded] = useState<{
    open: boolean
    current?: Server | null
  } | null>(null)

  if (loaded?.open !== open || loaded?.current !== current) {
    setLoaded({ open, current })
    if (open) loadForm()
  }

  function loadForm() {
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
        // cert_config 是顶层字段（后端 Server.cert_config 列）；
        // loadedPs.cert_config 仅兜底历史上误嵌进 protocol_settings 的数据。
        cert_config: ((current.cert_config as Dict) ??
          (loadedPs.cert_config as Dict) ??
          {}) as Dict,
        custom_outbounds: current.custom_outbounds ?? [],
        custom_routes: current.custom_routes ?? [],
      })
    } else {
      setBase(EMPTY_BASE)
      setPs({ ...PROTOCOL_DEFAULTS.shadowsocks })
      setAdvanced({ cert_config: {}, custom_outbounds: [], custom_routes: [] })
    }
  }

  const set = (path: string, value: unknown) =>
    setPs((prev) => setPath(prev, path, value))

  /** 切换协议类型：载入该协议默认 protocol_settings。 */
  const onTypeChange = (type: ServerType) => {
    setBase((b) => ({ ...b, type }))
    setPs({ ...(PROTOCOL_DEFAULTS[type] ?? {}) })
  }

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
        // cert_config 是顶层字段（后端 ServerSave 只校验顶层 cert_config；
        // 若嵌进 protocol_settings 会被 validated() 丢弃 → 保存无效）。
        protocol_settings: ps,
        cert_config: advanced.cert_config,
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
  /** 对象字段（如 network_settings，供 JSON 编辑弹窗读取）。 */
  const obj = (path: string) => {
    const v = getPath(ps, path)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : null
  }

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 嵌套弹窗打开或刚关闭时，忽略主弹窗的关闭请求（否则会连带关掉主弹窗）
        if (!next && nestedActive()) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className='max-w-xl gap-0 overflow-hidden p-0 sm:rounded-2xl'
        onInteractOutside={(e) => {
          // 嵌套弹窗（高级设置 / ECH）打开或刚关闭时，不应连带关闭主弹窗
          if (nestedActive()) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (nestedActive()) e.preventDefault()
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
                    <div className='font-mono text-[11px] text-muted-foreground opacity-70'>
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
                      <SelectTrigger className='h-9 w-full font-mono text-xs'>
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
                obj={obj}
                set={set}
                setPs={setPs}
                onNestedDialog={setProtoDialogOpen}
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
                  <SelectTrigger className='h-9 w-full font-mono text-xs'>
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
                  <SelectTrigger className='h-9 w-full font-mono text-xs'>
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
            {(() => {
              const certMode = String(
                (advanced.cert_config as Dict)?.cert_mode ?? ''
              )
              const hasCert = !!certMode && certMode !== 'none'
              const hasMux =
                MULTIPLEX_TYPES.includes(base.type) &&
                !!(getPath(ps, 'multiplex.enabled') as boolean)
              const hasRoutes =
                (advanced.custom_outbounds?.length ?? 0) > 0 ||
                (advanced.custom_routes?.length ?? 0) > 0
              return (
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => setAdvancedOpen(true)}
                  className='flex h-7 items-center gap-2 rounded-md border border-border/50 bg-muted/50 px-2.5 font-mono text-[11px] hover:bg-muted'
                >
                  <Settings2 className='size-3 text-muted-foreground' />
                  <span className='opacity-80'>高级设置</span>
                  {(hasCert || hasMux || hasRoutes) && (
                    <div className='ml-1 flex items-center gap-1.5 border-l border-border/60 pl-2'>
                      {hasCert && <AdvancedChip label='TLS' />}
                      {hasMux && <AdvancedChip label='MUX' />}
                      {hasRoutes && <AdvancedChip label='RT' />}
                    </div>
                  )}
                </Button>
              )
            })()}
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

      <AdvancedConfigDialog
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        value={advanced}
        onSave={setAdvanced}
        hasMultiplex={MULTIPLEX_TYPES.includes(base.type)}
        multiplex={(getPath(ps, 'multiplex') as Dict) ?? null}
        onMultiplexChange={(m) => setPs((prev) => setPath(prev, 'multiplex', m))}
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
      {hint && <p className='font-mono text-[11px] text-muted-foreground opacity-70'>{hint}</p>}
    </div>
  )
}

/** 底部「高级设置」按钮上的状态角标（对齐原版触发器 chips）。 */
function AdvancedChip({ label }: { label: string }) {
  return (
    <div className='flex items-center gap-1'>
      <div className='h-1 w-1 rounded-full bg-primary shadow-[0_0_4px_rgba(var(--primary),0.5)]' />
      <span className='text-[9px] font-bold tracking-tighter text-primary'>
        {label}
      </span>
    </div>
  )
}

/** 加密算法可搜索下拉（预设 + 自定义，对齐原版 shadowsocks cipher 组合框）。
 * 对齐要点：预设列表不随搜索过滤；输入非预设值即时生效（onChange）；
 * 弹层固定 400px；空态提示区分「有搜索词 → 使用自定义」与「无搜索词 → 提示语」。 */
function CipherCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const pick = (v: string) => {
    onChange(v)
    setSearch('')
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-foreground/80'
          )}
        >
          {value || '选择加密算法'}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[400px] p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索或输入自定义加密方式...'
            value={search}
            onValueChange={(v) => {
              setSearch(v)
              if (v && !SS_CIPHERS.includes(v)) onChange(v)
            }}
          />
          <CommandList>
            <CommandEmpty>
              {search ? (
                <CommandItem value={search} onSelect={(v) => pick(v)}>
                  <Check className='mr-2 h-4 w-4 opacity-100' />
                  <span className='font-medium text-blue-600'>
                    使用 &quot;{search}&quot;
                  </span>
                  <span className='ml-2 text-xs text-foreground/80'>
                    (自定义)
                  </span>
                </CommandItem>
              ) : (
                <div className='p-2 text-sm text-foreground/80'>
                  <p>未找到匹配的加密方式</p>
                  <p className='mt-1 text-xs'>
                    你可以直接输入自定义的加密方式，如：aes-256-cfb
                  </p>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup heading='预设加密方式'>
              {SS_CIPHERS.map((c) => (
                <CommandItem key={c} value={c} onSelect={(v) => pick(v)}>
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === c ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** SNI + 允许不安全 一行（对齐原版 flex gap-2：SNI 占 2 份，开关列 py-2 居中）。 */
function SniRow({
  prefix,
  sniLabel = '服务器名称指示(SNI)',
  sniPlaceholder,
  insecureLabel = '允许不安全?',
  str,
  bool,
  set,
}: {
  prefix: string
  sniLabel?: string
  sniPlaceholder: string
  insecureLabel?: string
} & Pick<FieldProps, 'str' | 'bool' | 'set'>) {
  return (
    <div className='flex gap-2'>
      <div className='flex-[2] space-y-2'>
        <Label className='font-mono text-[12px] text-foreground/80'>
          {sniLabel}
        </Label>
        <Input
          value={str(`${prefix}.server_name`)}
          onChange={(e) => set(`${prefix}.server_name`, e.target.value)}
          placeholder={sniPlaceholder}
          className='font-mono text-xs'
        />
      </div>
      <div className='space-y-2'>
        <Label className='font-mono text-[12px] text-foreground/80'>
          {insecureLabel}
        </Label>
        <div className='py-2 text-center'>
          <Switch
            checked={bool(`${prefix}.allow_insecure`)}
            onCheckedChange={(c) => set(`${prefix}.allow_insecure`, c)}
          />
        </div>
      </div>
    </div>
  )
}

/** ECH 配置块（对齐原版 x4t：开关卡片 + 就地调 API 生成密钥对回填）。 */
function EchBlock({
  prefix,
  str,
  bool,
  set,
}: { prefix: string } & Pick<FieldProps, 'str' | 'bool' | 'set'>) {
  const enabled = bool(`${prefix}.enabled`)
  const [generating, setGenerating] = useState(false)
  const generate = async () => {
    setGenerating(true)
    try {
      const r = await generateEchKey()
      if (r) {
        set(`${prefix}.key`, r.key)
        set(`${prefix}.config`, r.config)
      }
    } catch {
      // 与原版一致：失败静默（请求层已有全局错误提示）
    } finally {
      setGenerating(false)
    }
  }
  return (
    <div className='space-y-4 rounded-lg border bg-muted/10 p-4'>
      <div className='flex flex-row items-center justify-between'>
        <div className='space-y-0.5'>
          <Label className='font-mono text-[13px] font-bold'>ECH</Label>
          <p className='font-mono text-[11px] text-muted-foreground opacity-70'>
            为支持的 TLS 客户端启用 Encrypted Client
            Hello。留空配置时会尝试通过 DNS 查询。
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(c) => set(`${prefix}.enabled`, c)}
        />
      </div>
      {enabled && (
        <div className='space-y-4 border-t border-dashed pt-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={generate}
            disabled={generating}
            className='w-full font-mono text-xs'
          >
            {generating ? (
              <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
            ) : (
              <KeyRound className='mr-2 h-3.5 w-3.5' />
            )}
            自动生成 ECH 密钥对
          </Button>
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              ECH 配置 (PEM)
            </Label>
            <Textarea
              className='min-h-[120px] resize-y font-mono text-xs'
              value={str(`${prefix}.config`)}
              onChange={(e) => set(`${prefix}.config`, e.target.value)}
              placeholder='粘贴 PEM 格式的 ECH 配置，每行一段内容'
            />
            <p className='font-mono text-[10px] text-muted-foreground opacity-70'>
              留空时，sing-box 会尝试通过 DNS 加载 ECH 配置。
            </p>
          </div>
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              ECH Key
            </Label>
            <Textarea
              className='min-h-[100px] resize-y font-mono text-xs'
              value={str(`${prefix}.key`)}
              onChange={(e) => set(`${prefix}.key`, e.target.value)}
              placeholder='当后端需要时粘贴 ECH key 内容'
            />
            <p className='font-mono text-[10px] text-muted-foreground opacity-70'>
              后端需要时可填写的 ECH key 内容。
            </p>
          </div>
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              ECH 查询域名
            </Label>
            <Input
              className='h-8 font-mono text-xs'
              value={str(`${prefix}.query_server_name`)}
              onChange={(e) => set(`${prefix}.query_server_name`, e.target.value)}
              placeholder='可选，用于覆盖 HTTPS 记录查询域名'
            />
            <p className='font-mono text-[10px] text-muted-foreground opacity-70'>
              覆盖用于 ECH HTTPS 记录查询的域名，留空时默认使用 server_name。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/** uTLS 配置块（对齐原版 y4t：开关卡片，开启时给默认指纹 chrome）。 */
function UtlsBlock({
  prefix = 'utls',
  str,
  bool,
  set,
}: { prefix?: string } & Pick<FieldProps, 'str' | 'bool' | 'set'>) {
  const enabled = bool(`${prefix}.enabled`)
  return (
    <div className='space-y-4 rounded-lg border bg-muted/10 p-4'>
      <div className='flex flex-row items-center justify-between'>
        <div className='space-y-0.5'>
          <Label className='font-mono text-[13px] font-bold'>uTLS</Label>
          <p className='font-mono text-[11px] text-muted-foreground opacity-70'>
            客户端伪装指纹，用于降低被识别风险
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(c) => {
            set(`${prefix}.enabled`, c)
            if (c && !str(`${prefix}.fingerprint`))
              set(`${prefix}.fingerprint`, 'chrome')
          }}
        />
      </div>
      {enabled && (
        <div className='border-t border-dashed pt-2'>
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              客户端指纹 (uTLS)
            </Label>
            <Select
              value={str(`${prefix}.fingerprint`) || 'chrome'}
              onValueChange={(v) => set(`${prefix}.fingerprint`, v)}
            >
              <SelectTrigger className='h-8 w-full font-mono text-xs'>
                <SelectValue placeholder='选择客户端指纹' />
              </SelectTrigger>
              <SelectContent>
                {UTLS_FINGERPRINTS.map((f) => (
                  <SelectItem
                    key={f.value}
                    value={f.value}
                    className='font-mono text-xs'
                  >
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}

/** Reality 配置（vless tls=2 / trojan tls=2，对齐原版平铺行 + 图标生成按钮）。 */
function RealityBlock({
  variant,
  str,
  bool,
  set,
}: { variant: 'vless' | 'trojan' } & Pick<FieldProps, 'str' | 'bool' | 'set'>) {
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
  const shortIdDesc =
    '客户端可用的 shortId 列表，可用于区分不同的客户端，使用0-f的十六进制字符'
  return (
    <>
      <div className='flex gap-2'>
        <div className='flex-[2] space-y-2'>
          <Label className='font-mono text-[12px] text-foreground/80'>
            伪装站点(dest)
          </Label>
          <Input
            className='font-mono text-xs'
            value={str('reality_settings.server_name')}
            onChange={(e) => set('reality_settings.server_name', e.target.value)}
            placeholder='例如：example.com'
          />
        </div>
        <div className='flex-1 space-y-2'>
          <Label className='font-mono text-[12px] text-foreground/80'>
            端口(port)
          </Label>
          <Input
            className='font-mono text-xs'
            value={str('reality_settings.server_port')}
            onChange={(e) => set('reality_settings.server_port', e.target.value)}
            placeholder='例如：443'
          />
        </div>
        <div className='space-y-2'>
          <Label className='font-mono text-[12px] text-foreground/80'>
            允许不安全?
          </Label>
          <div className='py-2 text-center'>
            <Switch
              checked={bool('reality_settings.allow_insecure')}
              onCheckedChange={(c) => set('reality_settings.allow_insecure', c)}
            />
          </div>
        </div>
      </div>
      <div className='flex items-end gap-2'>
        <div className='flex-1 space-y-2'>
          <Label className='font-mono text-[12px] text-foreground/80'>
            私钥(Private key)
          </Label>
          <div className='relative'>
            <Input
              className='pr-9 font-mono text-xs'
              value={str('reality_settings.private_key')}
              onChange={(e) =>
                set('reality_settings.private_key', e.target.value)
              }
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={genKeypair}
                    className='absolute right-0 top-0 h-full px-2 transition-transform duration-150 active:scale-90'
                  >
                    <KeyRound className='h-4 w-4 transition-transform duration-300 hover:rotate-180' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>生成密钥对</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
      <div className='space-y-2'>
        <Label className='font-mono text-[12px] text-foreground/80'>
          公钥(Public key)
        </Label>
        <Input
          className='font-mono text-xs'
          value={str('reality_settings.public_key')}
          onChange={(e) => set('reality_settings.public_key', e.target.value)}
        />
      </div>
      {variant === 'vless' ? (
        <div className='space-y-2'>
          <Label className='font-mono text-[12px] text-foreground/80'>
            Short ID
          </Label>
          <div className='relative'>
            <Input
              className='pr-9 font-mono text-xs'
              value={str('reality_settings.short_id')}
              onChange={(e) => set('reality_settings.short_id', e.target.value)}
              placeholder='可留空，长度为2的倍数，最长16位'
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={genShortId}
                    className='absolute right-0 top-0 h-full px-2 transition-transform duration-150 active:scale-90'
                  >
                    <RefreshCw className='h-4 w-4 transition-transform duration-300 hover:rotate-180' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>生成 Short ID</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className='font-mono text-[11px] text-xs text-foreground/80 opacity-70'>
            {shortIdDesc}
          </p>
        </div>
      ) : (
        <div className='flex gap-2'>
          <div className='flex-1 space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              <div className='flex items-center gap-1'>
                Short ID
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className='h-3 w-3 cursor-help text-muted-foreground' />
                    </TooltipTrigger>
                    <TooltipContent className='max-w-[300px]'>
                      <p>{shortIdDesc}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Label>
            <div className='relative'>
              <Input
                className='pr-9 font-mono text-xs'
                value={str('reality_settings.short_id')}
                onChange={(e) =>
                  set('reality_settings.short_id', e.target.value)
                }
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      onClick={genShortId}
                      className='absolute right-0 top-0 h-full px-2 transition-transform duration-150 active:scale-90'
                    >
                      <RefreshCw className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>生成 Short ID</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** network_settings JSON 编辑弹窗（对齐原版 m4t：模板按钮 + JSON 校验 + 关闭即保存）。 */
function NetworkSettingsDialog({
  value,
  onChange,
  templateType,
  onOpenNotify,
}: {
  value: Dict | null
  onChange: (v: Dict | null) => void
  templateType: string
  onOpenNotify: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const templates = templatesForType(templateType)

  const validate = (t: string): string | null => {
    if (!t) return null
    try {
      const p = JSON.parse(t)
      // 与原版一致：仅要求 typeof object（数组也放行）
      return typeof p !== 'object' || p === null ? '配置必须是一个JSON对象' : null
    } catch {
      return '无效的JSON格式'
    }
  }

  const save = () => {
    const err = validate(text || '')
    if (err) {
      toast.error(err)
      return
    }
    try {
      if (!text) {
        onChange(null)
        setOpen(false)
        onOpenNotify(false)
        return
      }
      onChange(JSON.parse(text))
      setOpen(false)
      onOpenNotify(false)
    } catch {
      toast.error('保存时发生错误')
    }
  }

  const handleOpenChange = (o: boolean) => {
    if (o) {
      // 打开时装载当前值（原版 m4t：非空才序列化展示）
      setText(
        value && Object.keys(value).length > 0
          ? JSON.stringify(value, null, 2)
          : ''
      )
      setError(null)
    }
    if (!o && open) save()
    setOpen(o)
    onOpenNotify(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type='button'
        variant='link'
        onClick={() => handleOpenChange(true)}
      >
        编辑协议
      </Button>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>编辑协议配置</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          {templates.length > 0 && (
            <div className='flex flex-wrap gap-2 pt-2'>
              {templates.map((k) => (
                <Button
                  key={k}
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setText(
                      JSON.stringify(NETWORK_TEMPLATES[k].content, null, 2)
                    )
                    setError(null)
                  }}
                >
                  使用{NETWORK_TEMPLATES[k].label}模板
                </Button>
              ))}
            </div>
          )}
          <div className='space-y-2'>
            <Textarea
              className={
                'min-h-[200px] font-mono text-sm ' +
                (error ? 'border-red-500 focus-visible:ring-red-500' : '')
              }
              value={text}
              placeholder={
                templates.length > 0
                  ? '请输入JSON配置或选择上方模板'
                  : '请输入JSON配置'
              }
              onChange={(e) => {
                setText(e.target.value)
                setError(validate(e.target.value))
              }}
            />
            {error && <p className='text-sm text-red-500'>{error}</p>}
          </div>
        </div>
        <DialogFooter className='gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              setOpen(false)
              onOpenNotify(false)
            }}
          >
            取消
          </Button>
          <Button type='button' onClick={save} disabled={!!error}>
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 传输协议字段（label 内嵌「编辑协议」JSON 弹窗触发器，对齐原版）。 */
function NetworkField({
  options,
  obj,
  str,
  set,
  setPs,
  onNestedDialog,
}: {
  options: { value: string; label: string }[]
} & Pick<FieldProps, 'obj' | 'str' | 'set' | 'setPs' | 'onNestedDialog'>) {
  const network = str('network') || 'tcp'
  return (
    <div className='space-y-2'>
      <Label className='font-mono text-[12px] text-foreground/80'>
        传输协议
        <NetworkSettingsDialog
          value={obj('network_settings')}
          onChange={(v) =>
            setPs((prev) => setPath(prev, 'network_settings', v))
          }
          templateType={network}
          onOpenNotify={onNestedDialog}
        />
      </Label>
      <Select value={network} onValueChange={(v) => set('network', v)}>
        <SelectTrigger className='h-9 w-full font-mono text-xs'>
          <SelectValue placeholder='选择传输协议' />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className='cursor-pointer'>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** tuic ALPN 多选（对齐原版 MultipleSelector：badge + 命令面板下拉）。 */
function AlpnMultiSelect({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = TUIC_ALPN.filter((o) => value.includes(o.value))
  const remaining = TUIC_ALPN.filter((o) => !value.includes(o.value))
  const remove = (v: string) => onChange(value.filter((x) => x !== v))
  return (
    <Command
      shouldFilter={false}
      className='h-auto overflow-visible bg-transparent'
      onKeyDown={(e) => {
        if (
          (e.key === 'Delete' || e.key === 'Backspace') &&
          !search &&
          value.length > 0
        )
          remove(value[value.length - 1])
        if (e.key === 'Escape') inputRef.current?.blur()
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            className={cn(
              'rounded-md border border-input font-mono text-xs ring-offset-background focus-within:ring-1 focus-within:ring-ring',
              selected.length !== 0 && 'cursor-text px-3 py-2'
            )}
            onClick={() => inputRef.current?.focus()}
          >
            <div className='flex flex-wrap gap-1'>
              {selected.map((o) => (
                <Badge key={o.value}>
                  {o.label}
                  <button
                    type='button'
                    className='ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2'
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={() => remove(o.value)}
                  >
                    <X className='h-3 w-3 text-muted-foreground hover:text-foreground' />
                  </button>
                </Badge>
              ))}
              <CommandPrimitive.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                onFocus={() => setOpen(true)}
                placeholder='选择ALPN协议'
                className={cn(
                  'flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
                  selected.length === 0 ? 'px-3 py-2' : 'ml-1'
                )}
              />
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (e.target === inputRef.current) e.preventDefault()
          }}
          className='w-[--radix-popover-trigger-width] border-none bg-transparent p-0 shadow-none'
          side='bottom'
          align='start'
          sideOffset={4}
        >
          <CommandList className='rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in'>
            {remaining.filter((o) =>
              o.label.toLowerCase().includes(search.toLowerCase())
            ).length === 0 ? (
              <p className='p-2 text-center text-lg leading-10 text-gray-600 dark:text-gray-400'>
                未找到可用的ALPN协议
              </p>
            ) : (
              <CommandGroup className='h-full overflow-auto'>
                {remaining
                  .filter((o) =>
                    o.label.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((o) => (
                    <CommandItem
                      key={o.value}
                      value={o.value}
                      className='cursor-pointer'
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onSelect={() => {
                        setSearch('')
                        onChange([...value, o.value])
                      }}
                    >
                      {o.label}
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  )
}

/** mieru 流量模式生成（对齐原版 protobuf varint + base64 算法）。 */
function generateMieruPattern(): string {
  const a = Math.floor(101 * Math.random()) + 100
  const b = Math.floor(201 * Math.random()) + 400
  const varint = (n: number) => {
    const out: number[] = []
    while (n >= 128) {
      out.push((n & 127) | 128)
      n >>>= 7
    }
    out.push(n)
    return out
  }
  const inner = [8, ...varint(a), 16, ...varint(b)]
  const bytes = new Uint8Array([10, ...varint(inner.length), ...inner])
  let s = ''
  bytes.forEach((x) => (s += String.fromCharCode(x)))
  return window.btoa(s)
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
  obj: (path: string) => Dict | null
  set: (path: string, value: unknown) => void
  setPs: React.Dispatch<React.SetStateAction<Dict>>
  /** 协议卡片内嵌弹窗开合通知（主弹窗据此屏蔽误关闭）。 */
  onNestedDialog: (open: boolean) => void
}

function ProtocolFields(props: FieldProps) {
  const { type, str, num, bool, arr, lines, obj, set, setPs, onNestedDialog } =
    props
  switch (type) {
    case 'shadowsocks': {
      const plugin = str('plugin')
      const hasPlugin = !!plugin && plugin !== 'none'
      return (
        <>
          <Field label='加密算法' hint='选择预设加密方式或输入自定义加密方式'>
            <CipherCombobox
              value={str('cipher') || 'aes-128-gcm'}
              onChange={(v) => set('cipher', v)}
            />
          </Field>
          {/* 插件专属提示挂在插件下拉下方（对齐原版 plugin 字段 description） */}
          <Field label='插件' hint={hasPlugin ? SS_PLUGIN_HINTS[plugin] : undefined}>
            <Select
              value={plugin || 'none'}
              onValueChange={(v) => set('plugin', v === 'none' ? '' : v)}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
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
          {/* 插件选项仅在选择插件后显示，说明文字在输入框上方（对齐原版） */}
          {hasPlugin && (
            <div className='space-y-2'>
              <Label className='font-mono text-[12px] text-foreground/80'>
                插件选项
              </Label>
              <p className='font-mono text-[11px] text-muted-foreground opacity-70'>
                按照 key=value;key2=value2 格式输入插件选项
              </p>
              <Input
                value={str('plugin_opts')}
                onChange={(e) => set('plugin_opts', e.target.value)}
                placeholder='例如: mode=tls;host=bing.com'
                className='h-9 font-mono text-xs'
              />
            </div>
          )}
          {/* 客户端指纹仅 shadow-tls / restls 插件显示（对齐原版） */}
          {(plugin === 'shadow-tls' || plugin === 'restls') && (
            <Field label='客户端指纹' hint='客户端伪装指纹，用于降低被识别风险'>
              <Select
                value={str('client_fingerprint') || 'chrome'}
                onValueChange={(v) => set('client_fingerprint', v)}
              >
                <SelectTrigger className='h-9 w-full font-mono text-xs'>
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
          )}
        </>
      )
    }

    case 'vmess':
      return (
        <>
          <Field label='TLS'>
            <Select
              value={num('tls') || '0'}
              onValueChange={(v) => set('tls', Number(v))}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='请选择安全性' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='0'>None</SelectItem>
                <SelectItem value='1'>TLS</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {num('tls') === '1' && (
            <>
              <SniRow
                prefix='tls_settings'
                sniPlaceholder='不使用请留空'
                str={str}
                bool={bool}
                set={set}
              />
              <div className='mt-2 space-y-2'>
                <UtlsBlock str={str} bool={bool} set={set} />
                <EchBlock
                  prefix='tls_settings.ech'
                  str={str}
                  bool={bool}
                  set={set}
                />
              </div>
            </>
          )}
          <NetworkField
            options={VMESS_NETWORKS}
            obj={obj}
            str={str}
            set={set}
            setPs={setPs}
            onNestedDialog={onNestedDialog}
          />
        </>
      )

    case 'vless':
      return (
        <>
          <Field label='安全性'>
            <Select
              value={num('tls') || '0'}
              onValueChange={(v) => set('tls', Number(v))}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='请选择安全性' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='0'>无</SelectItem>
                <SelectItem value='1'>TLS</SelectItem>
                <SelectItem value='2'>Reality</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {num('tls') === '1' && (
            <>
              <SniRow
                prefix='tls_settings'
                sniPlaceholder='不使用请留空'
                str={str}
                bool={bool}
                set={set}
              />
              <div className='mt-2 space-y-2'>
                <UtlsBlock str={str} bool={bool} set={set} />
                <EchBlock
                  prefix='tls_settings.ech'
                  str={str}
                  bool={bool}
                  set={set}
                />
              </div>
            </>
          )}
          {num('tls') === '2' && (
            <>
              <RealityBlock variant='vless' str={str} bool={bool} set={set} />
              <div className='mt-2 space-y-2'>
                <UtlsBlock str={str} bool={bool} set={set} />
              </div>
            </>
          )}
          <NetworkField
            options={VLESS_NETWORKS}
            obj={obj}
            str={str}
            set={set}
            setPs={setPs}
            onNestedDialog={onNestedDialog}
          />
          <Field label='流控'>
            <Select
              value={str('flow') || 'none'}
              onValueChange={(v) => set('flow', v === 'none' ? null : v)}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='选择流控' />
              </SelectTrigger>
              <SelectContent>
                {VLESS_FLOWS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className='space-y-4 rounded-lg border bg-muted/10 p-4'>
            <div className='flex flex-row items-center justify-between'>
              <div className='space-y-0.5'>
                <Label className='font-mono text-[13px] font-bold'>
                  VLESS Encryption
                </Label>
                <p className='font-mono text-[11px] text-muted-foreground opacity-70'>
                  启用 VLESS 加密
                </p>
              </div>
              <Switch
                checked={bool('encryption.enabled')}
                onCheckedChange={(c) => set('encryption.enabled', c)}
              />
            </div>
            {bool('encryption.enabled') && (
              <div className='space-y-4 border-t border-dashed pt-2'>
                <div className='space-y-2'>
                  <Label className='font-mono text-[11px] text-foreground/60'>
                    decryption
                  </Label>
                  <Input
                    className='font-mono text-xs'
                    value={str('encryption.decryption')}
                    onChange={(e) =>
                      set('encryption.decryption', e.target.value)
                    }
                    placeholder='./xray vlessenc 生成'
                  />
                </div>
                <div className='space-y-2'>
                  <Label className='font-mono text-[11px] text-foreground/60'>
                    encryption
                  </Label>
                  <Input
                    className='font-mono text-xs'
                    value={str('encryption.encryption')}
                    onChange={(e) =>
                      set('encryption.encryption', e.target.value)
                    }
                    placeholder='./xray vlessenc 生成'
                  />
                </div>
                <p className='px-1 font-mono text-[10px] italic leading-relaxed text-primary/70'>
                  * ./xray vlessenc 生成
                </p>
              </div>
            )}
          </div>
        </>
      )

    case 'trojan':
      return (
        <>
          <Field label='安全性'>
            <Select
              value={num('tls') || '1'}
              onValueChange={(v) => set('tls', Number(v))}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='请选择安全性' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='1'>TLS</SelectItem>
                <SelectItem value='2'>Reality</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {num('tls') === '1' && (
            <SniRow
              prefix='tls_settings'
              sniPlaceholder='当节点地址于证书不一致时用于证书验证'
              str={str}
              bool={bool}
              set={set}
            />
          )}
          {num('tls') === '2' && (
            <RealityBlock variant='trojan' str={str} bool={bool} set={set} />
          )}
          <div className='mb-4 space-y-4'>
            <UtlsBlock str={str} bool={bool} set={set} />
            <EchBlock
              prefix='tls_settings.ech'
              str={str}
              bool={bool}
              set={set}
            />
          </div>
          <NetworkField
            options={VMESS_NETWORKS}
            obj={obj}
            str={str}
            set={set}
            setPs={setPs}
            onNestedDialog={onNestedDialog}
          />
        </>
      )

    case 'hysteria': {
      const isV2 = (num('version') || '2') === '2'
      return (
        <>
          <div className='flex gap-2'>
            <div className='flex-1 space-y-2'>
              <Label className='font-mono text-[12px] text-foreground/80'>
                协议版本
              </Label>
              <Select
                value={num('version') || '2'}
                onValueChange={(v) => set('version', Number(v))}
              >
                <SelectTrigger className='h-9 w-full font-mono text-xs'>
                  <SelectValue placeholder='协议版本' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='1' className='cursor-pointer'>
                    V1
                  </SelectItem>
                  <SelectItem value='2' className='cursor-pointer'>
                    V2
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {num('version') === '1' && (
              <div className='flex-[2] space-y-2'>
                <Label className='font-mono text-[12px] text-foreground/80'>
                  ALPN
                </Label>
                <Select
                  value={str('alpn') || 'h2'}
                  onValueChange={(v) => set('alpn', v)}
                >
                  <SelectTrigger className='h-9 w-full font-mono text-xs'>
                    <SelectValue placeholder='ALPN' />
                  </SelectTrigger>
                  <SelectContent>
                    {HYSTERIA_ALPN.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className='flex gap-2'>
            <div className='space-y-2'>
              <Label className='font-mono text-[12px] text-foreground/80'>
                混淆
              </Label>
              <div className='py-2 text-center'>
                <Switch
                  checked={bool('obfs.open')}
                  onCheckedChange={(c) => set('obfs.open', c)}
                />
              </div>
            </div>
            {bool('obfs.open') && (
              <>
                {isV2 && (
                  <div className='flex-1 space-y-2'>
                    <Label className='font-mono text-[12px] text-foreground/80'>
                      混淆实现
                    </Label>
                    <Select
                      value={str('obfs.type') || 'salamander'}
                      onValueChange={(v) => set('obfs.type', v)}
                    >
                      <SelectTrigger className='h-9 w-full font-mono text-xs'>
                        <SelectValue placeholder='选择混淆实现' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='salamander'>Salamander</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={isV2 ? 'w-full space-y-2' : 'flex-[2] space-y-2'}>
                  <Label className='font-mono text-[12px] text-foreground/80'>
                    混淆密码
                  </Label>
                  <div className='relative'>
                    <Input
                      className='pr-9 font-mono text-xs'
                      value={str('obfs.password')}
                      onChange={(e) => set('obfs.password', e.target.value)}
                      placeholder='请输入混淆密码'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='absolute right-0 top-0 h-full px-2 transition-transform duration-150 active:scale-90'
                      onClick={() => {
                        set('obfs.password', generateRandomPassword())
                        toast.success('混淆密码生成成功')
                      }}
                    >
                      <RefreshCw className='h-4 w-4 transition-transform duration-300 hover:rotate-180' />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          <SniRow
            prefix='tls'
            sniPlaceholder='当节点地址于证书不一致时用于证书验证'
            str={str}
            bool={bool}
            set={set}
          />
          <EchBlock prefix='tls.ech' str={str} bool={bool} set={set} />
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              上行宽带
            </Label>
            <div className='relative flex'>
              <Input
                type='number'
                className='rounded-br-none rounded-tr-none font-mono text-xs'
                value={num('bandwidth.up')}
                onChange={(e) => set('bandwidth.up', e.target.value)}
                placeholder={'请输入上行宽带' + (isV2 ? '，留空则使用BBR' : '')}
              />
              <div className='pointer-events-none z-[-1] flex items-center rounded-md rounded-bl-none rounded-tl-none border border-l-0 border-input px-3 shadow-sm'>
                <span className='text-gray-500'>Mbps</span>
              </div>
            </div>
          </div>
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              下行宽带
            </Label>
            <div className='relative flex'>
              <Input
                type='number'
                className='rounded-br-none rounded-tr-none font-mono text-xs'
                value={num('bandwidth.down')}
                onChange={(e) => set('bandwidth.down', e.target.value)}
                placeholder={'请输入下行宽带' + (isV2 ? '，留空则使用BBR' : '')}
              />
              <div className='pointer-events-none z-[-1] flex items-center rounded-md rounded-bl-none rounded-tl-none border border-l-0 border-input px-3 shadow-sm'>
                <span className='text-gray-500'>Mbps</span>
              </div>
            </div>
          </div>
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              Hop 间隔 (秒)
            </Label>
            <Input
              type='number'
              className='font-mono text-xs'
              value={num('hop_interval')}
              onChange={(e) =>
                set(
                  'hop_interval',
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
              placeholder='例如: 30'
            />
            <p className='font-mono text-[11px] text-muted-foreground opacity-70'>
              Hop 间隔时间，单位为秒
            </p>
          </div>
        </>
      )
    }

    case 'tuic':
      return (
        <>
          <Field label='协议版本'>
            <Select
              value={num('version') || '5'}
              onValueChange={(v) => set('version', Number(v))}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='选择TUIC版本' />
              </SelectTrigger>
              <SelectContent>
                {TUIC_VERSIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    V{v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='拥塞控制'>
            <Select
              value={str('congestion_control') || 'bbr'}
              onValueChange={(v) => set('congestion_control', v)}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='选择拥塞控制算法' />
              </SelectTrigger>
              <SelectContent>
                {TUIC_CONGESTION.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <SniRow
            prefix='tls'
            sniPlaceholder='当节点地址与证书不一致时用于证书验证'
            str={str}
            bool={bool}
            set={set}
          />
          <EchBlock prefix='tls.ech' str={str} bool={bool} set={set} />
          <Field label='ALPN'>
            <AlpnMultiSelect
              value={(() => {
                const v = arr('alpn')
                return v
                  ? v.split(',').map((s) => s.trim()).filter(Boolean)
                  : []
              })()}
              onChange={(next) => set('alpn', next)}
            />
          </Field>
          <Field label='UDP中继模式'>
            <Select
              value={str('udp_relay_mode') || 'native'}
              onValueChange={(v) => set('udp_relay_mode', v)}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='选择UDP中继模式' />
              </SelectTrigger>
              <SelectContent>
                {TUIC_UDP_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      )

    case 'mieru':
      return (
        <>
          <Field label='传输协议'>
            <Select
              value={str('transport') || 'TCP'}
              onValueChange={(v) => set('transport', v)}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='选择传输协议' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='TCP'>TCP</SelectItem>
                <SelectItem value='UDP'>UDP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className='space-y-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              流量 (Base64)
            </Label>
            <div className='flex gap-2'>
              <Input
                className='font-mono text-xs'
                value={str('traffic_pattern')}
                onChange={(e) => set('traffic_pattern', e.target.value)}
                placeholder='请输入 Base64 字符串用于微调网络行为'
              />
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='h-9 w-9 shrink-0'
                onClick={() => {
                  set('traffic_pattern', generateMieruPattern())
                  toast.success('流量模式已生成')
                }}
              >
                <RotateCw className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </>
      )

    case 'anytls':
      return (
        <>
          <SniRow
            prefix='tls'
            sniPlaceholder='当节点地址与证书不一致时用于证书验证'
            insecureLabel='允许不安全连接'
            str={str}
            bool={bool}
            set={set}
          />
          <EchBlock prefix='tls.ech' str={str} bool={bool} set={set} />
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label className='font-mono text-[12px] text-foreground/80'>
                填充方案
              </Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 px-2 text-[10px]'
                onClick={() =>
                  setPs((prev) =>
                    setPath(prev, 'padding_scheme', [...ANYTLS_DEFAULT_PADDING])
                  )
                }
              >
                使用默认方案
              </Button>
            </div>
            <div className='mb-1 font-mono text-[10px] text-muted-foreground'>
              用于混淆流量特征的填充方案，每行一条规则，支持通配符 *
            </div>
            <Textarea
              className='min-h-[120px] resize-y font-mono text-xs'
              value={lines('padding_scheme')}
              onChange={(e) =>
                set(
                  'padding_scheme',
                  e.target.value.split('\n').filter((l) => l.trim() !== '')
                )
              }
              placeholder='选择填充方案'
            />
          </div>
        </>
      )

    case 'socks':
      // 对齐原版：socks 无协议专属字段
      return null

    case 'naive':
    case 'http': {
      const isHttp = type === 'http'
      return (
        <>
          <Field label='TLS'>
            <Select
              value={num('tls') || '0'}
              onValueChange={(v) => set('tls', Number(v))}
            >
              <SelectTrigger className='h-9 w-full font-mono text-xs'>
                <SelectValue placeholder='请选择安全性' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='0'>不支持</SelectItem>
                <SelectItem value='1'>支持</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {num('tls') === '1' && (
            <>
              <SniRow
                prefix='tls_settings'
                sniPlaceholder={
                  isHttp ? '当节点地址与证书不一致时用于证书验证' : '不使用请留空'
                }
                insecureLabel={isHttp ? '允许不安全连接' : '允许不安全?'}
                str={str}
                bool={bool}
                set={set}
              />
              <EchBlock
                prefix='tls_settings.ech'
                str={str}
                bool={bool}
                set={set}
              />
            </>
          )}
        </>
      )
    }

    default:
      return null
  }
}

