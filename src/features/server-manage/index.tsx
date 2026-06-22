import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Terminal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SERVER_TYPE_LABEL,
  type Server,
  type ServerType,
  batchDeleteNodes,
  batchResetTraffic,
  batchUpdateNodes,
  copyNode,
  dropNode,
  getNodes,
  resetTraffic,
  updateNode,
} from './api'
import { InstallCommandDialog } from './components/install-command-dialog'
import { NodeMutateDialog } from './components/node-mutate-dialog'

const STATUS_META: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  0: { label: '离线', variant: 'destructive' },
  1: { label: '在线(未推送)', variant: 'secondary' },
  2: { label: '在线', variant: 'default' },
}

export function ServerManagePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Server | null>(null)
  const [deleting, setDeleting] = useState<Server | null>(null)
  const [resetting, setResetting] = useState<Server | null>(null)
  const [installNode, setInstallNode] = useState<Server | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchResetOpen, setBatchResetOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  })

  const nodes = data ?? []
  const allSelected = nodes.length > 0 && selected.length === nodes.length

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['nodes'] })

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: number; show?: number; enabled?: boolean }) =>
      updateNode(payload),
    onSuccess: invalidate,
    onError: handleServerError,
  })

  const copyMutation = useMutation({
    mutationFn: (id: number) => copyNode(id),
    onSuccess: () => {
      toast.success('已复制节点')
      invalidate()
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropNode(id),
    onSuccess: () => {
      toast.success('已删除')
      invalidate()
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const resetMutation = useMutation({
    mutationFn: (id: number) => resetTraffic(id),
    onSuccess: () => {
      toast.success('已重置流量')
      invalidate()
      setResetting(null)
    },
    onError: handleServerError,
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => batchDeleteNodes(ids),
    onSuccess: () => {
      toast.success('已批量删除')
      invalidate()
      setSelected([])
      setBatchDeleteOpen(false)
    },
    onError: handleServerError,
  })

  const batchResetMutation = useMutation({
    mutationFn: (ids: number[]) => batchResetTraffic(ids),
    onSuccess: () => {
      toast.success('已批量重置流量')
      invalidate()
      setSelected([])
      setBatchResetOpen(false)
    },
    onError: handleServerError,
  })

  const batchUpdateMutation = useMutation({
    mutationFn: (payload: { ids: number[]; show?: number; enabled?: boolean }) =>
      batchUpdateNodes(payload),
    onSuccess: () => {
      toast.success('已批量更新')
      invalidate()
      setSelected([])
    },
    onError: handleServerError,
  })

  const toggleSelect = (id: number, checked: boolean) =>
    setSelected((s) => (checked ? [...s, id] : s.filter((x) => x !== id)))
  const toggleSelectAll = (checked: boolean) =>
    setSelected(checked ? nodes.map((n) => n.id) : [])

  const grouped = useMemo(() => {
    const map = new Map<ServerType, Server[]>()
    for (const n of nodes) {
      const arr = map.get(n.type) ?? []
      arr.push(n)
      map.set(n.type, arr)
    }
    return map
  }, [nodes])

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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>节点管理</h2>
            <p className='text-muted-foreground'>
              管理各协议节点（共 {nodes.length} 个，
              {Array.from(grouped.entries())
                .map(([t, list]) => `${SERVER_TYPE_LABEL[t]} ${list.length}`)
                .join(' / ') || '无'}
              ）。
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {selected.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline'>
                    批量操作 ({selected.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem
                    onClick={() =>
                      batchUpdateMutation.mutate({ ids: selected, show: 1 })
                    }
                  >
                    批量显示
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      batchUpdateMutation.mutate({ ids: selected, show: 0 })
                    }
                  >
                    批量隐藏
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      batchUpdateMutation.mutate({
                        ids: selected,
                        enabled: true,
                      })
                    }
                  >
                    批量启用
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      batchUpdateMutation.mutate({
                        ids: selected,
                        enabled: false,
                      })
                    }
                  >
                    批量禁用
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setBatchResetOpen(true)}>
                    批量重置流量
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className='text-destructive'
                    onClick={() => setBatchDeleteOpen(true)}
                  >
                    批量删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              onClick={() => {
                setCurrent(null)
                setMutateOpen(true)
              }}
            >
              <Plus className='size-4' /> 新建节点
            </Button>
          </div>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-10'>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => toggleSelectAll(!!c)}
                    aria-label='全选'
                  />
                </TableHead>
                <TableHead className='w-16'>排序</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className='w-28'>类型</TableHead>
                <TableHead>地址</TableHead>
                <TableHead className='w-20'>端口</TableHead>
                <TableHead className='w-40'>权限组</TableHead>
                <TableHead className='w-20'>在线</TableHead>
                <TableHead className='w-28'>状态</TableHead>
                <TableHead className='w-20'>显示</TableHead>
                <TableHead className='w-16 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : nodes.length > 0 ? (
                nodes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(n.id)}
                        onCheckedChange={(c) => toggleSelect(n.id, !!c)}
                        aria-label={`选择 ${n.name}`}
                      />
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {n.sort ?? n.id}
                    </TableCell>
                    <TableCell className='font-medium'>
                      {n.name}
                      {n.parent_id ? (
                        <Badge variant='outline' className='ms-2'>
                          子
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary'>
                        {SERVER_TYPE_LABEL[n.type] ?? n.type}
                      </Badge>
                    </TableCell>
                    <TableCell className='max-w-[200px] truncate'>
                      {n.host}
                    </TableCell>
                    <TableCell>{n.port}</TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        {(n.groups ?? []).map((g) => (
                          <Badge key={g.id} variant='outline'>
                            {g.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{n.online ?? 0}</TableCell>
                    <TableCell>
                      {(() => {
                        const meta =
                          STATUS_META[n.available_status ?? 0] ??
                          STATUS_META[0]
                        return <Badge variant={meta.variant}>{meta.label}</Badge>
                      })()}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={!!n.show}
                        onCheckedChange={(c) =>
                          toggleMutation.mutate({ id: n.id, show: c ? 1 : 0 })
                        }
                        aria-label='显示'
                      />
                    </TableCell>
                    <TableCell className='text-end'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon'>
                            <MoreHorizontal className='size-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => {
                              setCurrent(n)
                              setMutateOpen(true)
                            }}
                          >
                            <Pencil className='size-4' /> 编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyMutation.mutate(n.id)}
                          >
                            <Copy className='size-4' /> 复制
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setInstallNode(n)}>
                            <Terminal className='size-4' /> 安装命令
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetting(n)}>
                            <RotateCcw className='size-4' /> 重置流量
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className='text-destructive'
                            onClick={() => setDeleting(n)}
                          >
                            <Trash2 className='size-4' /> 删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className='h-24 text-center'>
                    暂无节点
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Main>

      <NodeMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <InstallCommandDialog
        open={!!installNode}
        onOpenChange={(o) => !o && setInstallNode(null)}
        node={installNode}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除节点'
        desc={`确定删除节点「${deleting?.name}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title='重置流量'
        desc={`确定重置节点「${resetting?.name}」的上下行流量吗？`}
        confirmText='重置'
        isLoading={resetMutation.isPending}
        handleConfirm={() => resetting && resetMutation.mutate(resetting.id)}
      />

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title='批量删除节点'
        desc={`确定删除选中的 ${selected.length} 个节点吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={batchDeleteMutation.isPending}
        handleConfirm={() => batchDeleteMutation.mutate(selected)}
      />

      <ConfirmDialog
        open={batchResetOpen}
        onOpenChange={setBatchResetOpen}
        title='批量重置流量'
        desc={`确定重置选中的 ${selected.length} 个节点的流量吗？`}
        confirmText='重置'
        isLoading={batchResetMutation.isPending}
        handleConfirm={() => batchResetMutation.mutate(selected)}
      />
    </>
  )
}
