import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Settings2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { fetchServerGroups } from '@/features/server-group/api'
import {
  type ExternalNodeSource,
  type ExternalPullProxySettings,
  dropExternalNodeSource,
  fetchExternalNodeSources,
  fetchExternalNodes,
  saveExternalNodeSelection,
  syncAllExternalNodeSources,
  syncExternalNodeSource,
} from './api'
import { ExternalPullProxyDialog } from './components/proxy-dialog'
import { ExternalNodeSourceDialog } from './components/source-dialog'

const EMPTY_PULL_PROXY: ExternalPullProxySettings = {
  enabled: false,
  host: '',
  port: 1080,
  username: '',
  password_configured: false,
}

export function ExternalNodesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [current, setCurrent] = useState<ExternalNodeSource | null>(null)
  const [preview, setPreview] = useState<ExternalNodeSource | null>(null)
  const [deleting, setDeleting] = useState<ExternalNodeSource | null>(null)
  const [proxyDialogOpen, setProxyDialogOpen] = useState(false)

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch: refetchSources,
  } = useQuery({
    queryKey: ['external-node-sources'],
    queryFn: fetchExternalNodeSources,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.sources.some(
        (source) =>
          source.last_sync_status === 'pending' &&
          Date.now() / 1000 - source.updated_at < 16 * 60
      )
        ? 2000
        : false,
  })
  const { data: groups = [] } = useQuery({
    queryKey: ['server-groups'],
    queryFn: fetchServerGroups,
  })

  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups]
  )

  const syncMutation = useMutation({
    mutationFn: syncExternalNodeSource,
    onSuccess: (result) => {
      if (result.queued) {
        toast.success('更新任务已提交到后台')
      } else {
        toast.success(
          `更新完成，共 ${result.node_count} 个节点${result.skipped_count > 0 ? `，跳过 ${result.skipped_count} 个异常节点` : ''}`
        )
      }
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      queryClient.invalidateQueries({ queryKey: ['external-nodes'] })
    },
    onError: handleServerError,
  })

  const syncAllMutation = useMutation({
    mutationFn: syncAllExternalNodeSources,
    onSuccess: (result) => {
      if (result.dispatch_failed_count > 0) {
        toast.warning(
          `已提交 ${result.queued_count} 个更新任务，${result.dispatch_failed_count} 个提交失败`
        )
      } else {
        toast.success(`已提交 ${result.queued_count} 个后台更新任务`)
      }
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      queryClient.invalidateQueries({ queryKey: ['external-nodes'] })
      Array.of(1500, 5000).forEach((delay) =>
        window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
          queryClient.invalidateQueries({ queryKey: ['external-nodes'] })
        }, delay)
      )
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: dropExternalNodeSource,
    onSuccess: () => {
      toast.success('已删除外部节点来源及其节点')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
    },
    onError: handleServerError,
  })

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>外部节点来源</h2>
            <p className='mt-1 text-muted-foreground'>
              导入机场订阅或单独节点，统一改名和替换连接地址后与本站节点一起下发。
            </p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => setProxyDialogOpen(true)}>
              <Settings2 className='mr-2 size-4' />
              拉取代理
              {data?.pull_proxy.enabled && (
                <span className='ml-1 text-xs text-emerald-600'>已启用</span>
              )}
            </Button>
            <Button
              variant='outline'
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending || !data?.sources.length}
            >
              <RefreshCw
                className={`mr-2 size-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`}
              />
              更新全部订阅
            </Button>
            <Button
              onClick={() => {
                setCurrent(null)
                setDialogOpen(true)
              }}
            >
              <Plus className='mr-2 size-4' />
              添加来源
            </Button>
          </div>
        </div>

        <div className='overflow-hidden rounded-md border bg-card'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>来源</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>节点数</TableHead>
                <TableHead>上游套餐</TableHead>
                <TableHead>权限组</TableHead>
                <TableHead>User-Agent</TableHead>
                <TableHead>同步状态</TableHead>
                <TableHead>最后更新</TableHead>
                <TableHead className='text-right'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={9}>
                      <Skeleton className='h-8 w-full' />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={9} className='h-40 text-center'>
                    <div className='font-medium text-destructive'>
                      外部节点来源加载失败
                    </div>
                    <div className='mt-1 text-sm text-muted-foreground'>
                      这不代表已有订阅被删除，请检查后端日志或完成数据库迁移。
                    </div>
                    <Button
                      className='mt-3'
                      size='sm'
                      variant='outline'
                      disabled={isFetching}
                      onClick={() => refetchSources()}
                    >
                      <RefreshCw
                        className={`mr-1 size-4 ${isFetching ? 'animate-spin' : ''}`}
                      />
                      重新加载
                    </Button>
                  </TableCell>
                </TableRow>
              ) : !data?.sources.length ? (
                <TableRow>
                  <TableCell colSpan={9} className='h-40 text-center'>
                    <div className='text-muted-foreground'>
                      尚未添加外部节点来源
                    </div>
                    <Button
                      className='mt-3'
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        setCurrent(null)
                        setDialogOpen(true)
                      }}
                    >
                      <Plus className='mr-1 size-4' />
                      添加第一个来源
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                data.sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div className='font-medium'>{source.name}</div>
                      {!source.enabled && (
                        <span className='text-xs text-muted-foreground'>
                          已停止下发
                        </span>
                      )}
                      {source.auto_sync && source.enabled && (
                        <div className='text-xs text-muted-foreground'>
                          自动更新：
                          {formatInterval(source.sync_interval_minutes)}
                        </div>
                      )}
                      {source.type === 'subscription' && (
                        <div className='text-xs text-muted-foreground'>
                          拉取：
                          {proxyModeLabel(source, !!data.pull_proxy?.enabled)}
                        </div>
                      )}
                      {source.dns_alias_enabled && source.dns_alias_domain && (
                        <div className='text-xs text-sky-600'>
                          DNS 套壳：{source.dns_alias_domain}
                        </div>
                      )}
                      {(source.subscription_url || source.manual_uri) && (
                        <div
                          className='mt-1 max-w-72 truncate font-mono text-xs text-muted-foreground'
                          title={
                            source.type === 'subscription'
                              ? source.subscription_url || ''
                              : source.manual_uri || ''
                          }
                        >
                          {source.type === 'subscription'
                            ? source.subscription_url
                            : source.manual_uri}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {source.type === 'subscription' ? '订阅' : '单节点'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <button
                          className='text-primary hover:underline disabled:text-foreground disabled:no-underline'
                          disabled={source.node_count === 0}
                          onClick={() => setPreview(source)}
                        >
                          {source.enabled_node_count} / {source.node_count}
                        </button>
                        <div className='text-xs text-muted-foreground'>
                          下发 / 拉取
                        </div>
                        {source.last_skipped_count -
                          (source.subscription_info?.filtered_info_nodes ?? 0) >
                          0 && (
                          <div className='text-xs text-amber-600'>
                            跳过{' '}
                            {source.last_skipped_count -
                              (source.subscription_info?.filtered_info_nodes ??
                                0)}
                          </div>
                        )}
                        {!!source.subscription_info?.filtered_info_nodes && (
                          <div className='text-xs text-sky-600'>
                            过滤上游提示{' '}
                            {source.subscription_info.filtered_info_nodes}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <UpstreamSubscriptionInfo source={source} />
                    </TableCell>
                    <TableCell>
                      <div className='flex max-w-48 flex-wrap gap-1'>
                        {source.group_ids.map((groupId) => (
                          <Badge key={groupId} variant='secondary'>
                            {groupMap.get(Number(groupId)) ?? `#${groupId}`}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code
                        className='block max-w-40 truncate text-xs'
                        title={source.user_agent}
                      >
                        {source.user_agent}
                      </code>
                    </TableCell>
                    <TableCell>
                      <SyncStatus source={source} />
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      <div>{formatTime(source.last_sync_at)}</div>
                      {source.auto_sync && source.next_sync_at && (
                        <div className='text-xs'>
                          下次：{formatTime(source.next_sync_at)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-1'>
                        <Button
                          size='icon'
                          variant='ghost'
                          title='查看导入节点'
                          disabled={source.node_count === 0}
                          onClick={() => setPreview(source)}
                        >
                          <Eye className='size-4' />
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          title='立即更新并重新应用规则'
                          disabled={syncMutation.isPending}
                          onClick={() => syncMutation.mutate(source.id)}
                        >
                          <RotateCw
                            className={`size-4 ${
                              (syncMutation.isPending &&
                                syncMutation.variables === source.id) ||
                              source.last_sync_status === 'pending'
                                ? 'animate-spin'
                                : ''
                            }`}
                          />
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          title='编辑来源和规则'
                          onClick={() => {
                            setCurrent(source)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className='size-4' />
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          title='删除来源'
                          onClick={() => setDeleting(source)}
                        >
                          <Trash2 className='size-4 text-destructive' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
          外部节点只参与订阅下发，不会出现在本站后端机器中，也不会接收本站流量上报。下发内容不包含来源标记；用户看到的名称、地址和协议格式与本站节点一致。
          “上游套餐”来自对方订阅响应头，仅供管理员掌握外部账号余量和到期时间。
        </div>
      </Main>

      {dialogOpen && (
        <ExternalNodeSourceDialog
          open
          onOpenChange={setDialogOpen}
          current={current}
          groups={groups}
          userAgentPresets={data?.user_agent_presets ?? {}}
          dnsZones={data?.dns_zones ?? []}
          pullProxy={data?.pull_proxy ?? EMPTY_PULL_PROXY}
        />
      )}
      {proxyDialogOpen && (
        <ExternalPullProxyDialog
          open
          onOpenChange={setProxyDialogOpen}
          current={data?.pull_proxy ?? EMPTY_PULL_PROXY}
          testSource={data?.sources.find(
            (source) =>
              source.type === 'subscription' && !!source.subscription_url
          )}
        />
      )}
      <ExternalNodesPreview
        source={preview}
        onOpenChange={(open) => !open && setPreview(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title='删除外部节点来源？'
        desc={`将同时删除“${deleting?.name ?? ''}”已经导入的全部节点及本功能创建的 Cloudflare DNS 记录，此操作不可撤销。`}
        destructive
        confirmText='删除'
        cancelBtnText='取消'
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}

function proxyModeLabel(source: ExternalNodeSource, globalEnabled: boolean) {
  if (source.proxy_mode === 'direct') return '强制直连'
  if (source.proxy_mode === 'socks5') return '独立 SOCKS5'
  return globalEnabled ? '统一 SOCKS5' : '直连（继承统一设置）'
}

function UpstreamSubscriptionInfo({ source }: { source: ExternalNodeSource }) {
  if (source.type !== 'subscription') {
    return <span className='text-muted-foreground'>—</span>
  }
  const info = source.subscription_info
  if (!info) {
    return <span className='text-xs text-muted-foreground'>上游未提供</span>
  }

  const upload = info.upload ?? 0
  const download = info.download ?? 0
  const used = upload + download
  const hasTraffic = info.total !== undefined
  const remaining = hasTraffic ? Math.max(0, info.total! - used) : null

  return (
    <div className='min-w-32 text-xs'>
      {info.profile_title && (
        <div
          className='max-w-40 truncate font-medium'
          title={info.profile_title}
        >
          {info.profile_title}
        </div>
      )}
      {hasTraffic && (
        <>
          <div className='text-muted-foreground'>
            已用 {formatBytes(used)} / {formatBytes(info.total!)}
          </div>
          <div className='text-muted-foreground'>
            剩余 {formatBytes(remaining!)}
          </div>
        </>
      )}
      {'expire' in info && (
        <div className='text-muted-foreground'>
          到期：{info.expire ? formatDate(info.expire) : '长期有效'}
        </div>
      )}
      {!hasTraffic && info.remaining_text && (
        <div className='text-muted-foreground'>剩余 {info.remaining_text}</div>
      )}
      {!('expire' in info) && info.expire_text && (
        <div className='text-muted-foreground'>到期：{info.expire_text}</div>
      )}
      {info.reset_text && (
        <div className='text-muted-foreground'>重置：{info.reset_text}</div>
      )}
      {!hasTraffic && !('expire' in info) && !info.profile_title && (
        <span className='text-muted-foreground'>已读取订阅信息</span>
      )}
    </div>
  )
}

function SyncStatus({ source }: { source: ExternalNodeSource }) {
  if (source.last_sync_status === 'pending') {
    return <Badge variant='secondary'>同步中</Badge>
  }
  if (source.last_sync_status === 'success') {
    return (
      <Badge className='border-emerald-200 bg-emerald-50 text-emerald-700'>
        成功
      </Badge>
    )
  }
  if (source.last_sync_status === 'failed') {
    return (
      <Badge
        variant='destructive'
        className='max-w-32 truncate'
        title={source.last_sync_error ?? '更新失败'}
      >
        更新失败
      </Badge>
    )
  }
  return <Badge variant='secondary'>未更新</Badge>
}

function ExternalNodesPreview({
  source,
  onOpenChange,
}: {
  source: ExternalNodeSource | null
  onOpenChange: (open: boolean) => void
}) {
  const {
    data: nodes = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['external-nodes', source?.id],
    queryFn: () => fetchExternalNodes(source!.id),
    enabled: !!source,
  })

  return (
    <Dialog open={!!source} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{source?.name} · 已导入节点</DialogTitle>
          <DialogDescription>
            取消勾选的节点仍会保留在后台，但不会进入用户订阅。同步时会保留已有选择；上游真正新增的节点默认下发。
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className='flex h-28 items-center justify-center text-sm text-muted-foreground'>
            加载节点…
          </div>
        ) : isError ? (
          <div className='flex h-28 items-center justify-center text-sm text-destructive'>
            节点列表加载失败，请关闭后重试。
          </div>
        ) : nodes.length === 0 ? (
          <div className='flex h-28 items-center justify-center text-sm text-muted-foreground'>
            没有节点
          </div>
        ) : (
          <ExternalNodeSelectionEditor
            key={`${source?.id}:${nodes[0]?.id}:${nodes[nodes.length - 1]?.id}:${nodes.length}`}
            source={source!}
            nodes={nodes}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ExternalNodeSelectionEditor({
  source,
  nodes,
}: {
  source: ExternalNodeSource
  nodes: Awaited<ReturnType<typeof fetchExternalNodes>>
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(
    () => new Set(nodes.filter((node) => node.enabled).map((node) => node.id))
  )
  const filteredNodes = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    if (!keyword) return nodes
    return nodes.filter((node) =>
      [
        node.name,
        node.original_name,
        node.host,
        node.original_host,
        node.type,
      ].some((value) => value.toLocaleLowerCase().includes(keyword))
    )
  }, [nodes, search])
  const originalIds = nodes
    .filter((node) => node.enabled)
    .map((node) => node.id)
    .sort((left, right) => left - right)
  const selectedIds = Array.from(selected).sort((left, right) => left - right)
  const dirty =
    originalIds.length !== selectedIds.length ||
    originalIds.some((id, index) => id !== selectedIds[index])
  const allSelected = selected.size === nodes.length

  const saveMutation = useMutation({
    mutationFn: () => saveExternalNodeSelection(source.id, selectedIds),
    onSuccess: (result) => {
      toast.success(
        `已保存，下发 ${result.enabled_node_count} / ${result.node_count} 个节点`
      )
      queryClient.setQueryData(
        ['external-nodes', source.id],
        nodes.map((node) => ({ ...node, enabled: selected.has(node.id) }))
      )
      queryClient.invalidateQueries({ queryKey: ['external-node-sources'] })
      queryClient.invalidateQueries({ queryKey: ['external-nodes', source.id] })
    },
    onError: handleServerError,
  })

  const toggleNode = (id: number, enabled: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (enabled) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className='grid gap-3'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2'>
          <Badge variant='secondary'>
            当前选择 {selected.size} / {nodes.length}
          </Badge>
          <span className='text-xs text-muted-foreground'>
            只有勾选项会下发
          </span>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setSelected(new Set(nodes.map((node) => node.id)))}
          >
            全部下发
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setSelected(new Set())}
          >
            全部停发
          </Button>
          <Button
            size='sm'
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? '保存中…' : '保存下发选择'}
          </Button>
        </div>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder='搜索名称、地址或协议'
      />

      <div className='max-h-[52vh] overflow-auto rounded-md border'>
        <Table>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              <TableHead className='w-12'>
                <Checkbox
                  checked={
                    allSelected || (selected.size > 0 && 'indeterminate')
                  }
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked
                        ? new Set(nodes.map((node) => node.id))
                        : new Set()
                    )
                  }
                  aria-label='选择全部节点'
                />
              </TableHead>
              <TableHead>协议</TableHead>
              <TableHead>最终名称</TableHead>
              <TableHead>最终地址</TableHead>
              <TableHead>原名称 / 原地址</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  没有匹配的节点
                </TableCell>
              </TableRow>
            ) : (
              filteredNodes.map((node) => (
                <TableRow
                  key={node.id}
                  className={selected.has(node.id) ? '' : 'opacity-55'}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(node.id)}
                      onCheckedChange={(checked) =>
                        toggleNode(node.id, checked === true)
                      }
                      aria-label={`下发 ${node.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{node.type}</Badge>
                  </TableCell>
                  <TableCell className='font-medium'>{node.name}</TableCell>
                  <TableCell className='font-mono text-xs'>
                    <div>
                      {node.host}:{node.port}
                    </div>
                    {node.dns_target && (
                      <div className='text-muted-foreground'>
                        → {node.dns_target}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='text-xs text-muted-foreground'>
                    <div>{node.original_name}</div>
                    <div className='font-mono'>{node.original_host}</div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function formatTime(timestamp: number | null) {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN')
}

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function formatInterval(minutes: number) {
  if (minutes < 60) return `每 ${minutes} 分钟`
  if (minutes % 1440 === 0) return `每 ${minutes / 1440} 天`
  if (minutes % 60 === 0) return `每 ${minutes / 60} 小时`
  return `每 ${minutes} 分钟`
}
