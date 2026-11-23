import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  configureManagedCertificate,
  fetchManagedCertificates,
  retryManagedCertificate,
  type ManagedCertificateDomain,
} from '../api'

const statusText = {
  pending: '等待检查',
  checking: '检查中',
  watching: '等待续签窗口',
  deployed: '面板配置已更新',
  empty: '等待匹配节点',
  failed: '检查失败',
}
const queryKey = ['managed-certificates']

function date(value: number | null, time = false) {
  if (!value) return '—'
  const d = new Date(value * 1000)
  return time ? d.toLocaleString('zh-CN') : d.toLocaleDateString('zh-CN')
}

function expiryLabel(expiresAt: number, now: number) {
  const seconds = expiresAt - now
  const days = Math.floor(seconds / 86400)
  const remaining =
    seconds <= 0
      ? '已过期'
      : days === 0
        ? '剩余不足 1 天'
        : '剩余 ' + days + ' 天'
  return date(expiresAt) + '（' + remaining + '）'
}

function DomainRow({
  row,
  configured,
  now,
}: {
  row: ManagedCertificateDomain
  configured: boolean
  now: number
}) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)
  const names = draft ?? row.additional_names.join(', ')
  const changed = draft !== null && draft !== row.additional_names.join(', ')
  const refresh = () => client.invalidateQueries({ queryKey })
  const save = useMutation({
    mutationFn: (enabled: boolean) =>
      configureManagedCertificate({
        domain: row.domain,
        enabled,
        additional_names: names.split(/[\s,，]+/).filter(Boolean),
      }),
    onSuccess: async () => {
      await refresh()
      setDraft(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const retry = useMutation({
    mutationFn: () => retryManagedCertificate(row.domain),
    onSuccess: async () => {
      await refresh()
      toast.success('已安排重新检查')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const unknownExpiry = row.nodes.filter(
    (node) => node.expires_at == null
  ).length
  const configuredCount = row.nodes.filter(
    (node) => node.matches_managed_certificate
  ).length
  return (
    <section className='space-y-2 rounded-md border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <p className='font-mono text-sm font-semibold break-all'>
            {row.domain}
          </p>
          <p className='text-xs text-muted-foreground'>
            {row.nodes.length} 个匹配节点
            {row.expires_at != null && (
              <> · 面板证书最早到期 {expiryLabel(row.expires_at, now)}</>
            )}
            {unknownExpiry > 0 && <> · {unknownExpiry} 个节点有效期未知</>}
          </p>
        </div>
        <Label className='flex shrink-0 items-center gap-2 text-xs'>
          自动托管
          <Switch
            aria-label={row.domain + ' 自动托管'}
            checked={row.enabled}
            disabled={
              save.isPending ||
              (!row.enabled && (!configured || !row.nodes.length))
            }
            onCheckedChange={(enabled) => save.mutate(enabled)}
          />
        </Label>
      </div>
      {row.enabled && (
        <p className='text-sm'>
          {statusText[row.status ?? 'pending']}
          {row.last_deployed_at != null && (
            <>
              {' '}
              · {configuredCount}/{row.nodes.length}{' '}
              个节点的面板配置使用托管证书
            </>
          )}
        </p>
      )}
      {row.enabled && row.last_error && (
        <div className='space-y-2'>
          <p
            role='alert'
            className='text-sm break-words whitespace-pre-wrap text-destructive'
          >
            {row.last_error}
          </p>
          {row.status === 'failed' && (
            <Button
              size='sm'
              variant='outline'
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              重新检查
            </Button>
          )}
        </div>
      )}
      <details className='text-xs'>
        <summary className='w-fit cursor-pointer text-muted-foreground'>
          配置与节点详情
        </summary>
        <div className='mt-3 space-y-3'>
          <Label className='grid gap-2'>
            附加证书域名（可选）
            <Input
              value={names}
              onChange={(e) => setDraft(e.target.value)}
              placeholder='多个域名用逗号分隔'
            />
          </Label>
          {row.enabled && changed && (
            <Button
              size='sm'
              disabled={save.isPending}
              onClick={() => save.mutate(true)}
            >
              保存域名
            </Button>
          )}
          {row.enabled && (
            <p className='text-muted-foreground'>
              上次检查 {date(row.last_check_at, true)} · 上次分发{' '}
              {date(row.last_deployed_at, true)} · 下次检查{' '}
              {row.next_check_at ? date(row.next_check_at, true) : '等待调度'}
            </p>
          )}
          <ul className='space-y-1'>
            {row.nodes.map((n) => (
              <li key={n.id} className='flex justify-between gap-3'>
                <span>
                  {n.name}{' '}
                  <span className='text-muted-foreground'>#{n.id}</span>
                </span>
                <span className='text-right'>
                  {n.expires_at != null
                    ? expiryLabel(n.expires_at, now)
                    : n.expiry_error === 'invalid'
                      ? '证书无法解析'
                      : '缺少证书'}
                  {n.matches_managed_certificate != null && (
                    <>
                      {' '}
                      ·{' '}
                      {n.matches_managed_certificate
                        ? '已配置托管证书'
                        : '与托管证书不同'}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  )
}

export function ManagedCertificatesDialog({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void
}) {
  const query = useQuery({
    queryKey,
    queryFn: fetchManagedCertificates,
    refetchInterval: 15000,
  })
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85dvh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>证书托管</DialogTitle>
          <DialogDescription>
            按 Cert Push 证书域名开启托管。面板通过 Cloudflare
            验证域名，到期前集中续签，并分发给同域名节点。
          </DialogDescription>
        </DialogHeader>
        {query.isPending && <p>正在读取证书域名…</p>}
        {query.isError && (
          <div role='alert' className='space-y-2'>
            <p>读取证书托管状态失败：{query.error.message}</p>
            <Button
              size='sm'
              variant='outline'
              onClick={() => void query.refetch()}
            >
              重新读取
            </Button>
          </div>
        )}
        {query.data && (
          <>
            {!query.data.cloudflare_configured && (
              <p className='text-sm'>
                请先在{' '}
                <Link className='underline' to='/server/dns'>
                  DNS 同步
                </Link>{' '}
                中配置有权编辑这些域名的 Cloudflare API Token。
              </p>
            )}
            {query.data.domains.length ? (
              query.data.domains.map((row) => (
                <DomainRow
                  key={row.domain}
                  row={row}
                  configured={query.data.cloudflare_configured}
                  now={query.data.server_time}
                />
              ))
            ) : (
              <p className='text-sm text-muted-foreground'>
                暂无使用 Cert Push 且已填写证书域名的节点。
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
