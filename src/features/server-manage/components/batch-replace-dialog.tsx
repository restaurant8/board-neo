import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  type BatchReplaceField,
  type BatchReplaceNodesPayload,
  type Server,
} from '../api'

type Scope = 'selected' | 'filtered' | 'all'

const FIELD_OPTIONS: Array<{
  value: BatchReplaceField
  label: string
  placeholder: string
  description: string
}> = [
  {
    value: 'host',
    label: '节点地址',
    placeholder: '例如 a.baidu.com',
    description: '支持域名、IPv4 或 IPv6 地址',
  },
  {
    value: 'port',
    label: '连接端口',
    placeholder: '例如 443',
    description: '支持单端口或端口范围，例如 1000-2000',
  },
  {
    value: 'server_port',
    label: '服务端口',
    placeholder: '例如 443',
    description: '节点程序实际监听的内部端口',
  },
]

function isValidPort(value: string, allowRange: boolean) {
  const match = value.match(
    allowRange ? /^(\d{1,5})(?:-(\d{1,5}))?$/ : /^(\d{1,5})$/
  )
  if (!match) return false
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : start
  return start >= 1 && start <= 65535 && end >= start && end <= 65535
}

function isValidHost(value: string) {
  if (!value || value.length > 253 || /\s|\/|@/.test(value)) return false

  const ipv4Parts = value.split('.')
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d+$/.test(part))) {
    return ipv4Parts.every((part) => {
      const number = Number(part)
      return number >= 0 && number <= 255 && String(number) === part
    })
  }

  if (value.includes(':')) {
    try {
      new URL(`http://[${value}]/`)
      return true
    } catch {
      return false
    }
  }

  return value
    .split('.')
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9-]+$/i.test(label) &&
        !label.startsWith('-') &&
        !label.endsWith('-')
    )
}

export function BatchReplaceDialog({
  open,
  onOpenChange,
  nodes,
  filteredIds,
  selectedIds,
  isLoading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: Server[]
  filteredIds: number[]
  selectedIds: number[]
  isLoading: boolean
  onConfirm: (payload: BatchReplaceNodesPayload) => void
}) {
  const [scope, setScope] = useState<Scope | null>(null)
  const [field, setField] = useState<BatchReplaceField>('host')
  const [originalValue, setOriginalValue] = useState('')
  const [replacementValue, setReplacementValue] = useState('')
  const [updateRelatedHostFields, setUpdateRelatedHostFields] = useState(true)

  const scopedNodes = useMemo(() => {
    if (scope === null) return []
    if (scope === 'all') return nodes
    const ids =
      scope === 'selected' ? new Set(selectedIds) : new Set(filteredIds)
    return nodes.filter((node) => ids.has(node.id))
  }, [scope, selectedIds, filteredIds, nodes])

  const normalizedOriginal = originalValue.trim()
  const normalizedReplacement = replacementValue.trim()
  const matchingNodes = useMemo(
    () =>
      normalizedOriginal
        ? scopedNodes.filter(
            (node) => String(node[field] ?? '') === normalizedOriginal
          )
        : scopedNodes,
    [scopedNodes, field, normalizedOriginal]
  )
  const changedCount = matchingNodes.filter(
    (node) => String(node[field] ?? '') !== normalizedReplacement
  ).length

  const portValid =
    field === 'host' ||
    ((!normalizedOriginal ||
      isValidPort(normalizedOriginal, field === 'port')) &&
      (!normalizedReplacement ||
        isValidPort(normalizedReplacement, field === 'port')))
  const hostValid =
    field !== 'host' ||
    ((!normalizedOriginal || isValidHost(normalizedOriginal)) &&
      (!normalizedReplacement || isValidHost(normalizedReplacement)))
  const canSubmit =
    scope !== null &&
    scopedNodes.length > 0 &&
    scopedNodes.length <= 500 &&
    normalizedReplacement !== '' &&
    portValid &&
    hostValid &&
    matchingNodes.length > 0 &&
    changedCount > 0
  const activeField = FIELD_OPTIONS.find((option) => option.value === field)!

  const handleConfirm = () => {
    if (!canSubmit) return
    const value =
      field === 'server_port'
        ? Number(normalizedReplacement)
        : normalizedReplacement
    const original =
      field === 'server_port' ? Number(normalizedOriginal) : normalizedOriginal

    onConfirm({
      ids: scopedNodes.map((node) => node.id),
      updates: { [field]: value },
      ...(normalizedOriginal ? { matches: { [field]: original } } : {}),
      ...(field === 'host'
        ? { update_related_host_fields: updateRelatedHostFields }
        : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>批量替换节点地址或端口</DialogTitle>
          <DialogDescription>
            选择作用范围和字段，可按原值精确匹配，也可直接统一设置。
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-5'>
          <div className='space-y-2'>
            <Label>作用范围</Label>
            <div className='grid grid-cols-3 gap-2'>
              {(
                [
                  ['selected', `已选 ${selectedIds.length} 个`],
                  ['filtered', `筛选结果 ${filteredIds.length} 个`],
                  ['all', `全部 ${nodes.length} 个`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type='button'
                  disabled={
                    (value === 'selected' && selectedIds.length === 0) ||
                    (value === 'filtered' && filteredIds.length === 0)
                  }
                  onClick={() => setScope(value)}
                  className={cn(
                    'rounded-md border px-2 py-2 text-sm font-medium transition-colors',
                    scope === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted',
                    'disabled:cursor-not-allowed disabled:opacity-40'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {scope === null && (
              <p className='text-xs text-amber-600 dark:text-amber-500'>
                为避免误操作，请先明确选择本次替换的作用范围。
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label>替换字段</Label>
            <div className='grid grid-cols-3 gap-2'>
              {FIELD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => {
                    setField(option.value)
                    setOriginalValue('')
                    setReplacementValue('')
                  }}
                  className={cn(
                    'rounded-md border px-2 py-2 text-sm font-medium transition-colors',
                    field === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='batch-replace-original'>原值（可留空）</Label>
              <Input
                id='batch-replace-original'
                value={originalValue}
                onChange={(event) => setOriginalValue(event.target.value)}
                placeholder={activeField.placeholder}
              />
              <p className='text-xs text-muted-foreground'>
                留空时将直接修改范围内的全部节点
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='batch-replace-next'>替换为</Label>
              <Input
                id='batch-replace-next'
                value={replacementValue}
                onChange={(event) => setReplacementValue(event.target.value)}
                placeholder={activeField.placeholder}
              />
              <p className='text-xs text-muted-foreground'>
                {activeField.description}
              </p>
            </div>
          </div>

          {!portValid && (
            <p className='text-sm text-destructive'>
              请输入 1-65535 的有效端口
              {field === 'port' ? '或端口范围' : ''}。
            </p>
          )}
          {!hostValid && (
            <p className='text-sm text-destructive'>
              请输入有效的域名、IPv4 或 IPv6 地址，不要包含协议、端口或路径。
            </p>
          )}

          {field === 'host' && (
            <div className='space-y-2 rounded-md border p-3'>
              <div className='flex items-start gap-2'>
                <Checkbox
                  id='batch-replace-related-hosts'
                  checked={updateRelatedHostFields}
                  onCheckedChange={(checked) =>
                    setUpdateRelatedHostFields(checked === true)
                  }
                />
                <div className='space-y-1'>
                  <Label
                    htmlFor='batch-replace-related-hosts'
                    className='cursor-pointer'
                  >
                    同时替换关联的 TLS SNI 和混淆域名
                  </Label>
                  <p className='text-xs text-muted-foreground'>
                    仅替换当前值与旧节点地址相同的 server_name / obfs
                    host；Reality 伪装域名不会自动修改。
                  </p>
                </div>
              </div>
              {!updateRelatedHostFields && (
                <p className='text-xs text-amber-600 dark:text-amber-500'>
                  仅替换节点地址，TLS SNI 和伪装域名需另行检查。
                </p>
              )}
            </div>
          )}

          <Alert
            variant={
              scope !== null && changedCount > 0 && scopedNodes.length <= 500
                ? 'default'
                : 'destructive'
            }
          >
            <AlertTriangle className='size-4' />
            <AlertTitle>变更预览</AlertTitle>
            <AlertDescription>
              {scope === null
                ? '尚未选择作用范围。'
                : `作用范围 ${scopedNodes.length} 个，匹配 ${matchingNodes.length} 个，实际将修改 ${changedCount} 个节点。`}
              {normalizedOriginal === '' && scopedNodes.length > 0
                ? ' 当前未填写原值，将统一覆盖所选范围。'
                : ''}
              {scopedNodes.length > 500
                ? ' 单次最多处理 500 个节点，请缩小筛选范围或分批选择。'
                : ''}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button disabled={!canSubmit || isLoading} onClick={handleConfirm}>
            {isLoading ? '替换中...' : `确认替换 ${changedCount} 个节点`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
