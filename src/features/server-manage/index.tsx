import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusCircledIcon, CheckIcon } from '@radix-ui/react-icons'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
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
import { cn } from '@/lib/utils'
import { handleServerError } from '@/lib/handle-server-error'
import { formatBytes } from '@/features/dashboard/format'
import { fetchServerGroups } from '@/features/server-group/api'
import { fetchMachines } from '@/features/server-machine/api'
import { isOnline } from '@/features/server-machine/format'
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
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  SERVER_TYPES,
  SERVER_TYPE_COLOR,
  SERVER_TYPE_LABEL,
  type Server,
  batchDeleteNodes,
  batchResetTraffic,
  batchUpdateNodes,
  copyNode,
  dropNode,
  getNodes,
  resetTraffic,
  sortNodes,
  updateNode,
} from './api'
import { InstallCommandDialog } from './components/install-command-dialog'
import { NodeMutateDialog } from './components/node-mutate-dialog'

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
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className='text-background size-4' />
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
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Server | null>(null)
  const [deleting, setDeleting] = useState<Server | null>(null)
  const [resetting, setResetting] = useState<Server | null>(null)
  const [installNode, setInstallNode] = useState<Server | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchResetOpen, setBatchResetOpen] = useState(false)

  // 筛选（胶囊多选）
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [machineFilter, setMachineFilter] = useState<string[]>([])
  const [groupFilter, setGroupFilter] = useState<string[]>([])

  // 节点ID 排序（点击表头）
  const [idSort, setIdSort] = useState<'asc' | 'desc' | null>(null)

  // 排序编辑态（拖拽）
  const [sortMode, setSortMode] = useState(false)
  const [orderedIds, setOrderedIds] = useState<number[]>([])
  const [dragId, setDragId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['nodes'], queryFn: getNodes })
  const { data: groups } = useQuery({
    queryKey: ['server-groups'],
    queryFn: fetchServerGroups,
  })
  const { data: machines } = useQuery({
    queryKey: ['server-machines'],
    queryFn: fetchMachines,
  })

  const nodes = data ?? []

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

  // 作为其它节点 parent 的节点 id 集合（用于子父关系着色）
  const parentIds = useMemo(
    () => new Set(nodes.map((n) => n.parent_id).filter((x): x is number => !!x)),
    [nodes]
  )

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
    return nodes.filter((n) => {
      if (typeSet.size > 0 && !typeSet.has(n.type)) return false
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
          `${n.name} ${n.host} ${SERVER_TYPE_LABEL[n.type] ?? n.type}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [nodes, keyword, typeFilter, machineFilter, groupFilter])

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
    return orderedIds
      .map((id) => map.get(id))
      .filter((n): n is Server => !!n)
  }, [sorted, filtered, sortMode, orderedIds])

  const allSelected =
    display.length > 0 && display.every((n) => selected.includes(n.id))
  const toggleSelectAll = (checked: boolean) =>
    setSelected(checked ? display.map((n) => n.id) : [])

  const enterSortMode = () => {
    setOrderedIds(filtered.map((n) => n.id))
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

  const saveSort = () =>
    sortMutation.mutate(orderedIds.map((id, idx) => ({ id, order: idx + 1 })))

  const cycleIdSort = () =>
    setIdSort((s) => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))

  const resetFilters = () => {
    setKeyword('')
    setTypeFilter([])
    setMachineFilter([])
    setGroupFilter([])
  }

  const hasFilter =
    keyword !== '' ||
    typeFilter.length > 0 ||
    machineFilter.length > 0 ||
    groupFilter.length > 0

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
              管理所有节点，包括添加、删除、编辑等操作。
            </p>
          </div>
        </div>

        {/* ----------------------------- 工具栏 ----------------------------- */}
        <div className='flex flex-wrap items-center justify-between gap-2'>
          {sortMode ? (
            <p className='text-muted-foreground text-sm'>
              拖拽节点进行排序，完成后点击保存
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
                <Search className='text-muted-foreground absolute start-2 top-1/2 size-4 -translate-y-1/2' />
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
              <Button variant='outline' size='sm' onClick={enterSortMode}>
                <GripVertical className='size-4' /> 编辑排序
              </Button>
            )}
          </div>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                {sortMode ? (
                  <TableHead className='w-10' />
                ) : (
                  <TableHead className='w-10'>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(c) => toggleSelectAll(!!c)}
                      aria-label='全选'
                    />
                  </TableHead>
                )}
                <TableHead className='w-20'>
                  <button
                    type='button'
                    className='-ms-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground disabled:cursor-default'
                    onClick={cycleIdSort}
                    disabled={sortMode}
                  >
                    节点ID
                    {idSort === 'asc' ? (
                      <ArrowUp className='size-3.5' />
                    ) : idSort === 'desc' ? (
                      <ArrowDown className='size-3.5' />
                    ) : (
                      <ChevronsUpDown className='size-3.5 opacity-50' />
                    )}
                  </button>
                </TableHead>
                <TableHead className='w-14'>显隐</TableHead>
                <TableHead className='w-64'>节点</TableHead>
                <TableHead className='w-52'>
                  <Tooltip>
                    <TooltipTrigger>部署方式</TooltipTrigger>
                    <TooltipContent>
                      查看节点是独立部署，还是由某台服务器托管
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className='w-44'>地址</TableHead>
                <TableHead className='w-20'>
                  <Tooltip>
                    <TooltipTrigger>在线人数</TooltipTrigger>
                    <TooltipContent>
                      在线人数根据服务端上报频率而定
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className='w-20'>
                  <Tooltip>
                    <TooltipTrigger>倍率</TooltipTrigger>
                    <TooltipContent>流量扣费倍率</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className='w-40'>权限组</TableHead>
                <TableHead className='w-32'>
                  <Tooltip>
                    <TooltipTrigger>流量使用</TooltipTrigger>
                    <TooltipContent>
                      节点流量使用情况，显示已用流量和限制
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className='w-14 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className='h-24 text-center'>
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
                  return (
                    <TableRow
                      key={n.id}
                      draggable={sortMode}
                      onDragStart={() => sortMode && setDragId(n.id)}
                      onDragOver={(e) => sortMode && e.preventDefault()}
                      onDrop={() => sortMode && onDrop(n.id)}
                      className={
                        sortMode && dragId === n.id ? 'opacity-50' : undefined
                      }
                    >
                      {sortMode ? (
                        <TableCell className='text-muted-foreground cursor-grab'>
                          <GripVertical className='size-4' />
                        </TableCell>
                      ) : (
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(n.id)}
                            onCheckedChange={(c) => toggleSelect(n.id, !!c)}
                            aria-label={`选择 ${n.name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {(() => {
                          const isChild = !!n.parent_id // parent_id 为 0/null 均表示无父节点
                          const related = isChild || parentIds.has(n.id)
                          return (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs',
                                related
                                  ? 'border-violet-400 text-violet-600 dark:border-violet-500 dark:text-violet-400'
                                  : 'text-muted-foreground'
                              )}
                              title={
                                isChild
                                  ? `子节点（父节点 #${n.parent_id}）`
                                  : parentIds.has(n.id)
                                    ? '父节点'
                                    : undefined
                              }
                            >
                              <ServerIcon className='size-3.5' />
                              {isChild ? `${n.id} → ${n.parent_id}` : n.id}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!n.show}
                          disabled={sortMode}
                          onCheckedChange={(c) =>
                            toggleMutation.mutate({ id: n.id, show: c ? 1 : 0 })
                          }
                          aria-label='显隐'
                          style={
                            n.show
                              ? { backgroundColor: SERVER_TYPE_COLOR[n.type] }
                              : undefined
                          }
                        />
                      </TableCell>
                      <TableCell className='font-medium'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <span
                            className={cn(
                              'inline-block size-2 shrink-0 rounded-full',
                              n.available_status === 2
                                ? 'bg-emerald-500'
                                : n.available_status === 1
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            )}
                            title={
                              n.available_status === 2
                                ? '在线'
                                : n.available_status === 1
                                  ? '在线（无推送）'
                                  : '离线'
                            }
                          />
                          <span>{n.name}</span>
                          <Badge variant='secondary'>
                            {SERVER_TYPE_LABEL[n.type] ?? n.type}
                          </Badge>
                          {n.parent_id ? (
                            <Badge variant='outline'>子节点</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {n.machine_id != null ? (
                          (() => {
                            const mc = machineById.get(n.machine_id)
                            const mOnline = mc
                              ? isOnline(mc.last_seen_at)
                              : false
                            return (
                              <div className='flex items-center gap-1.5'>
                                <span
                                  className={cn(
                                    'inline-block size-2 shrink-0 rounded-full',
                                    mOnline ? 'bg-emerald-500' : 'bg-red-500'
                                  )}
                                />
                                <span className='truncate text-sm'>
                                  {machineName ?? `#${n.machine_id}`}
                                </span>
                                <Badge
                                  variant='secondary'
                                  className={cn(
                                    'shrink-0',
                                    mOnline
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-600 dark:text-red-400'
                                  )}
                                >
                                  {mOnline ? '服务器在线' : '服务器离线'}
                                </Badge>
                              </div>
                            )
                          })()
                        ) : (
                          <span className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                            <ServerIcon className='size-4' /> 独立部署
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='max-w-[11rem] truncate'>
                        {n.host}:{n.port}
                        {n.server_port != null && (
                          <span className='text-muted-foreground ms-1 text-xs'>
                            (内部端口) {n.server_port}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className='flex items-center gap-1'>
                          <User className='text-muted-foreground size-3.5' />
                          {n.online ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>{n.rate}</TableCell>
                      <TableCell>
                        <div className='flex flex-wrap gap-1'>
                          {(n.groups ?? []).length > 0 ? (
                            (n.groups ?? []).map((g) => (
                              <Badge key={g.id} variant='outline'>
                                {g.name}
                              </Badge>
                            ))
                          ) : (
                            <span className='text-muted-foreground'>--</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className='text-sm'>{formatBytes(used)}</span>
                        {limit > 0 && (
                          <span className='text-muted-foreground text-xs'>
                            {' / '}
                            {formatBytes(limit)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-end'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              disabled={sortMode}
                            >
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
                  )
                })
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
