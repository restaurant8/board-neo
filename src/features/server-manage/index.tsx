import { useMemo, useState } from 'react'
import { PlusCircledIcon, CheckIcon } from '@radix-ui/react-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronsUpDown,
  Copy,
  GripVertical,
  HelpCircle,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
  Plus,
  Replace,
  RotateCcw,
  Save,
  Search,
  Server as ServerIcon,
  Terminal,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import {
  getTableColumnSpan,
  renderVisibleColumns,
  type TableColumnOption,
  useTableColumnPreferences,
} from '@/hooks/use-table-column-preferences'
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
  CommandSeparator,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { TableColumnCustomizer } from '@/components/table-column-customizer'
import { ThemeSwitch } from '@/components/theme-switch'
import { formatBytes } from '@/features/dashboard/format'
import { fetchServerGroups } from '@/features/server-group/api'
import { fetchMachines } from '@/features/server-machine/api'
import { isOnline } from '@/features/server-machine/format'
import {
  SERVER_TYPES,
  SERVER_TYPE_COLOR,
  SERVER_TYPE_LABEL,
  type Server,
  batchDeleteNodes,
  batchReplaceNodes,
  batchResetTraffic,
  batchUpdateNodeGroups,
  batchUpdateNodes,
  copyNode,
  dropNode,
  getNodes,
  resetTraffic,
  sortNodes,
  updateNode,
} from './api'
import { BatchGroupsDialog } from './components/batch-groups-dialog'
import { BatchReplaceDialog } from './components/batch-replace-dialog'
import { InstallCommandDialog } from './components/install-command-dialog'
import { NodeMutateDialog } from './components/node-mutate-dialog'

const NODE_TABLE_COLUMNS = [
  { id: 'id', label: '节点ID' },
  { id: 'visibility', label: '显隐' },
  { id: 'name', label: '节点' },
  { id: 'deployment', label: '部署方式' },
  { id: 'address', label: '地址' },
  { id: 'online', label: '在线人数' },
  { id: 'rate', label: '倍率' },
  { id: 'groups', label: '权限组' },
  { id: 'traffic', label: '流量使用' },
] as const satisfies readonly TableColumnOption<string>[]

type NodeTableColumnId = (typeof NODE_TABLE_COLUMNS)[number]['id']

/* ----------------------------- 胶囊式 faceted 筛选 ----------------------------- */

type FacetOption = { label: string; value: string }

/**
 * 官方同款 border-dashed 胶囊筛选（Popover + Command 多选）。
 * 不依赖 react-table，本页用受控 string[] 值。
 */
function FacetFilter({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder,
  emptyText = '无结果',
}: {
  title: string
  options: FacetOption[]
  selected: string[]
  onChange: (next: string[]) => void
  searchPlaceholder?: string
  emptyText?: string
}) {
  const selectedSet = new Set(selected)
  const toggle = (value: string) => {
    const next = new Set(selectedSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(Array.from(next))
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='h-8 border-dashed'>
          <PlusCircledIcon className='size-4' />
          {title}
          {selectedSet.size > 0 && (
            <>
              <Separator orientation='vertical' className='mx-2 h-4' />
              <Badge
                variant='secondary'
                className='rounded-sm px-1 font-normal lg:hidden'
              >
                {selectedSet.size}
              </Badge>
              <div className='hidden space-x-1 lg:flex'>
                {selectedSet.size > 2 ? (
                  <Badge
                    variant='secondary'
                    className='rounded-sm px-1 font-normal'
                  >
                    已选 {selectedSet.size}
                  </Badge>
                ) : (
                  options
                    .filter((o) => selectedSet.has(o.value))
                    .map((o) => (
                      <Badge
                        variant='secondary'
                        key={o.value}
                        className='rounded-sm px-1 font-normal'
                      >
                        {o.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-52 p-0' align='start'>
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? title} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => toggle(option.value)}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className='size-4 text-background' />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedSet.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className='justify-center text-center'
                  >
                    清除筛选
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ServerManagePage() {
  const queryClient = useQueryClient()
  const adminEmail = useAuthStore((state) => state.auth.user?.email)
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Server | null>(null)
  const [deleting, setDeleting] = useState<Server | null>(null)
  const [resetting, setResetting] = useState<Server | null>(null)
  const [installNode, setInstallNode] = useState<Server | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchResetOpen, setBatchResetOpen] = useState(false)
  const [batchGroupsOpen, setBatchGroupsOpen] = useState(false)
  const [batchReplaceOpen, setBatchReplaceOpen] = useState(false)

  // 筛选（胶囊多选）
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [machineFilter, setMachineFilter] = useState<string[]>([])
  const [groupFilter, setGroupFilter] = useState<string[]>([])
  const [hostFilter, setHostFilter] = useState<string[]>([])
  const [portFilter, setPortFilter] = useState<string[]>([])
  const [serverPortFilter, setServerPortFilter] = useState<string[]>([])

  // 节点ID 排序（点击表头）
  const [idSort, setIdSort] = useState<'asc' | 'desc' | null>(null)
  const nodeColumns = useTableColumnPreferences<NodeTableColumnId>(
    `board-neo:${encodeURIComponent(adminEmail ?? 'anonymous')}:node-table-columns`,
    NODE_TABLE_COLUMNS,
    {
      onExternalVisibilityChange: (hidden) => {
        if (hidden.has('id')) setIdSort(null)
      },
    }
  )

  // 排序编辑态（点选/拖拽）
  const [sortMode, setSortMode] = useState(false)
  const [orderedIds, setOrderedIds] = useState<number[]>([])
  const [dragId, setDragId] = useState<number | null>(null)
  // 点选排序：按点击顺序编号（微信相册式），先点的排前面
  const [pickMode, setPickMode] = useState(true)
  const [pickOrder, setPickOrder] = useState<number[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  })
  const { data: groups } = useQuery({
    queryKey: ['server-groups'],
    queryFn: fetchServerGroups,
  })
  const { data: machines } = useQuery({
    queryKey: ['server-machines'],
    queryFn: fetchMachines,
  })

  const nodes = useMemo(() => data ?? [], [data])

  const machineNameById = useMemo(() => {
    const m = new Map<number, string>()
    ;(machines ?? []).forEach((x) => m.set(x.id, x.name))
    return m
  }, [machines])

  const machineById = useMemo(() => {
    const m = new Map<number, NonNullable<typeof machines>[number]>()
    ;(machines ?? []).forEach((x) => m.set(x.id, x))
    return m
  }, [machines])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['nodes'] })

  /* ----------------------------- mutations ----------------------------- */

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: number; show?: number; enabled?: boolean }) =>
      updateNode(payload),
    onSuccess: invalidate,
    onError: handleServerError,
  })

  const copyMutation = useMutation({
    mutationFn: (id: number) => copyNode(id),
    onSuccess: () => {
      toast.success('复制成功')
      invalidate()
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropNode(id),
    onSuccess: () => {
      toast.success('删除成功')
      invalidate()
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const resetMutation = useMutation({
    mutationFn: (id: number) => resetTraffic(id),
    onSuccess: () => {
      toast.success('流量重置成功')
      invalidate()
      setResetting(null)
    },
    onError: handleServerError,
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => batchDeleteNodes(ids),
    onSuccess: (_d, ids) => {
      toast.success(`成功删除 ${ids.length} 个节点`)
      invalidate()
      setSelected([])
      setBatchDeleteOpen(false)
    },
    onError: handleServerError,
  })

  const batchResetMutation = useMutation({
    mutationFn: (ids: number[]) => batchResetTraffic(ids),
    onSuccess: (_d, ids) => {
      toast.success(`成功重置 ${ids.length} 个节点的流量`)
      invalidate()
      setSelected([])
      setBatchResetOpen(false)
    },
    onError: handleServerError,
  })

  const batchUpdateMutation = useMutation({
    mutationFn: (payload: {
      ids: number[]
      show?: number
      enabled?: boolean
      successMsg: string
    }) => batchUpdateNodes(payload),
    onSuccess: (_d, vars) => {
      toast.success(vars.successMsg)
      invalidate()
      setSelected([])
    },
    onError: handleServerError,
  })

  const batchReplaceMutation = useMutation({
    mutationFn: batchReplaceNodes,
    onSuccess: (result) => {
      if (result.updated_count > 0) {
        toast.success(`成功替换 ${result.updated_count} 个节点`)
      } else {
        toast.warning('没有节点发生变化，请检查原值和作用范围')
      }
      if (result.dns_jobs_failed > 0) {
        toast.warning(
          `${result.dns_jobs_failed} 个节点的 DNS 同步任务提交失败，请稍后在 DNS 管理中重试`
        )
      }
      invalidate()
      setSelected([])
      setBatchReplaceOpen(false)
    },
    onError: handleServerError,
  })

  const batchGroupsMutation = useMutation({
    mutationFn: (payload: {
      mode: 'replace' | 'add' | 'remove'
      group_ids: number[]
    }) => batchUpdateNodeGroups({ ids: selected, ...payload }),
    onSuccess: () => {
      toast.success(`成功调整 ${selected.length} 个节点的权限组`)
      invalidate()
      setSelected([])
      setBatchGroupsOpen(false)
    },
    onError: handleServerError,
  })

  const sortMutation = useMutation({
    mutationFn: (items: Array<{ id: number; order: number }>) =>
      sortNodes(items),
    onSuccess: () => {
      toast.success('排序保存成功')
      setSortMode(false)
      invalidate()
    },
    onError: handleServerError,
  })

  /* ----------------------------- selection ----------------------------- */

  const toggleSelect = (id: number, checked: boolean) =>
    setSelected((s) => (checked ? [...s, id] : s.filter((x) => x !== id)))

  /* ----------------------------- 筛选 ----------------------------- */

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const typeSet = new Set(typeFilter)
    const machineSet = new Set(machineFilter)
    const groupSet = new Set(groupFilter.map(Number))
    const hostSet = new Set(hostFilter)
    const portSet = new Set(portFilter)
    const serverPortSet = new Set(serverPortFilter)
    return nodes.filter((n) => {
      if (typeSet.size > 0 && !typeSet.has(n.type)) return false
      if (hostSet.size > 0 && !hostSet.has(n.host)) return false
      if (portSet.size > 0 && !portSet.has(String(n.port))) return false
      if (
        serverPortSet.size > 0 &&
        !serverPortSet.has(String(n.server_port ?? ''))
      )
        return false
      if (machineSet.size > 0) {
        const key =
          n.machine_id != null ? String(n.machine_id) : '__standalone__'
        if (!machineSet.has(key)) return false
      }
      if (groupSet.size > 0) {
        const gids = n.group_ids ?? []
        if (!gids.some((g) => groupSet.has(g))) return false
      }
      if (kw) {
        const hay =
          `${n.name} ${n.host} ${n.port} ${n.server_port ?? ''} ${SERVER_TYPE_LABEL[n.type] ?? n.type}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [
    nodes,
    keyword,
    typeFilter,
    machineFilter,
    groupFilter,
    hostFilter,
    portFilter,
    serverPortFilter,
  ])

  // 节点ID 排序（非拖拽态生效）
  const sorted = useMemo(() => {
    if (sortMode || !idSort) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => (idSort === 'asc' ? a.id - b.id : b.id - a.id))
    return arr
  }, [filtered, idSort, sortMode])

  // 排序态：以 orderedIds 排序，否则按已筛选/已排序顺序
  const display = useMemo(() => {
    if (!sortMode) return sorted
    const map = new Map(filtered.map((n) => [n.id, n]))
    return orderedIds.map((id) => map.get(id)).filter((n): n is Server => !!n)
  }, [sorted, filtered, sortMode, orderedIds])

  const allSelected =
    display.length > 0 && display.every((n) => selected.includes(n.id))
  const toggleSelectAll = (checked: boolean) =>
    setSelected(checked ? display.map((n) => n.id) : [])

  const enterSortMode = () => {
    setOrderedIds(filtered.map((n) => n.id))
    setPickOrder([])
    setPickMode(true)
    setSortMode(true)
  }

  const onDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) return
    setOrderedIds((ids) => {
      const next = [...ids]
      const from = next.indexOf(dragId)
      const to = next.indexOf(targetId)
      if (from < 0 || to < 0) return ids
      next.splice(from, 1)
      next.splice(to, 0, dragId)
      return next
    })
    setDragId(null)
  }

  // 点选：未编号的行点一下追加序号，已编号的行点一下取消（后续序号自动前移）
  const togglePick = (id: number) =>
    setPickOrder((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    )

  // 已点选的按点击顺序排前面，未点选的保持原顺序跟在后面
  const mergePickOrder = (ids: number[], picks: number[]) => {
    const pickSet = new Set(picks)
    return [...picks, ...ids.filter((id) => !pickSet.has(id))]
  }

  // 点选/拖拽互切：离开点选时先把已点编号落进预览顺序
  const switchSortTool = (pick: boolean) => {
    if (!pick && pickMode && pickOrder.length > 0) {
      setOrderedIds((ids) => mergePickOrder(ids, pickOrder))
    }
    setPickOrder([])
    setPickMode(pick)
  }

  const saveSort = () => {
    const finalIds = pickMode
      ? mergePickOrder(orderedIds, pickOrder)
      : orderedIds
    sortMutation.mutate(finalIds.map((id, idx) => ({ id, order: idx + 1 })))
  }

  // 快速排序预设：只重排排序态的预览顺序（orderedIds），保存前可继续拖拽微调
  type QuickSortKey = 'name' | 'type' | 'rate' | 'id'
  const applyQuickSort = (key: QuickSortKey, dir: 'asc' | 'desc') => {
    const byId = new Map(filtered.map((n) => [n.id, n]))
    const byName = (a: Server, b: Server) =>
      a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true })
    setOrderedIds((ids) => {
      const next = [...ids]
      next.sort((ia, ib) => {
        const a = byId.get(ia)
        const b = byId.get(ib)
        if (!a || !b) return 0
        const r =
          key === 'name'
            ? byName(a, b)
            : key === 'type'
              ? SERVER_TYPES.indexOf(a.type) - SERVER_TYPES.indexOf(b.type) ||
                byName(a, b)
              : key === 'rate'
                ? Number(a.rate) - Number(b.rate) || byName(a, b)
                : a.id - b.id
        return dir === 'asc' ? r : -r
      })
      return next
    })
    setPickOrder([]) // 预设重排覆盖顺序，已点编号作废
  }

  const cycleIdSort = () =>
    setIdSort((s) => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))

  const toggleNodeColumn = (column: NodeTableColumnId) => {
    if (column === 'id' && !nodeColumns.hiddenSet.has(column)) setIdSort(null)
    nodeColumns.toggleColumn(column)
  }
  const resetNodeColumns = () => {
    const resetWillHideId = (
      NODE_TABLE_COLUMNS as readonly TableColumnOption<NodeTableColumnId>[]
    ).some((column) => column.id === 'id' && column.defaultVisible === false)
    if (idSort && resetWillHideId) setIdSort(null)
    nodeColumns.resetColumns()
  }

  const resetFilters = () => {
    setKeyword('')
    setTypeFilter([])
    setMachineFilter([])
    setGroupFilter([])
    setHostFilter([])
    setPortFilter([])
    setServerPortFilter([])
  }

  const hasFilter =
    keyword !== '' ||
    typeFilter.length > 0 ||
    machineFilter.length > 0 ||
    groupFilter.length > 0 ||
    hostFilter.length > 0 ||
    portFilter.length > 0 ||
    serverPortFilter.length > 0

  /* ----------------------------- 筛选选项 ----------------------------- */

  const typeOptions: FacetOption[] = SERVER_TYPES.map((t) => ({
    label: SERVER_TYPE_LABEL[t],
    value: t,
  }))
  const machineOptions: FacetOption[] = [
    { label: '独立部署', value: '__standalone__' },
    ...(machines ?? []).map((m) => ({ label: m.name, value: String(m.id) })),
  ]
  const groupOptions: FacetOption[] = (groups ?? []).map((g) => ({
    label: g.name,
    value: String(g.id),
  }))
  const hostOptions: FacetOption[] = Array.from(
    new Set(nodes.map((node) => node.host))
  )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((value) => ({ label: value, value }))
  const portOptions: FacetOption[] = Array.from(
    new Set(nodes.map((node) => String(node.port)))
  )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((value) => ({ label: value, value }))
  const serverPortOptions: FacetOption[] = Array.from(
    new Set(
      nodes
        .map((node) => node.server_port)
        .filter((value): value is number => value != null)
        .map(String)
    )
  )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((value) => ({ label: value, value }))

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
        <TooltipProvider delayDuration={100}>
          <div className='flex flex-wrap items-end justify-between gap-2'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>节点管理</h2>
              <p className='mt-2 text-muted-foreground'>
                管理所有节点，包括添加、删除、编辑等操作。
              </p>
            </div>
          </div>

          {/* ----------------------------- 工具栏 ----------------------------- */}
          <div className='flex flex-wrap items-center justify-between gap-2'>
            {sortMode ? (
              <p className='text-sm text-muted-foreground'>
                {pickMode
                  ? '按目标顺序依次点击节点行编号，先点的排前面；未点选的保持原顺序跟在后面，再点一次可取消'
                  : '拖拽节点进行排序，完成后点击保存'}
                ，保存后用户订阅将按此顺序输出
                {pickMode && pickOrder.length > 0 && (
                  <>
                    <span className='font-medium text-foreground'>
                      （已点选 {pickOrder.length} 个）
                    </span>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-6 px-2'
                      onClick={() => setPickOrder([])}
                    >
                      清空
                    </Button>
                  </>
                )}
                {hasFilter && (
                  <span className='text-amber-600 dark:text-amber-500'>
                    （当前筛选生效，仅重排筛选出的节点）
                  </span>
                )}
              </p>
            ) : (
              <div className='flex flex-1 flex-wrap items-center gap-2'>
                <Button
                  size='sm'
                  onClick={() => {
                    setCurrent(null)
                    setMutateOpen(true)
                  }}
                >
                  <Plus className='size-4' /> 添加节点
                </Button>
                <div className='relative w-full max-w-xs'>
                  <Search className='absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder='搜索节点...'
                    className='h-8 ps-8'
                  />
                </div>
                <FacetFilter
                  title='类型'
                  options={typeOptions}
                  selected={typeFilter}
                  onChange={setTypeFilter}
                />
                <FacetFilter
                  title='服务器'
                  options={machineOptions}
                  selected={machineFilter}
                  onChange={setMachineFilter}
                  searchPlaceholder='搜索服务器...'
                  emptyText='未找到服务器'
                />
                <FacetFilter
                  title='权限组'
                  options={groupOptions}
                  selected={groupFilter}
                  onChange={setGroupFilter}
                />
                <FacetFilter
                  title='地址'
                  options={hostOptions}
                  selected={hostFilter}
                  onChange={setHostFilter}
                  searchPlaceholder='搜索节点地址...'
                  emptyText='未找到节点地址'
                />
                <FacetFilter
                  title='连接端口'
                  options={portOptions}
                  selected={portFilter}
                  onChange={setPortFilter}
                  searchPlaceholder='搜索连接端口...'
                  emptyText='未找到连接端口'
                />
                <FacetFilter
                  title='服务端口'
                  options={serverPortOptions}
                  selected={serverPortFilter}
                  onChange={setServerPortFilter}
                  searchPlaceholder='搜索服务端口...'
                  emptyText='未找到服务端口'
                />
                <Button
                  variant='outline'
                  size='sm'
                  className='h-8'
                  disabled={nodes.length === 0}
                  onClick={() => setBatchReplaceOpen(true)}
                >
                  <Replace className='size-4' />
                  批量替换
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-8 border-dashed'
                      disabled={selected.length === 0}
                    >
                      <PlusCircledIcon className='size-4' />
                      操作
                      {selected.length > 0 && (
                        <>
                          <Separator
                            orientation='vertical'
                            className='mx-2 h-4'
                          />
                          <Badge
                            variant='secondary'
                            className='rounded-sm px-1 font-normal'
                          >
                            {selected.length}
                          </Badge>
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='start'>
                    <DropdownMenuItem
                      onClick={() =>
                        batchUpdateMutation.mutate({
                          ids: selected,
                          show: 1,
                          successMsg: `成功显示 ${selected.length} 个节点`,
                        })
                      }
                    >
                      显示节点
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        batchUpdateMutation.mutate({
                          ids: selected,
                          show: 0,
                          successMsg: `成功隐藏 ${selected.length} 个节点`,
                        })
                      }
                    >
                      隐藏节点
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        batchUpdateMutation.mutate({
                          ids: selected,
                          enabled: true,
                          successMsg: `成功启用 ${selected.length} 个节点`,
                        })
                      }
                    >
                      启用节点
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        batchUpdateMutation.mutate({
                          ids: selected,
                          enabled: false,
                          successMsg: `成功禁用 ${selected.length} 个节点`,
                        })
                      }
                    >
                      禁用节点
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setBatchGroupsOpen(true)}>
                      调整权限组
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBatchResetOpen(true)}>
                      重置流量
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className='text-destructive'
                      onClick={() => setBatchDeleteOpen(true)}
                    >
                      删除节点
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {hasFilter && (
                  <Button variant='ghost' size='sm' onClick={resetFilters}>
                    重置 <X className='size-4' />
                  </Button>
                )}
              </div>
            )}

            <div className='flex items-center gap-2'>
              {sortMode ? (
                <>
                  <div className='flex items-center rounded-md border p-0.5'>
                    <Button
                      variant={pickMode ? 'secondary' : 'ghost'}
                      size='sm'
                      className='h-7'
                      onClick={() => switchSortTool(true)}
                      disabled={sortMutation.isPending}
                    >
                      <MousePointerClick className='size-4' /> 点选
                    </Button>
                    <Button
                      variant={!pickMode ? 'secondary' : 'ghost'}
                      size='sm'
                      className='h-7'
                      onClick={() => switchSortTool(false)}
                      disabled={sortMutation.isPending}
                    >
                      <GripVertical className='size-4' /> 拖拽
                    </Button>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={sortMutation.isPending}
                      >
                        <ArrowUpDown className='size-4' /> 快速排序
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem
                        onClick={() => applyQuickSort('name', 'asc')}
                      >
                        名称 A→Z
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => applyQuickSort('name', 'desc')}
                      >
                        名称 Z→A
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => applyQuickSort('type', 'asc')}
                      >
                        按协议类型分组
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => applyQuickSort('rate', 'asc')}
                      >
                        倍率 低→高
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => applyQuickSort('rate', 'desc')}
                      >
                        倍率 高→低
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => applyQuickSort('id', 'asc')}
                      >
                        ID 旧→新
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => applyQuickSort('id', 'desc')}
                      >
                        ID 新→旧
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setSortMode(false)}
                    disabled={sortMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    size='sm'
                    onClick={saveSort}
                    disabled={sortMutation.isPending}
                  >
                    <Save className='size-4' /> 保存排序
                  </Button>
                </>
              ) : (
                <>
                  <TableColumnCustomizer
                    columns={NODE_TABLE_COLUMNS}
                    orderedColumns={nodeColumns.orderedColumns}
                    hiddenSet={nodeColumns.hiddenSet}
                    onToggle={toggleNodeColumn}
                    onMove={nodeColumns.moveColumn}
                    onReset={resetNodeColumns}
                  />
                  <Button variant='outline' size='sm' onClick={enterSortMode}>
                    <GripVertical className='size-4' /> 编辑排序
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className='relative overflow-auto rounded-md border bg-card'>
            <Table>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  {sortMode ? (
                    <TableHead className='h-11 w-10 bg-card px-4 text-muted-foreground' />
                  ) : (
                    <TableHead className='h-11 w-10 bg-card px-4 text-muted-foreground'>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(c) => toggleSelectAll(!!c)}
                        aria-label='全选'
                      />
                    </TableHead>
                  )}
                  {(() => {
                    const headerRenderers = {
                      id: () => (
                        <TableHead
                          key='id'
                          className='h-11 w-20 bg-card px-4 text-muted-foreground'
                        >
                          <Button
                            variant='ghost'
                            size='default'
                            className='-ml-3 flex h-8 items-center gap-2 font-medium text-nowrap hover:bg-muted/60'
                            onClick={cycleIdSort}
                            disabled={sortMode}
                          >
                            <span>节点ID</span>
                            {idSort === 'asc' ? (
                              <ArrowUp className='size-4 text-foreground/70' />
                            ) : idSort === 'desc' ? (
                              <ArrowDown className='size-4 text-foreground/70' />
                            ) : (
                              <ChevronsUpDown className='size-4 text-muted-foreground/70 transition-colors hover:text-foreground/70' />
                            )}
                          </Button>
                        </TableHead>
                      ),
                      visibility: () => (
                        <TableHead
                          key='visibility'
                          className='h-11 w-14 bg-card px-4 text-muted-foreground'
                        >
                          <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                            <span>显隐</span>
                          </div>
                        </TableHead>
                      ),
                      name: () => (
                        <TableHead
                          key='name'
                          className='h-11 w-64 bg-card px-4 text-muted-foreground'
                        >
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                                <span>节点</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className='grid grid-cols-1 gap-3 p-2'>
                                <div className='flex items-center space-x-2.5'>
                                  <span className='size-2.5 rounded-full bg-red-500' />
                                  <span className='text-sm font-medium'>
                                    未运行
                                  </span>
                                </div>
                                <div className='flex items-center space-x-2.5'>
                                  <span className='size-2.5 rounded-full bg-amber-500' />
                                  <span className='text-sm font-medium'>
                                    无人使用或异常
                                  </span>
                                </div>
                                <div className='flex items-center space-x-2.5'>
                                  <span className='size-2.5 rounded-full bg-emerald-500' />
                                  <span className='text-sm font-medium'>
                                    运行正常
                                  </span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableHead>
                      ),
                      deployment: () => (
                        <TableHead
                          key='deployment'
                          className='h-11 w-52 bg-card px-4 text-muted-foreground'
                        >
                          <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                            <span>部署方式</span>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <HelpCircle className='size-4 cursor-pointer text-muted-foreground' />
                              </TooltipTrigger>
                              <TooltipContent>
                                查看节点是独立部署，还是由某台服务器托管，并可直接在列表中调整。
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      ),
                      address: () => (
                        <TableHead
                          key='address'
                          className='h-11 w-44 bg-card px-4 text-muted-foreground'
                        >
                          <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                            <span>地址</span>
                          </div>
                        </TableHead>
                      ),
                      online: () => (
                        <TableHead
                          key='online'
                          className='h-11 w-20 bg-card px-4 text-muted-foreground'
                        >
                          <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                            <span>在线人数</span>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <HelpCircle className='size-4 cursor-pointer text-muted-foreground' />
                              </TooltipTrigger>
                              <TooltipContent>
                                在线人数根据服务端上报频率而定
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      ),
                      rate: () => (
                        <TableHead
                          key='rate'
                          className='h-11 w-20 bg-card px-4 text-muted-foreground'
                        >
                          <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                            <span>倍率</span>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <HelpCircle className='size-4 cursor-pointer text-muted-foreground' />
                              </TooltipTrigger>
                              <TooltipContent>流量扣费倍率</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      ),
                      groups: () => (
                        <TableHead
                          key='groups'
                          className='h-11 w-40 bg-card px-4 text-muted-foreground'
                        >
                          <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                            <span>权限组</span>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <HelpCircle className='size-4 cursor-pointer text-muted-foreground' />
                              </TooltipTrigger>
                              <TooltipContent>
                                可订阅到该节点的权限组
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      ),
                      traffic: () => (
                        <TableHead
                          key='traffic'
                          className='h-11 w-32 bg-card px-4 text-muted-foreground'
                        >
                          <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                            <span>流量使用</span>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <HelpCircle className='size-4 cursor-pointer text-muted-foreground' />
                              </TooltipTrigger>
                              <TooltipContent>
                                节点流量使用情况，显示已用流量和限制
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      ),
                    }
                    return renderVisibleColumns(
                      nodeColumns.visibleColumns,
                      headerRenderers
                    )
                  })()}
                  <TableHead className='h-11 w-14 bg-card px-4 text-muted-foreground'>
                    <div className='flex items-center justify-end space-x-1 py-2 font-medium text-nowrap'>
                      <span>操作</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className='animate-fade-in hover:bg-muted/50'>
                    <TableCell
                      colSpan={getTableColumnSpan(nodeColumns.visibleColumns)}
                      className='h-24 bg-card px-4 text-center'
                    >
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : display.length > 0 ? (
                  display.map((n) => {
                    const used = (n.u ?? 0) + (n.d ?? 0)
                    const limit = n.transfer_enable ?? 0
                    const machineName =
                      n.machine_id != null
                        ? machineNameById.get(n.machine_id)
                        : null
                    const dragging = sortMode && !pickMode
                    const pickIdx = pickOrder.indexOf(n.id)
                    return (
                      <TableRow
                        key={n.id}
                        draggable={dragging}
                        onDragStart={() => dragging && setDragId(n.id)}
                        onDragOver={(e) => dragging && e.preventDefault()}
                        onDrop={() => dragging && onDrop(n.id)}
                        onClick={(e) => {
                          if (!sortMode || !pickMode) return
                          // 行内按钮/开关/输入等自身可交互的元素不触发点选
                          const el = e.target as HTMLElement
                          if (
                            el.closest(
                              'button,[role="switch"],[role="checkbox"],[role="menuitem"],a,input,select'
                            )
                          )
                            return
                          togglePick(n.id)
                        }}
                        className={cn(
                          'animate-fade-in hover:bg-muted/50',
                          dragging && dragId === n.id && 'opacity-50',
                          sortMode && pickMode && 'cursor-pointer select-none',
                          sortMode && pickMode && pickIdx >= 0 && 'bg-primary/5'
                        )}
                      >
                        {sortMode ? (
                          <TableCell
                            className={cn(
                              'bg-card px-4',
                              pickMode
                                ? 'cursor-pointer'
                                : 'cursor-grab text-muted-foreground'
                            )}
                          >
                            {pickMode ? (
                              pickIdx >= 0 ? (
                                <span className='flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground'>
                                  {pickIdx + 1}
                                </span>
                              ) : (
                                <span className='block size-5 rounded-full border-2 border-muted-foreground/40' />
                              )
                            ) : (
                              <GripVertical className='size-4' />
                            )}
                          </TableCell>
                        ) : (
                          <TableCell className='bg-card px-4'>
                            <Checkbox
                              checked={selected.includes(n.id)}
                              onCheckedChange={(c) => toggleSelect(n.id, !!c)}
                              aria-label={`选择 ${n.name}`}
                            />
                          </TableCell>
                        )}
                        {(() => {
                          const cellRenderers = {
                            id: () => (
                              <TableCell key='id' className='bg-card px-4'>
                                {(() => {
                                  const isChild = !!n.parent_id // parent_id 为 0/null 均表示无父节点
                                  return (
                                    <Tooltip delayDuration={100}>
                                      <TooltipTrigger asChild>
                                        <div className='group/id flex items-center space-x-2'>
                                          <Badge
                                            variant='outline'
                                            className='flex items-center gap-1.5 border-2 font-medium transition-all duration-200 hover:opacity-80'
                                            style={{
                                              borderColor:
                                                SERVER_TYPE_COLOR[n.type],
                                            }}
                                          >
                                            <ServerIcon className='size-3' />
                                            <span className='flex items-center gap-1'>
                                              <span className='flex items-center gap-0.5'>
                                                {n.code ?? n.id}
                                              </span>
                                              {isChild ? (
                                                <>
                                                  <span className='text-sm text-muted-foreground/30'>
                                                    →
                                                  </span>
                                                  <span>
                                                    {n.parent?.code ??
                                                      n.parent?.id ??
                                                      n.parent_id}
                                                  </span>
                                                </>
                                              ) : null}
                                            </span>
                                          </Badge>
                                          <Button
                                            variant='ghost'
                                            size='icon'
                                            className='size-5 text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover/id:opacity-100 hover:text-muted-foreground'
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              navigator.clipboard
                                                ?.writeText(
                                                  n.code || n.id.toString()
                                                )
                                                .then(() =>
                                                  toast.success('复制成功')
                                                )
                                            }}
                                          >
                                            <Copy className='size-3' />
                                          </Button>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side='top'
                                        className='flex flex-col gap-2 p-3'
                                      >
                                        <p className='font-medium'>
                                          {SERVER_TYPE_LABEL[n.type] ?? n.type}
                                          {isChild ? ' (子节点)' : ''}
                                        </p>
                                        <div className='mt-1 grid gap-1.5'>
                                          <div className='flex items-center gap-3'>
                                            <span className='text-xs text-muted-foreground'>
                                              自定义ID
                                            </span>
                                            <span className='max-w-[120px] truncate font-mono text-xs font-medium'>
                                              {n.code ?? '—'}
                                            </span>
                                          </div>
                                          <div className='flex items-center gap-3'>
                                            <span className='text-xs text-muted-foreground'>
                                              原始ID
                                            </span>
                                            <span className='font-mono text-xs font-semibold'>
                                              {n.id}
                                            </span>
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                })()}
                              </TableCell>
                            ),
                            visibility: () => (
                              <TableCell
                                key='visibility'
                                className='bg-card px-4'
                              >
                                <Switch
                                  checked={!!n.show}
                                  disabled={sortMode}
                                  onCheckedChange={(c) =>
                                    toggleMutation.mutate({
                                      id: n.id,
                                      show: c ? 1 : 0,
                                    })
                                  }
                                  aria-label='显隐'
                                  style={
                                    n.show
                                      ? {
                                          backgroundColor:
                                            SERVER_TYPE_COLOR[n.type],
                                        }
                                      : undefined
                                  }
                                />
                              </TableCell>
                            ),
                            name: () => (
                              <TableCell
                                key='name'
                                className='bg-card px-4 font-medium'
                              >
                                <div className='flex items-center space-x-2.5 outline-none'>
                                  <Tooltip delayDuration={100}>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={cn(
                                          'size-2.5 shrink-0 cursor-pointer rounded-full shadow-sm transition-all duration-200',
                                          n.available_status === 2
                                            ? 'bg-emerald-500/80 shadow-emerald-500/50'
                                            : n.available_status === 1
                                              ? 'bg-yellow-500/80 shadow-yellow-500/50'
                                              : 'bg-destructive/80 shadow-destructive/50'
                                        )}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side='top'
                                      align='center'
                                      sideOffset={10}
                                    >
                                      {n.available_status === 2
                                        ? '运行正常'
                                        : n.available_status === 1
                                          ? '无人使用或异常'
                                          : '未运行'}
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className='cursor-default text-left font-medium whitespace-nowrap transition-colors hover:text-primary'>
                                    {n.name}
                                  </span>
                                  {n.parent_id ? (
                                    <Badge
                                      variant='outline'
                                      className='shrink-0 px-1.5 py-0 text-[10px] font-normal'
                                    >
                                      子节点
                                    </Badge>
                                  ) : null}
                                </div>
                              </TableCell>
                            ),
                            deployment: () => (
                              <TableCell
                                key='deployment'
                                className='bg-card px-4'
                              >
                                <div className='flex items-center gap-1.5 px-1'>
                                  {n.machine_id != null ? (
                                    (() => {
                                      const mc = machineById.get(n.machine_id)
                                      const mOnline = mc
                                        ? isOnline(mc.last_seen_at)
                                        : false
                                      return (
                                        <div className='flex min-w-0 flex-1 items-center gap-1.5 text-xs'>
                                          <span
                                            className={cn(
                                              'size-2 shrink-0 rounded-full',
                                              mOnline
                                                ? 'bg-emerald-500'
                                                : 'bg-rose-500'
                                            )}
                                          />
                                          <span className='truncate text-xs font-medium'>
                                            {machineName ?? `#${n.machine_id}`}
                                          </span>
                                          <Badge
                                            variant='outline'
                                            className={cn(
                                              'shrink-0 px-1.5 py-0 text-[10px] font-normal',
                                              mOnline
                                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                : 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                            )}
                                          >
                                            {mOnline
                                              ? '服务器在线'
                                              : '服务器离线'}
                                          </Badge>
                                          {!n.enabled && (
                                            <Badge
                                              variant='secondary'
                                              className='shrink-0 px-1.5 py-0 text-[10px] font-normal'
                                            >
                                              节点停用
                                            </Badge>
                                          )}
                                        </div>
                                      )
                                    })()
                                  ) : (
                                    <div className='flex min-w-0 flex-1 items-center gap-1.5'>
                                      <ServerIcon className='size-3.5 shrink-0 text-muted-foreground' />
                                      <span className='truncate text-xs font-medium text-foreground'>
                                        独立部署
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            ),
                            address: () => (
                              <TableCell key='address' className='bg-card px-4'>
                                <div className='group relative flex min-w-0 items-start'>
                                  <div className='flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 pr-7'>
                                    <div className='flex items-center'>
                                      <span className='font-mono text-sm font-medium text-foreground/90'>
                                        {n.host}:{n.port}
                                      </span>
                                    </div>
                                    {n.server_port != null &&
                                      n.server_port !== n.port && (
                                        <span className='text-[0.7rem] tracking-tight whitespace-nowrap text-muted-foreground/40'>
                                          (内部端口 {n.server_port})
                                        </span>
                                      )}
                                  </div>
                                  <div className='absolute top-0 right-0'>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      className='size-6 text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-muted/50 hover:text-muted-foreground'
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigator.clipboard
                                          ?.writeText(`${n.host}:${n.port}`)
                                          .then(() => toast.success('复制成功'))
                                      }}
                                    >
                                      <Copy className='size-3' />
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            ),
                            online: () => (
                              <TableCell key='online' className='bg-card px-4'>
                                <div className='flex items-center space-x-2 px-4'>
                                  <User className='size-4' />
                                  <span className='font-medium'>
                                    {n.online ?? 0}
                                  </span>
                                </div>
                              </TableCell>
                            ),
                            rate: () => (
                              <TableCell key='rate' className='bg-card px-4'>
                                <Badge
                                  variant='secondary'
                                  className='font-medium'
                                >
                                  {n.rate} x
                                </Badge>
                              </TableCell>
                            ),
                            groups: () => (
                              <TableCell key='groups' className='bg-card px-4'>
                                <div className='flex flex-nowrap items-center gap-1.5'>
                                  {(n.groups ?? []).length > 0 ? (
                                    (n.groups ?? []).map((g) => (
                                      <Badge
                                        key={g.id}
                                        variant='secondary'
                                        className='flex cursor-default items-center gap-1.5 border border-border/50 bg-secondary/50 px-2 py-0.5 font-medium whitespace-nowrap transition-all duration-200 select-none hover:bg-secondary/70'
                                      >
                                        {g.name}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className='text-sm text-muted-foreground'>
                                      --
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            ),
                            traffic: () => (
                              <TableCell key='traffic' className='bg-card px-4'>
                                {(() => {
                                  const usedStr = formatBytes(used)
                                  const totalStr = formatBytes(limit)
                                  if (limit <= 0)
                                    return (
                                      <div className='text-sm text-muted-foreground'>
                                        {usedStr}
                                      </div>
                                    )
                                  const pct = Math.min(
                                    (used / limit) * 100,
                                    100
                                  )
                                  return (
                                    <Tooltip delayDuration={100}>
                                      <TooltipTrigger>
                                        <div className='flex items-center gap-2'>
                                          <div className='h-1.5 w-12 rounded-full bg-secondary'>
                                            <div
                                              className={cn(
                                                'h-full rounded-full transition-all',
                                                pct > 90
                                                  ? 'bg-destructive'
                                                  : 'bg-primary'
                                              )}
                                              style={{ width: `${pct}%` }}
                                            />
                                          </div>
                                          <span className='text-xs text-muted-foreground tabular-nums'>
                                            {usedStr}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side='bottom'>
                                        <div className='space-y-1 text-sm'>
                                          <p>已用: {usedStr}</p>
                                          <p>总流量: {totalStr}</p>
                                          <p>使用率: {pct.toFixed(1)}%</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                })()}
                              </TableCell>
                            ),
                          }
                          return renderVisibleColumns(
                            nodeColumns.visibleColumns,
                            cellRenderers
                          )
                        })()}
                        <TableCell className='bg-card px-4'>
                          <div className='flex justify-center'>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant='ghost'
                                  className='h-8 w-8 p-0 hover:bg-muted'
                                  disabled={sortMode}
                                  aria-label='操作'
                                >
                                  <MoreHorizontal className='size-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end' className='w-40'>
                                <DropdownMenuItem
                                  className='cursor-pointer'
                                  onClick={() => {
                                    setCurrent(n)
                                    setMutateOpen(true)
                                  }}
                                >
                                  <Pencil className='mr-2 size-4' /> 编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className='cursor-pointer'
                                  onClick={() => copyMutation.mutate(n.id)}
                                >
                                  <Copy className='mr-2 size-4' /> 复制
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className='cursor-pointer'
                                  onClick={() => setInstallNode(n)}
                                >
                                  <Terminal className='mr-2 size-4' /> 安装命令
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className='cursor-pointer'
                                  onClick={() => setResetting(n)}
                                >
                                  <RotateCcw className='mr-2 size-4' /> 重置流量
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className='cursor-pointer text-destructive focus:text-destructive'
                                  onClick={() => setDeleting(n)}
                                >
                                  <Trash2 className='mr-2 size-4' /> 删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow className='animate-fade-in hover:bg-muted/50'>
                    <TableCell
                      colSpan={getTableColumnSpan(nodeColumns.visibleColumns)}
                      className='h-24 bg-card px-4 text-center'
                    >
                      暂无节点
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
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
        title='确认删除'
        desc={`此操作将永久删除节点「${deleting?.name}」，删除后无法恢复。确定要继续吗？`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title='确认重置流量'
        desc='此操作将清零该节点的上传和下载流量，并解除禁用状态。确定要继续吗？'
        confirmText='重置流量'
        isLoading={resetMutation.isPending}
        handleConfirm={() => resetting && resetMutation.mutate(resetting.id)}
      />

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title='确认批量删除'
        desc={`确定要删除选中的 ${selected.length} 个节点吗？此操作不可恢复。`}
        confirmText='确认删除'
        destructive
        isLoading={batchDeleteMutation.isPending}
        handleConfirm={() => batchDeleteMutation.mutate(selected)}
      />

      <BatchGroupsDialog
        open={batchGroupsOpen}
        onOpenChange={setBatchGroupsOpen}
        count={selected.length}
        options={groupOptions}
        isLoading={batchGroupsMutation.isPending}
        onConfirm={(payload) => batchGroupsMutation.mutate(payload)}
      />

      {batchReplaceOpen && (
        <BatchReplaceDialog
          open
          onOpenChange={setBatchReplaceOpen}
          nodes={nodes}
          filteredIds={filtered.map((node) => node.id)}
          selectedIds={selected}
          isLoading={batchReplaceMutation.isPending}
          onConfirm={(payload) => batchReplaceMutation.mutate(payload)}
        />
      )}

      <ConfirmDialog
        open={batchResetOpen}
        onOpenChange={setBatchResetOpen}
        title='确认批量重置流量'
        desc={`确定要重置选中的 ${selected.length} 个节点的流量吗？此操作将清零流量并解除禁用状态。`}
        confirmText='确认重置'
        isLoading={batchResetMutation.isPending}
        handleConfirm={() => batchResetMutation.mutate(selected)}
      />
    </>
  )
}
