import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { fetchServerGroups } from '@/features/server-group/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  SERVER_TYPE_LABEL,
  type Server,
  type ServerType,
  saveNode,
} from '../api'
import { EchGenerateDialog } from './ech-generate-dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: Server | null
}

/** 各协议的默认 protocol_settings（取自 Server::PROTOCOL_CONFIGURATIONS 的默认值）。 */
const PROTOCOL_DEFAULTS: Record<ServerType, Record<string, unknown>> = {
  shadowsocks: { cipher: 'aes-128-gcm' },
  vmess: { tls: 0, network: 'tcp' },
  vless: { tls: 0, network: 'tcp', flow: '' },
  trojan: { tls: 1, network: 'tcp', server_name: '' },
  hysteria: { version: 2, bandwidth: { up: null, down: null } },
  tuic: { version: 5, congestion_control: 'cubic', udp_relay_mode: 'native' },
  anytls: {},
  socks: { tls: 0 },
  naive: { tls: 1 },
  http: { tls: 1 },
  mieru: { transport: 'TCP', traffic_pattern: '' },
}

/** 是否为带 tls_settings.ech 的协议（vmess/vless/trojan/socks/naive/http）。 */
const TLS_SETTINGS_TYPES: ServerType[] = [
  'vmess',
  'vless',
  'trojan',
  'socks',
  'naive',
  'http',
]
/** 是否为带 tls.ech（对象式 tls）的协议（hysteria/tuic/anytls）。 */
const TLS_OBJECT_TYPES: ServerType[] = ['hysteria', 'tuic', 'anytls']

const SS_CIPHERS = [
  'aes-128-gcm',
  'aes-256-gcm',
  'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-chacha20-poly1305',
]

type BaseState = {
  type: ServerType
  name: string
  host: string
  port: string
  server_port: string
  rate: string
  show: boolean
  enabled: boolean
  parent_id: string
  group_ids: number[]
  tags: string
  transfer_enable: string
}

export function NodeMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()
  const [echOpen, setEchOpen] = useState(false)

  const { data: groups } = useQuery({
    queryKey: ['server-groups'],
    queryFn: fetchServerGroups,
    enabled: open,
  })

  const [base, setBase] = useState<BaseState>({
    type: 'shadowsocks',
    name: '',
    host: '',
    port: '',
    server_port: '',
    rate: '1',
    show: true,
    enabled: true,
    parent_id: '',
    group_ids: [],
    tags: '',
    transfer_enable: '',
  })
  /** protocol_settings 以 JSON 文本编辑，保证多协议字段无损提交。 */
  const [protocolJson, setProtocolJson] = useState('{}')

  useEffect(() => {
    if (!open) return
    if (current) {
      setBase({
        type: current.type,
        name: current.name ?? '',
        host: current.host ?? '',
        port: String(current.port ?? ''),
        server_port: String(current.server_port ?? ''),
        rate: String(current.rate ?? '1'),
        show: !!current.show,
        enabled: !!current.enabled,
        parent_id: current.parent_id != null ? String(current.parent_id) : '',
        group_ids: current.group_ids ?? [],
        tags: (current.tags ?? []).join(','),
        transfer_enable:
          current.transfer_enable != null
            ? String(current.transfer_enable)
            : '',
      })
      setProtocolJson(
        JSON.stringify(current.protocol_settings ?? {}, null, 2)
      )
    } else {
      setBase({
        type: 'shadowsocks',
        name: '',
        host: '',
        port: '',
        server_port: '',
        rate: '1',
        show: true,
        enabled: true,
        parent_id: '',
        group_ids: [],
        tags: '',
        transfer_enable: '',
      })
      setProtocolJson(JSON.stringify(PROTOCOL_DEFAULTS.shadowsocks, null, 2))
    }
  }, [open, current])

  // 切换类型时（仅新建）重置 protocol 默认值
  const onTypeChange = (type: ServerType) => {
    setBase((b) => ({ ...b, type }))
    if (!isEdit) {
      setProtocolJson(JSON.stringify(PROTOCOL_DEFAULTS[type] ?? {}, null, 2))
    }
  }

  const supportsEch = useMemo(
    () =>
      TLS_SETTINGS_TYPES.includes(base.type) ||
      TLS_OBJECT_TYPES.includes(base.type),
    [base.type]
  )

  const mutation = useMutation({
    mutationFn: () => {
      let protocol_settings: Record<string, unknown> = {}
      try {
        protocol_settings = protocolJson.trim()
          ? JSON.parse(protocolJson)
          : {}
      } catch {
        throw new Error('协议配置 JSON 格式错误')
      }
      return saveNode({
        id: current?.id,
        type: base.type,
        name: base.name,
        host: base.host,
        port: base.port,
        server_port: base.server_port,
        rate: base.rate,
        show: base.show ? 1 : 0,
        enabled: base.enabled,
        parent_id: base.parent_id ? Number(base.parent_id) : null,
        group_ids: base.group_ids,
        tags: base.tags
          ? base.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        transfer_enable: base.transfer_enable
          ? Number(base.transfer_enable)
          : null,
        protocol_settings,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['nodes'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const toggleGroup = (id: number, checked: boolean) => {
    setBase((b) => ({
      ...b,
      group_ids: checked
        ? [...b.group_ids, id]
        : b.group_ids.filter((g) => g !== id),
    }))
  }

  const handleEchGenerated = (r: { key: string; config: string }) => {
    // 将生成的 key/config 注入 protocol_settings 的对应 ech 节点
    try {
      const obj = protocolJson.trim() ? JSON.parse(protocolJson) : {}
      const ech = { enabled: true, key: r.key, config: r.config }
      if (TLS_SETTINGS_TYPES.includes(base.type)) {
        obj.tls_settings = { ...(obj.tls_settings ?? {}), ech }
      } else if (TLS_OBJECT_TYPES.includes(base.type)) {
        obj.tls = {
          ...(typeof obj.tls === 'object' && obj.tls ? obj.tls : {}),
          ech,
        }
      }
      setProtocolJson(JSON.stringify(obj, null, 2))
      toast.success('已回填 ECH 到协议配置')
    } catch {
      toast.error('协议配置 JSON 格式错误，无法回填')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑节点' : '新建节点'}</DialogTitle>
          <DialogDescription>
            基础字段对所有协议通用；协议配置（protocol_settings）按所选类型填写。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[65vh] pe-3'>
          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label>节点类型</Label>
              <Select
                value={base.type}
                onValueChange={(v) => onTypeChange(v as ServerType)}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SERVER_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEdit && (
                <p className='text-muted-foreground text-xs'>
                  编辑时不可修改协议类型。
                </p>
              )}
            </div>

            <div className='grid gap-2'>
              <Label>节点名称</Label>
              <Input
                value={base.name}
                onChange={(e) =>
                  setBase((b) => ({ ...b, name: e.target.value }))
                }
                placeholder='节点名称'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>主机地址 (host)</Label>
                <Input
                  value={base.host}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, host: e.target.value }))
                  }
                  placeholder='example.com'
                />
              </div>
              <div className='grid gap-2'>
                <Label>连接端口 (port)</Label>
                <Input
                  value={base.port}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, port: e.target.value }))
                  }
                  placeholder='如 443 或 1000-2000'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>后端服务端口 (server_port)</Label>
                <Input
                  value={base.server_port}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, server_port: e.target.value }))
                  }
                  placeholder='如 443'
                />
              </div>
              <div className='grid gap-2'>
                <Label>倍率 (rate)</Label>
                <Input
                  value={base.rate}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, rate: e.target.value }))
                  }
                  placeholder='1'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>父节点 ID（可选）</Label>
                <Input
                  value={base.parent_id}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, parent_id: e.target.value }))
                  }
                  placeholder='留空表示独立节点'
                />
              </div>
              <div className='grid gap-2'>
                <Label>流量上限（字节，0/空=不限）</Label>
                <Input
                  value={base.transfer_enable}
                  onChange={(e) =>
                    setBase((b) => ({
                      ...b,
                      transfer_enable: e.target.value,
                    }))
                  }
                  placeholder='留空表示不限制'
                />
              </div>
            </div>

            <div className='grid gap-2'>
              <Label>标签（逗号分隔）</Label>
              <Input
                value={base.tags}
                onChange={(e) =>
                  setBase((b) => ({ ...b, tags: e.target.value }))
                }
                placeholder='gaming,streaming'
              />
            </div>

            <div className='grid gap-2'>
              <Label>权限组</Label>
              <div className='flex flex-wrap gap-3 rounded-md border p-3'>
                {(groups ?? []).length === 0 ? (
                  <span className='text-muted-foreground text-sm'>
                    暂无权限组
                  </span>
                ) : (
                  (groups ?? []).map((g) => (
                    <label
                      key={g.id}
                      className='flex items-center gap-2 text-sm'
                    >
                      <Checkbox
                        checked={base.group_ids.includes(g.id)}
                        onCheckedChange={(c) => toggleGroup(g.id, !!c)}
                      />
                      {g.name}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className='flex gap-8'>
              <div className='flex items-center gap-2'>
                <Label>显示</Label>
                <Switch
                  checked={base.show}
                  onCheckedChange={(c) => setBase((b) => ({ ...b, show: c }))}
                />
              </div>
              <div className='flex items-center gap-2'>
                <Label>启用</Label>
                <Switch
                  checked={base.enabled}
                  onCheckedChange={(c) =>
                    setBase((b) => ({ ...b, enabled: c }))
                  }
                />
              </div>
            </div>

            {/* shadowsocks 提供加密方式快捷选择，回填到 JSON */}
            {base.type === 'shadowsocks' && (
              <div className='grid gap-2'>
                <Label>加密方式 (cipher) 快捷设置</Label>
                <Select
                  onValueChange={(cipher) => {
                    try {
                      const obj = protocolJson.trim()
                        ? JSON.parse(protocolJson)
                        : {}
                      obj.cipher = cipher
                      setProtocolJson(JSON.stringify(obj, null, 2))
                    } catch {
                      setProtocolJson(JSON.stringify({ cipher }, null, 2))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='选择加密方式后写入下方 JSON' />
                  </SelectTrigger>
                  <SelectContent>
                    {SS_CIPHERS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className='grid gap-2'>
              <div className='flex items-center justify-between'>
                <Label>协议配置 (protocol_settings)</Label>
                {supportsEch && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => setEchOpen(true)}
                  >
                    <KeyRound className='size-4' /> 生成 ECH
                  </Button>
                )}
              </div>
              <Textarea
                rows={10}
                className='font-mono text-xs'
                value={protocolJson}
                onChange={(e) => setProtocolJson(e.target.value)}
                placeholder='{}'
              />
              <p className='text-muted-foreground text-xs'>
                按所选协议填写。当前类型「{SERVER_TYPE_LABEL[base.type]}」
                {supportsEch ? '，支持 ECH（可点击右上按钮生成并回填）。' : '。'}
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
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
            保存
          </Button>
        </DialogFooter>
      </DialogContent>

      <EchGenerateDialog
        open={echOpen}
        onOpenChange={setEchOpen}
        onGenerated={handleEchGenerated}
      />
    </Dialog>
  )
}
