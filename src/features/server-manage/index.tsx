import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusCircledIcon, CheckIcon } from '@radix-ui/react-icons'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  GripVertical,
  HelpCircle,
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
  TooltipProvider,
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
        <TooltipProvider delayDuration={100}>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>节点管理</h2>
            <p className='text-muted-foreground mt-2'>
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

        <div className='bg-card relative overflow-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                {sortMode ? (
                  <TableHead className='bg-card text-muted-foreground h-11 w-10 px-4' />
                ) : (
                  <TableHead className='bg-card text-muted-foreground h-11 w-10 px-4'>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(c) => toggleSelectAll(!!c)}
                      aria-label='全选'
                    />
                  </TableHead>
                )}
                <TableHead className='bg-card text-muted-foreground h-11 w-20 px-4'>
                  <Button
                    variant='ghost'
                    size='default'
                    className='hover:bg-muted/60 -ml-3 flex h-8 items-center gap-2 font-medium text-nowrap'
                    onClick={cycleIdSort}
                    disabled={sortMode}
                  >
                    <span>节点ID</span>
                    {idSort === 'asc' ? (
                      <ArrowUp className='text-foreground/70 size-4' />
                    ) : idSort === 'desc' ? (
                      <ArrowDown className='text-foreground/70 size-4' />
                    ) : (
                      <ChevronsUpDown className='text-muted-foreground/70 hover:text-foreground/70 size-4 transition-colors' />
                    )}
                  </Button>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-14 px-4'>
                  <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                    <span>显隐</span>
                  </div>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-64 px-4'>
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
                          <span className='text-sm font-medium'>未运行</span>
                        </div>
                        <div className='flex items-center space-x-2.5'>
                          <span className='size-2.5 rounded-full bg-amber-500' />
                          <span className='text-sm font-medium'>
                            无人使用或异常
                          </span>
                        </div>
                        <div className='flex items-center space-x-2.5'>
                          <span className='size-2.5 rounded-full bg-emerald-500' />
                          <span className='text-sm font-medium'>运行正常</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-52 px-4'>
                  <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                    <span>部署方式</span>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <HelpCircle className='text-muted-foreground size-4 cursor-pointer' />
                      </TooltipTrigger>
                      <TooltipContent>
                        查看节点是独立部署，还是由某台服务器托管，并可直接在列表中调整。
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-44 px-4'>
                  <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                    <span>地址</span>
                  </div>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-20 px-4'>
                  <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                    <span>在线人数</span>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <HelpCircle className='text-muted-foreground size-4 cursor-pointer' />
                      </TooltipTrigger>
                      <TooltipContent>
                        在线人数根据服务端上报频率而定
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-20 px-4'>
                  <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                    <span>倍率</span>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <HelpCircle className='text-muted-foreground size-4 cursor-pointer' />
                      </TooltipTrigger>
                      <TooltipContent>流量扣费倍率</TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-40 px-4'>
                  <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                    <span>权限组</span>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <HelpCircle className='text-muted-foreground size-4 cursor-pointer' />
                      </TooltipTrigger>
                      <TooltipContent>可订阅到该节点的权限组</TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-32 px-4'>
                  <div className='flex items-center space-x-1 py-2 font-medium text-nowrap'>
                    <span>流量使用</span>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <HelpCircle className='text-muted-foreground size-4 cursor-pointer' />
                      </TooltipTrigger>
                      <TooltipContent>
                        节点流量使用情况，显示已用流量和限制
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className='bg-card text-muted-foreground h-11 w-14 px-4'>
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
                    colSpan={11}
                    className='bg-card h-24 px-4 text-center'
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
                  return (
                    <TableRow
                      key={n.id}
                      draggable={sortMode}
                      onDragStart={() => sortMode && setDragId(n.id)}
                      onDragOver={(e) => sortMode && e.preventDefault()}
                      onDrop={() => sortMode && onDrop(n.id)}
                      className={cn(
                        'animate-fade-in hover:bg-muted/50',
                        sortMode && dragId === n.id && 'opacity-50'
                      )}
                    >
                      {sortMode ? (
                        <TableCell className='bg-card text-muted-foreground cursor-grab px-4'>
                          <GripVertical className='size-4' />
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
                      <TableCell className='bg-card px-4'>
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
                                      borderColor: SERVER_TYPE_COLOR[n.type],
                                    }}
                                  >
                                    <ServerIcon className='size-3' />
                                    <span className='flex items-center gap-1'>
                                      <span className='flex items-center gap-0.5'>
                                        {n.code ?? n.id}
                                      </span>
                                      {isChild ? (
                                        <>
                                          <span className='text-muted-foreground/30 text-sm'>
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
                                    className='text-muted-foreground/40 hover:text-muted-foreground group-hover/id:opacity-100 size-5 opacity-0 transition-all duration-200'
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigator.clipboard
                                        ?.writeText(
                                          n.code || n.id.toString()
                                        )
                                        .then(() => toast.success('复制成功'))
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
                                    <span className='text-muted-foreground text-xs'>
                                      自定义ID
                                    </span>
                                    <span className='max-w-[120px] truncate font-mono text-xs font-medium'>
                                      {n.code ?? '—'}
                                    </span>
                                  </div>
                                  <div className='flex items-center gap-3'>
                                    <span className='text-muted-foreground text-xs'>
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
                      <TableCell className='bg-card px-4'>
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
                      <TableCell className='bg-card px-4 font-medium'>
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
                            <TooltipContent side='top' align='center' sideOffset={10}>
                              {n.available_status === 2
                                ? '运行正常'
                                : n.available_status === 1
                                  ? '无人使用或异常'
                                  : '未运行'}
                            </TooltipContent>
                          </Tooltip>
                          <span className='hover:text-primary cursor-default text-left font-medium transition-colors'>
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
                      <TableCell className='bg-card px-4'>
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
                                      mOnline ? 'bg-emerald-500' : 'bg-rose-500'
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
                                    {mOnline ? '服务器在线' : '服务器离线'}
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
                              <ServerIcon className='text-muted-foreground size-3.5 shrink-0' />
                              <span className='text-foreground truncate text-xs font-medium'>
                                独立部署
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='bg-card px-4'>
                        <div className='group relative flex min-w-0 items-start'>
                          <div className='flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 pr-7'>
                            <div className='flex items-center'>
                              <span className='text-foreground/90 font-mono text-sm font-medium'>
                                {n.host}:{n.port}
                              </span>
                            </div>
                            {n.server_port != null &&
                              n.server_port !== n.port && (
                                <span className='text-muted-foreground/40 text-[0.7rem] tracking-tight whitespace-nowrap'>
                                  (内部端口 {n.server_port})
                                </span>
                              )}
                          </div>
                          <div className='absolute top-0 right-0'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground/40 hover:bg-muted/50 hover:text-muted-foreground group-hover:opacity-100 size-6 opacity-0 transition-all duration-200'
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
                      <TableCell className='bg-card px-4'>
                        <div className='flex items-center space-x-2 px-4'>
                          <User className='size-4' />
                          <span className='font-medium'>{n.online ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className='bg-card px-4'>
                        <Badge variant='secondary' className='font-medium'>
                          {n.rate} x
                        </Badge>
                      </TableCell>
                      <TableCell className='bg-card px-4'>
                        <div className='flex flex-wrap gap-1.5'>
                          {(n.groups ?? []).length > 0 ? (
                            (n.groups ?? []).map((g) => (
                              <Badge
                                key={g.id}
                                variant='secondary'
                                className='bg-secondary/50 hover:bg-secondary/70 border-border/50 flex cursor-default items-center gap-1.5 border px-2 py-0.5 font-medium transition-all duration-200 select-none'
                              >
                                {g.name}
                              </Badge>
                            ))
                          ) : (
                            <span className='text-muted-foreground text-sm'>
                              --
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='bg-card px-4'>
                        {(() => {
                          const usedStr = formatBytes(used)
                          const totalStr = formatBytes(limit)
                          if (limit <= 0)
                            return (
                              <div className='text-muted-foreground text-sm'>
                                {usedStr}
                              </div>
                            )
                          const pct = Math.min((used / limit) * 100, 100)
                          return (
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger>
                                <div className='flex items-center gap-2'>
                                  <div className='bg-secondary h-1.5 w-12 rounded-full'>
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all',
                                        pct > 90 ? 'bg-destructive' : 'bg-primary'
                                      )}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className='text-muted-foreground text-xs tabular-nums'>
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
                      <TableCell className='bg-card px-4'>
                        <div className='flex justify-center'>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='ghost'
                                className='hover:bg-muted h-8 w-8 p-0'
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
                                className='text-destructive focus:text-destructive cursor-pointer'
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
                    colSpan={11}
                    className='bg-card h-24 px-4 text-center'
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
