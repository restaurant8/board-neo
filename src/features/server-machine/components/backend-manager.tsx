import { useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ExternalLink, RefreshCw, RotateCw, ArrowUpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Backend,
  type UpgradeStatus,
  type UpgradeTarget,
  fetchBackends,
  fetchLatestVersion,
  restartBackends,
  upgradeBackends,
} from '../api'

const POLL_INTERVAL = 3000
// 下发后超过该秒数仍停留在 dispatched 即视为超时未响应。
const DISPATCH_TIMEOUT = 120

function backendKey(b: Pick<Backend, 'type' | 'id'>) {
  return `${b.type}:${b.id}`
}

function fmtTime(ts: number | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function normVer(v: string | null | undefined) {
  return String(v ?? '').trim().replace(/^v/i, '')
}
function cmpVer(a: string, b: string) {
  const pa = normVer(a).split('.')
  const pb = normVer(b).split('.')
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const x = parseInt(pa[i], 10) || 0
    const y = parseInt(pb[i], 10) || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

function UpgradeStatusCell({ upgrade }: { upgrade: UpgradeStatus }) {
  if (!upgrade || !upgrade.status)
    return <span className='text-muted-foreground'>—</span>
  const now = Date.now() / 1000
  switch (upgrade.status) {
    case 'dispatched':
      if (upgrade.updated_at && now - upgrade.updated_at > DISPATCH_TIMEOUT) {
        return (
          <span
            className='text-destructive'
            title={`命令已下发但后端进程未在 ${DISPATCH_TIMEOUT} 秒内响应，请确认节点在线且已升级到支持自更新的版本。`}
          >
            下发超时·未响应
          </span>
        )
      }
      return <span className='text-amber-600'>已下发…</span>
    case 'started':
      return <span className='text-amber-600'>升级中…</span>
    case 'restarting':
      // 重启没有「完成」回执（进程退出了），超过 30 秒视为已重启。
      if (upgrade.updated_at && now - upgrade.updated_at > 30) {
        return <span className='text-emerald-600'>已重启</span>
      }
      return <span className='text-amber-600'>重启中…</span>
    case 'success':
      return (
        <span className='text-emerald-600'>成功 {upgrade.to_version || ''}</span>
      )
    case 'skipped':
      return <span className='text-muted-foreground'>已是最新</span>
    case 'failed':
      return (
        <span className='text-destructive' title={upgrade.error || ''}>
          失败
        </span>
      )
    default:
      return <span>{upgrade.status}</span>
  }
}

export function BackendManager() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloadBase, setDownloadBase] = useState('')
  const [baseTouched, setBaseTouched] = useState(false)
  const [confirmUpgrade, setConfirmUpgrade] = useState<Backend[] | null>(null)
  const [confirmRestart, setConfirmRestart] = useState<Backend[] | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['backends'],
    queryFn: fetchBackends,
    // 升级/重启进行时持续刷新，让基于时间的"超时"标记可以显现。
    refetchInterval: (query) => {
      const list = query.state.data?.backends ?? []
      const pending = list.some((b) =>
        ['dispatched', 'started', 'restarting'].includes(b.upgrade?.status ?? '')
      )
      return pending ? POLL_INTERVAL : false
    },
  })

  // 版本对比是附加信息，单独拉取且失败静默。
  const { data: latest } = useQuery({
    queryKey: ['backend-latest-version'],
    queryFn: fetchLatestVersion,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const backends = data?.backends ?? []
  const effectiveBase = baseTouched ? downloadBase : data?.download_base ?? ''
  const latestVersion = latest?.latest?.version ?? ''

  const upgradeMutation = useMutation({
    mutationFn: (targets: UpgradeTarget[]) =>
      upgradeBackends({
        targets,
        version: 'latest',
        download_base: effectiveBase.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('已下发升级')
      queryClient.invalidateQueries({ queryKey: ['backends'] })
      setSelected(new Set())
      setConfirmUpgrade(null)
    },
    onError: handleServerError,
  })

  const restartMutation = useMutation({
    mutationFn: (targets: UpgradeTarget[]) => restartBackends({ targets }),
    onSuccess: () => {
      toast.success('已下发重启')
      queryClient.invalidateQueries({ queryKey: ['backends'] })
      setSelected(new Set())
      setConfirmRestart(null)
    },
    onError: handleServerError,
  })

  const onlineKeys = useMemo(
    () => backends.filter((b) => b.online).map(backendKey),
    [backends]
  )
  const allOnlineSelected =
    onlineKeys.length > 0 && onlineKeys.every((k) => selected.has(k))

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectedBackends() {
    return backends.filter((b) => selected.has(backendKey(b)))
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          升级以「后端进程」为单位下发：同一台机器下的多个节点只会升级一次。
          {latestVersion ? (
            <>
              {' '}
              最新发布版本：
              {latest?.latest?.html_url ? (
                <a
                  href={latest.latest.html_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 underline'
                >
                  {latestVersion}
                  <ExternalLink className='size-3' />
                </a>
              ) : (
                latestVersion
              )}
            </>
          ) : null}
        </p>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className='size-4' /> 刷新
          </Button>
          <Button
            size='sm'
            disabled={selected.size === 0 || upgradeMutation.isPending}
            onClick={() => {
              const sel = selectedBackends()
              if (!sel.length) return
              setConfirmUpgrade(sel)
            }}
          >
            <ArrowUpCircle className='size-4' /> 升级所选
          </Button>
        </div>
      </div>

      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>
                <Checkbox
                  checked={allOnlineSelected}
                  onCheckedChange={(v) =>
                    setSelected(v ? new Set(onlineKeys) : new Set())
                  }
                  aria-label='全选'
                />
              </TableHead>
              <TableHead>后端</TableHead>
              <TableHead className='w-40'>地址/IP</TableHead>
              <TableHead className='w-20'>状态</TableHead>
              <TableHead className='w-36'>版本</TableHead>
              <TableHead className='w-32'>内核/架构</TableHead>
              <TableHead className='w-44'>最后心跳</TableHead>
              <TableHead className='w-28'>升级状态</TableHead>
              <TableHead className='w-32 text-end'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : isError ? (
              (() => {
                const status = (
                  error as { response?: { status?: number } } | null
                )?.response?.status
                const unavailable = status === 404 || status === 403
                return (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className={
                        'h-24 text-center ' +
                        (unavailable
                          ? 'text-muted-foreground'
                          : 'text-destructive')
                      }
                    >
                      {unavailable
                        ? '当前后端未启用「后端管理」功能（该接口不存在，需使用支持节点远程管理的 Xboard 版本）。'
                        : `加载失败：${(error as Error)?.message}`}
                    </TableCell>
                  </TableRow>
                )
              })()
            ) : backends.length > 0 ? (
              backends.map((b) => {
                const key = backendKey(b)
                const canCompare = !!latestVersion && !!b.version
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(key)}
                        disabled={!b.online}
                        onCheckedChange={() => toggle(key)}
                        aria-label='选择'
                      />
                    </TableCell>
                    <TableCell>
                      <div className='font-medium'>{b.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {b.type === 'machine' ? '机器' : '单节点'}
                        {b.nodes_count ? ` · ${b.nodes_count} 节点` : ''}
                      </div>
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {b.ips?.length ? (
                        b.ips.map((ip) => <div key={ip}>{ip}</div>)
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-sm'>
                      {b.online ? (
                        <span className='text-emerald-600'>● 在线</span>
                      ) : (
                        <span className='text-muted-foreground'>● 离线</span>
                      )}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      <div>{b.version || '—'}</div>
                      {canCompare ? (
                        cmpVer(b.version, latestVersion) >= 0 ? (
                          <div className='text-[11px] text-emerald-600'>
                            ✓ 已是最新
                          </div>
                        ) : (
                          <div className='text-[11px] font-medium text-destructive'>
                            可升级 → {normVer(latestVersion)}
                          </div>
                        )
                      ) : null}
                    </TableCell>
                    <TableCell className='text-xs'>
                      {b.kernel || '—'}
                      {b.arch ? ` / ${b.arch}` : ''}
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {fmtTime(b.last_seen_at)}
                    </TableCell>
                    <TableCell className='text-xs'>
                      <UpgradeStatusCell upgrade={b.upgrade} />
                    </TableCell>
                    <TableCell className='text-end whitespace-nowrap'>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={!b.online}
                        onClick={() => setConfirmUpgrade([b])}
                      >
                        升级
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        className='ms-2'
                        disabled={!b.online}
                        onClick={() => setConfirmRestart([b])}
                      >
                        <RotateCw className='size-3' /> 重启
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className='h-24 text-center text-muted-foreground'
                >
                  暂无运行中的后端。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center gap-2'>
        <Label className='whitespace-nowrap text-xs text-muted-foreground'>
          下载源
        </Label>
        <Input
          className='h-8 text-xs'
          placeholder='留空使用默认 GitHub releases'
          value={effectiveBase}
          onChange={(e) => {
            setBaseTouched(true)
            setDownloadBase(e.target.value)
          }}
        />
      </div>

      <ConfirmDialog
        open={!!confirmUpgrade}
        onOpenChange={(o) => !o && setConfirmUpgrade(null)}
        title='确认升级'
        desc={
          <span>
            确认升级以下后端到最新版本？升级会重启后端服务，期间短暂断连。
            <br />
            <span className='font-medium'>
              {(confirmUpgrade ?? []).map((b) => b.name).join('、')}
            </span>
          </span>
        }
        confirmText='升级'
        isLoading={upgradeMutation.isPending}
        handleConfirm={() =>
          confirmUpgrade &&
          upgradeMutation.mutate(
            confirmUpgrade.map((b) => ({ type: b.type, id: b.id }))
          )
        }
      />

      <ConfirmDialog
        open={!!confirmRestart}
        onOpenChange={(o) => !o && setConfirmRestart(null)}
        title='确认重启'
        desc={
          <span>
            确认重启以下后端进程？重启会短暂断连，进程由 systemd 自动拉起。
            <br />
            <span className='font-medium'>
              {(confirmRestart ?? []).map((b) => b.name).join('、')}
            </span>
          </span>
        }
        confirmText='重启'
        isLoading={restartMutation.isPending}
        handleConfirm={() =>
          confirmRestart &&
          restartMutation.mutate(
            confirmRestart.map((b) => ({ type: b.type, id: b.id }))
          )
        }
      />
    </div>
  )
}
