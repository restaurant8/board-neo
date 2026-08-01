import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Plus, RefreshCw, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  dropExternalNodeSource,
  fetchExternalNodeSources,
  fetchExternalNodes,
  syncAllExternalNodeSources,
  syncExternalNodeSource,
} from './api'
import { ExternalNodeSourceDialog } from './components/source-dialog'

export function ExternalNodesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [current, setCurrent] = useState<ExternalNodeSource | null>(null)
  const [preview, setPreview] = useState<ExternalNodeSource | null>(null)
  const [deleting, setDeleting] = useState<ExternalNodeSource | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['external-node-sources'],
    queryFn: fetchExternalNodeSources,
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
      toast.success(
        `更新完成，共 ${result.node_count} 个节点${result.skipped_count > 0 ? `，跳过 ${result.skipped_count} 个异常节点` : ''}`
      )
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
                    <TableCell colSpan={8}>
                      <Skeleton className='h-8 w-full' />
                    </TableCell>
                  </TableRow>
                ))
              ) : !data?.sources.length ? (
                <TableRow>
                  <TableCell colSpan={8} className='h-40 text-center'>
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
                          {source.node_count}
                        </button>
                        {source.last_skipped_count > 0 && (
                          <div className='text-xs text-amber-600'>
                            跳过 {source.last_skipped_count}
                          </div>
                        )}
                      </div>
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
                              syncMutation.isPending &&
                              syncMutation.variables === source.id
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

function SyncStatus({ source }: { source: ExternalNodeSource }) {
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
  const { data: nodes = [], isLoading } = useQuery({
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
            这里显示规则应用后的最终名称和连接地址，密码等凭据不会在管理接口中返回。
          </DialogDescription>
        </DialogHeader>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>协议</TableHead>
                <TableHead>最终名称</TableHead>
                <TableHead>最终地址</TableHead>
                <TableHead>原名称 / 原地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    加载中…
                  </TableCell>
                </TableRow>
              ) : nodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    没有节点
                  </TableCell>
                </TableRow>
              ) : (
                nodes.map((node) => (
                  <TableRow key={node.id}>
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
      </DialogContent>
    </Dialog>
  )
}

function formatTime(timestamp: number | null) {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function formatInterval(minutes: number) {
  if (minutes < 60) return `每 ${minutes} 分钟`
  if (minutes % 1440 === 0) return `每 ${minutes / 1440} 天`
  if (minutes % 60 === 0) return `每 ${minutes / 60} 小时`
  return `每 ${minutes} 分钟`
}
