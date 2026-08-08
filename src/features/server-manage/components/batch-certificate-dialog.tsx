import { useMemo, useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  SERVER_TYPE_LABEL,
  type BatchUpdateCertificatePayload,
  type Server,
  type ServerType,
} from '../api'

type Scope = 'selected' | 'filtered' | 'all'

function normalizeDomain(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/\.+$/, '').toLowerCase()
    : ''
}

function isValidDomain(value: string, allowWildcard = false) {
  const domain = normalizeDomain(value)
  const hostname =
    allowWildcard && domain.startsWith('*.') ? domain.slice(2) : domain
  if (domain.includes('*') && !domain.startsWith('*.')) return false
  return (
    domain.length > 0 &&
    domain.length <= 253 &&
    hostname.length > 0 &&
    !hostname.includes('*') &&
    hostname
      .split('.')
      .every(
        (label) =>
          label.length > 0 &&
          label.length <= 63 &&
          /^[a-z0-9-]+$/i.test(label) &&
          !label.startsWith('-') &&
          !label.endsWith('-')
      )
  )
}

function getCertPushDomain(node: Server) {
  const config = node.cert_config
  if (!config || typeof config !== 'object') return ''
  const mode = config.cert_mode ?? config.mode
  const domain = normalizeDomain(config.domain)
  return mode === 'content' && isValidDomain(domain, true) ? domain : ''
}

function isCertPushNode(node: Server) {
  const config = node.cert_config
  return !!config && (config.cert_mode ?? config.mode) === 'content'
}

function getSniPath(type: ServerType) {
  return type === 'hysteria' || type === 'tuic' || type === 'anytls'
    ? ['tls', 'server_name']
    : ['tls_settings', 'server_name']
}

function getNodeSni(node: Server) {
  const settings = node.protocol_settings
  if (!settings || typeof settings !== 'object') return ''
  const [group, field] = getSniPath(node.type)
  const nested = settings[group]
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return ''
  const value = (nested as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : ''
}

function usesSniAsEchQueryDomain(node: Server) {
  const settings = node.protocol_settings
  if (!settings || typeof settings !== 'object') return false
  const [group] = getSniPath(node.type)
  const tlsSettings = settings[group]
  if (
    !tlsSettings ||
    typeof tlsSettings !== 'object' ||
    Array.isArray(tlsSettings)
  )
    return false
  const ech = (tlsSettings as Record<string, unknown>).ech
  if (!ech || typeof ech !== 'object' || Array.isArray(ech)) return false
  const echSettings = ech as Record<string, unknown>
  const enabled =
    echSettings.enabled === true ||
    echSettings.enabled === 1 ||
    echSettings.enabled === '1'
  const queryServerName = echSettings.query_server_name
  return (
    enabled &&
    (typeof queryServerName !== 'string' || queryServerName.trim() === '')
  )
}

function getNodesForScope(
  scope: Scope | null,
  nodes: Server[],
  filteredIds: number[],
  selectedIds: number[]
) {
  if (scope === null) return []
  if (scope === 'all') return nodes
  const ids = new Set(scope === 'selected' ? selectedIds : filteredIds)
  return nodes.filter((node) => ids.has(node.id))
}

function looksLikeCertificate(value: string) {
  return /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(
    value.trim()
  )
}

function looksLikePrivateKey(value: string) {
  return /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC )?PRIVATE KEY-----/.test(
    value.trim()
  )
}

export function BatchCertificateDialog({
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
  onConfirm: (payload: BatchUpdateCertificatePayload) => void
}) {
  const [scope, setScope] = useState<Scope | null>(null)
  const [sourceDomain, setSourceDomain] = useState('')
  const [targetDomain, setTargetDomain] = useState('')
  const [updateSni, setUpdateSni] = useState(false)
  const [sni, setSni] = useState('')
  const [certContent, setCertContent] = useState('')
  const [keyContent, setKeyContent] = useState('')
  const [fileError, setFileError] = useState('')

  const scopedNodes = useMemo(
    () => getNodesForScope(scope, nodes, filteredIds, selectedIds),
    [scope, nodes, selectedIds, filteredIds]
  )
  const contentNodes = useMemo(
    () => scopedNodes.filter(isCertPushNode),
    [scopedNodes]
  )
  const eligibleNodes = useMemo(
    () => contentNodes.filter((node) => getCertPushDomain(node) !== ''),
    [contentNodes]
  )
  const domainOptions = useMemo(() => {
    const groups = new Map<
      string,
      { count: number; types: Partial<Record<ServerType, number>> }
    >()
    eligibleNodes.forEach((node) => {
      const domain = getCertPushDomain(node)
      const group = groups.get(domain) ?? { count: 0, types: {} }
      group.count++
      group.types[node.type] = (group.types[node.type] ?? 0) + 1
      groups.set(domain, group)
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [eligibleNodes])
  const matchingNodes = useMemo(
    () =>
      eligibleNodes.filter((node) => getCertPushDomain(node) === sourceDomain),
    [eligibleNodes, sourceDomain]
  )
  const sniChanges = useMemo(() => {
    if (!updateSni || !isValidDomain(sni)) return []
    const nextSni = normalizeDomain(sni)
    return matchingNodes
      .map((node) => ({ node, current: getNodeSni(node) }))
      .filter(({ current }) => current !== nextSni)
  }, [matchingNodes, sni, updateSni])
  const sniChangeSummary = useMemo(() => {
    const groups = new Map<string, number>()
    sniChanges.forEach(({ node, current }) => {
      const label = current.trim() || `空（回退 ${node.host}）`
      groups.set(label, (groups.get(label) ?? 0) + 1)
    })
    const entries = Array.from(groups.entries())
    const visible = entries
      .slice(0, 6)
      .map(([value, count]) => `${value}${count > 1 ? ` ×${count}` : ''}`)
      .join(' / ')
    return entries.length > 6
      ? `${visible} / 另 ${entries.length - 6} 种`
      : visible
  }, [sniChanges])
  const echQueryDomainChanges = useMemo(
    () => sniChanges.filter(({ node }) => usesSniAsEchQueryDomain(node)),
    [sniChanges]
  )
  const echQueryDomainSummary = useMemo(() => {
    const groups = new Map<string, number>()
    echQueryDomainChanges.forEach(({ node, current }) => {
      const domain = current.trim() || node.host
      groups.set(domain, (groups.get(domain) ?? 0) + 1)
    })
    const entries = Array.from(groups.entries())
    const visible = entries
      .slice(0, 6)
      .map(([value, count]) => `${value}${count > 1 ? ` ×${count}` : ''}`)
      .join(' / ')
    return entries.length > 6
      ? `${visible} / 另 ${entries.length - 6} 种`
      : visible
  }, [echQueryDomainChanges])

  const certificateValid = looksLikeCertificate(certContent)
  const privateKeyValid = looksLikePrivateKey(keyContent)
  const targetDomainValid = isValidDomain(targetDomain, true)
  const sniValid = !updateSni || isValidDomain(sni)
  const canSubmit =
    scope !== null &&
    sourceDomain !== '' &&
    targetDomainValid &&
    sniValid &&
    matchingNodes.length > 0 &&
    matchingNodes.length <= 500 &&
    certificateValid &&
    privateKeyValid

  const chooseScope = (nextScope: Scope) => {
    setScope(nextScope)
    const domains = Array.from(
      new Set(
        getNodesForScope(nextScope, nodes, filteredIds, selectedIds)
          .map(getCertPushDomain)
          .filter(Boolean)
      )
    )
    const domain = domains.length === 1 ? domains[0] : ''
    setSourceDomain(domain)
    setTargetDomain(domain)
    setSni('')
  }

  const chooseSourceDomain = (domain: string) => {
    setSourceDomain(domain)
    setTargetDomain(domain)
    setSni('')
  }

  const changeTargetDomain = (domain: string) => {
    setTargetDomain(domain)
  }

  const readPemFile = async (
    file: File | undefined,
    kind: 'certificate' | 'key'
  ) => {
    if (!file) return
    const maxBytes = kind === 'certificate' ? 131072 : 65536
    if (file.size > maxBytes) {
      setFileError(
        `${kind === 'certificate' ? '证书' : '私钥'}文件过大，最大 ${maxBytes / 1024} KB`
      )
      return
    }
    try {
      const content = await file.text()
      if (kind === 'certificate') setCertContent(content)
      else setKeyContent(content)
      setFileError('')
    } catch {
      setFileError('无法读取 PEM 文件，请改为粘贴内容')
    }
  }

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm({
      ids: matchingNodes.map((node) => node.id),
      match_domain: sourceDomain,
      target_domain: normalizeDomain(targetDomain),
      update_sni: updateSni,
      ...(updateSni ? { sni: normalizeDomain(sni) } : {}),
      cert_content: certContent.trim(),
      key_content: keyContent.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ShieldCheck className='size-5' />
            批量更新 Cert Push 证书
          </DialogTitle>
          <DialogDescription>
            一次更新同一当前域名下所有 content (Cert Push)
            节点的证书与证书域名；SNI 仅在明确勾选后更新。
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
                  onClick={() => chooseScope(value)}
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
          </div>

          <div className='space-y-2'>
            <Label>当前证书域名（匹配条件）</Label>
            <Select
              value={sourceDomain}
              onValueChange={chooseSourceDomain}
              disabled={scope === null || domainOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    scope === null ? '请先选择作用范围' : '选择要更新的证书域名'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {domainOptions.map(([domain, counts]) => (
                  <SelectItem key={domain} value={domain}>
                    {domain} — {counts.count} 个（
                    {Object.entries(counts.types)
                      .map(
                        ([type, count]) =>
                          `${SERVER_TYPE_LABEL[type as ServerType] ?? type} ${count}`
                      )
                      .join(' / ')}
                    ）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              域名来自节点现有的
              cert_config.domain，大小写和末尾的点会被规范化比较。
            </p>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='batch-cert-target-domain'>替换后的证书域名</Label>
              <Input
                id='batch-cert-target-domain'
                value={targetDomain}
                onChange={(event) => changeTargetDomain(event.target.value)}
                placeholder='例如 cert.example.com'
              />
              <p className='text-xs text-muted-foreground'>
                将写入所有匹配节点的 cert_config.domain。
              </p>
            </div>
            <div className='space-y-2 rounded-md border p-3'>
              <div className='flex items-start gap-2'>
                <Checkbox
                  id='batch-cert-update-sni'
                  checked={updateSni}
                  onCheckedChange={(checked) => {
                    setUpdateSni(checked === true)
                    if (checked !== true) setSni('')
                  }}
                />
                <Label
                  htmlFor='batch-cert-update-sni'
                  className='cursor-pointer leading-4'
                >
                  同时替换服务器名称指示（SNI）
                </Label>
              </div>
              {updateSni ? (
                <div className='space-y-1.5'>
                  <Input
                    aria-label='替换后的 SNI'
                    value={sni}
                    onChange={(event) => setSni(event.target.value)}
                    placeholder='必须填写具体主机名，不能使用通配符'
                  />
                  <p className='text-xs text-destructive'>
                    勾选后会统一覆盖匹配节点原有的 SNI，请先核对下方变更预览。
                  </p>
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>
                  默认保留每个节点现有 SNI；空 SNI 会按节点 host
                  回退校验，新证书不覆盖时整批拒绝。
                </p>
              )}
            </div>
          </div>

          {updateSni && sniValid && matchingNodes.length > 0 && (
            <Alert variant='destructive'>
              <AlertTriangle className='size-4' />
              <AlertTitle>
                将覆盖 {sniChanges.length} 个节点的订阅 SNI
              </AlertTitle>
              <AlertDescription>
                <p>
                  原值：{sniChangeSummary || '全部已经相同'}；新值：
                  {normalizeDomain(sni)}。
                </p>
                <p>
                  该变更会直接影响 Clash、Stash、Loon、sing-box 等订阅内容。
                </p>
              </AlertDescription>
            </Alert>
          )}

          {echQueryDomainChanges.length > 0 && (
            <Alert variant='destructive'>
              <AlertTriangle className='size-4' />
              <AlertTitle>
                其中 {echQueryDomainChanges.length} 个节点的 ECH
                查询域名也会变化
              </AlertTitle>
              <AlertDescription>
                <p>
                  这些节点已启用 ECH 且 query_server_name 为空，查询域名会从{' '}
                  {echQueryDomainSummary} 跟随 SNI 改为 {normalizeDomain(sni)}。
                </p>
                <p>
                  如果新域名没有对应的 HTTPS/SVCB ECH 记录，ECH
                  会静默失效。请先配置记录，或为节点显式设置 query_server_name。
                </p>
              </AlertDescription>
            </Alert>
          )}

          {targetDomain && !targetDomainValid && (
            <p className='text-sm text-destructive'>
              替换后的证书域名格式无效。
            </p>
          )}
          {updateSni && sni && !sniValid && (
            <p className='text-sm text-destructive'>SNI 域名格式无效。</p>
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor='batch-cert-content'>证书内容</Label>
                <Input
                  type='file'
                  accept='.pem,.crt,.cer'
                  className='h-8 w-52 text-xs file:mr-2'
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    void readPemFile(file, 'certificate')
                  }}
                />
              </div>
              <Textarea
                id='batch-cert-content'
                className='min-h-48 font-mono text-xs'
                value={certContent}
                onChange={(event) => setCertContent(event.target.value)}
                placeholder='-----BEGIN CERTIFICATE-----'
                spellCheck={false}
              />
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor='batch-key-content'>密钥内容</Label>
                <Input
                  type='file'
                  accept='.pem,.key'
                  className='h-8 w-52 text-xs file:mr-2'
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    void readPemFile(file, 'key')
                  }}
                />
              </div>
              <Textarea
                id='batch-key-content'
                className='min-h-48 font-mono text-xs'
                value={keyContent}
                onChange={(event) => setKeyContent(event.target.value)}
                placeholder='-----BEGIN PRIVATE KEY-----'
                spellCheck={false}
              />
            </div>
          </div>

          {fileError && <p className='text-sm text-destructive'>{fileError}</p>}
          {certContent && !certificateValid && (
            <p className='text-sm text-destructive'>
              证书内容不是 PEM 证书格式。
            </p>
          )}
          {keyContent && !privateKeyValid && (
            <p className='text-sm text-destructive'>
              私钥内容不是 PEM 私钥格式。
            </p>
          )}

          <Alert
            variant={canSubmit ? 'default' : 'destructive'}
            className={canSubmit ? 'border-emerald-500/40' : undefined}
          >
            <AlertTriangle className='size-4' />
            <AlertTitle>安全校验与变更预览</AlertTitle>
            <AlertDescription>
              {scope === null ? (
                <p>尚未选择作用范围。</p>
              ) : domainOptions.length === 0 ? (
                <p>该范围没有 Trojan/AnyTLS 的 Cert Push 节点。</p>
              ) : sourceDomain === '' ? (
                <p>请选择一个证书域名；不同域名不会在同一批次中更新。</p>
              ) : !targetDomainValid || !sniValid ? (
                <p>请填写有效的新证书域名和 SNI。</p>
              ) : (
                <p>
                  作用范围 {scopedNodes.length} 个：content 模式{' '}
                  {contentNodes.length} 个，当前域名匹配 {matchingNodes.length}{' '}
                  个。证书域名 {sourceDomain} → {normalizeDomain(targetDomain)}
                  {updateSni
                    ? `，${sniChanges.length} 个 SNI → ${normalizeDomain(sni)}`
                    : '，保留现有 SNI'}
                  {echQueryDomainChanges.length > 0
                    ? `；其中 ${echQueryDomainChanges.length} 个节点的 ECH 查询域名会随 SNI 变化`
                    : ''}
                  。排除：非 content 模式{' '}
                  {scopedNodes.length - contentNodes.length} 个、content
                  域名缺失或无效 {contentNodes.length - eligibleNodes.length}{' '}
                  个、其他证书域名 {eligibleNodes.length - matchingNodes.length}{' '}
                  个。
                </p>
              )}
              <p>
                提交后服务端会解析证书 SAN/CN，确认覆盖新证书域名和
                SNI、证书当前有效且私钥匹配；任一校验失败时整批不更新。
              </p>
              {matchingNodes.length > 500 && (
                <p>单次最多更新 500 个节点，请缩小范围后分批操作。</p>
              )}
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
            {isLoading
              ? '校验并更新中...'
              : `校验并更新 ${matchingNodes.length} 个节点`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
