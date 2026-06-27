import { useEffect, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  Server,
  ServerOff,
  CircleCheck,
  TriangleAlert,
  Layers,
  Cpu,
  MemoryStick,
  HardDrive,
  Eye,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleServerError } from '@/lib/handle-server-error'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table'
import { DataTableFacetedFilter } from '@/components/data-table/faceted-filter'
import {
  type Machine,
  type MachineCreateResult,
  dropMachine,
  fetchMachines,
} from './api'
import {
  fmtAgo,
  fmtBytes,
  isHighLoad,
  isOnline,
  pct,
  readLoad,
} from './format'
import { InstallCommandDialog } from './components/install-command-dialog'
import { MachineDetailDrawer } from './components/machine-detail-drawer'
import { MachineMutateDialog } from './components/machine-mutate-dialog'

type SecretDialog = {
  title: string
  description?: string
  fields: { label: string; value: string; mono?: boolean }[]
}

type MachineStatus = 'online' | 'offline' | 'inactive' | 'never'

/** 机器状态判定（对齐原版 g5t）。 */
function machineStatus(m: Machine): MachineStatus {
  if (!(m.is_active === true || m.is_active === 1)) return 'inactive'
  if (!m.last_seen_at) return 'never'
  return isOnline(m.last_seen_at) ? 'online' : 'offline'
}

/** 状态配色（对齐原版 u5t）。 */
const STATUS_STYLE: Record<MachineStatus, { dot: string; card: string }> = {
  online: {
    dot: 'bg-emerald-500',
    card: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  offline: {
    dot: 'bg-red-500',
    card: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  inactive: { dot: 'bg-slate-400', card: 'bg-muted text-muted-foreground' },
  never: {
    dot: 'bg-slate-400',
    card: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
}

function isMachineHighLoad(m: Machine): boolean {
  return isHighLoad(readLoad(m.load_status))
}

/** 负载阈值（与原版一致）。 */
const LOAD_THRESHOLDS = {
  cpu: { warn: 70, danger: 85 },
  mem: { warn: 75, danger: 90 },
  disk: { warn: 80, danger: 90 },
} as const

function loadTone(label: keyof typeof LOAD_THRESHOLDS, percent: number) {
  const t = LOAD_THRESHOLDS[label]
  if (percent >= t.danger) return 'bg-red-500'
  if (percent >= t.warn) return 'bg-amber-500'
  return 'bg-primary'
}

/** 概览统计条单元（对齐原版 j3t）。 */
function OverviewBar({ machines }: { machines: Machine[] }) {
  const total = machines.length
  let online = 0
  let offline = 0
  let high = 0
  let nodes = 0
  machines.forEach((m) => {
    const s = machineStatus(m)
    if (s === 'online') online++
    if (s === 'offline') offline++
    if (isMachineHighLoad(m)) high++
    nodes += m.servers_count ?? 0
  })
  const items: {
    key: string
    label: string
    value: number
    icon: React.ComponentType<{ className?: string }>
    tone: string
  }[] = [
    {
      key: 'total',
      label: '服务器总数',
      value: total,
      icon: Server,
      tone: 'bg-primary/10 text-primary',
    },
    {
      key: 'online',
      label: '在线服务器',
      value: online,
      icon: CircleCheck,
      tone: STATUS_STYLE.online.card,
    },
    {
      key: 'offline',
      label: '离线/失联',
      value: offline,
      icon: ServerOff,
      tone: offline > 0 ? STATUS_STYLE.offline.card : STATUS_STYLE.online.card,
    },
    {
      key: 'highLoad',
      label: '高负载',
      value: high,
      icon: TriangleAlert,
      tone:
        high > 0
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-muted text-muted-foreground',
    },
    {
      key: 'hostedNodes',
      label: '节点数',
      value: nodes,
      icon: Layers,
      tone: 'bg-muted text-muted-foreground',
    },
  ]
  return (
    <div className='flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-sm'>
      {items.map((it) => {
        const Icon = it.icon
        return (
          <div
            key={it.key}
            className='flex min-w-[130px] flex-1 items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2'
          >
            <div className='min-w-0'>
              <p className='text-[11px] uppercase tracking-wide text-muted-foreground'>
                {it.label}
              </p>
              <div className='mt-1 text-xl font-semibold leading-none'>
                {it.value}
              </div>
            </div>
            <Badge
              variant='secondary'
              className={cn('border-0 px-2 py-1', it.tone)}
            >
              <Icon className='size-3.5' />
            </Badge>
          </div>
        )
      })}
    </div>
  )
}

/** 负载小条（对齐原版 l3t）。 */
function LoadBar({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode
  label: keyof typeof LOAD_THRESHOLDS
  value: number
  percent: number
}) {
  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between gap-2'>
        <span className='flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground'>
          {icon}
          {label}
        </span>
        <span className='font-mono text-[10px] font-medium'>
          {value.toFixed(0)}%
        </span>
      </div>
      <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className={cn('h-full rounded-full', loadTone(label, percent))}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/** 状态徽章（对齐原版 o3t）：在线绿、离线红、禁用灰、从未上报描边。 */
function StatusBadge({ status }: { status: MachineStatus }) {
  switch (status) {
    case 'inactive':
      return <Badge variant='secondary'>已禁用</Badge>
    case 'never':
      return (
        <Badge variant='outline' className='text-muted-foreground'>
          从未上报
        </Badge>
      )
    case 'online':
      return <Badge className={STATUS_STYLE.online.card}>在线</Badge>
    case 'offline':
      return <Badge variant='destructive'>离线</Badge>
  }
}

export function ServerMachinePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Machine | null>(null)
  const [deleting, setDeleting] = useState<Machine | null>(null)
  const [detail, setDetail] = useState<Machine | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [secret, setSecret] = useState<SecretDialog | null>(null)
  const [keyword, setKeyword] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const { data, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
    refetchInterval: 15000,
  })

  const machines = useMemo(() => data ?? [], [data])

  const onlineRatio = useMemo(() => {
    const online = machines.filter((m) => machineStatus(m) === 'online').length
    return `${online}/${machines.length}`
  }, [machines])

  const highLoadCount = useMemo(
    () => machines.filter(isMachineHighLoad).length,
    [machines]
  )

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // 搜索变化回到第一页
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [keyword, columnFilters])

  const columns = useMemo<ColumnDef<Machine>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => <div>服务器名称</div>,
        cell: ({ row }) => {
          const m = row.original
          const status = machineStatus(m)
          return (
            <div className='flex min-w-[260px] items-start gap-3'>
              <div className='mt-0.5 rounded-md border bg-muted/40 p-2'>
                <Server className='h-4 w-4 text-muted-foreground' />
              </div>
              <div className='min-w-0 space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='max-w-[220px] truncate font-medium'>
                    {m.name}
                  </span>
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      STATUS_STYLE[status].dot
                    )}
                  />
                  <Badge variant='outline' className='font-mono text-[10px]'>
                    SID:{m.id}
                  </Badge>
                  {isMachineHighLoad(m) ? (
                    <Badge
                      variant='secondary'
                      className='border-0 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    >
                      高负载
                    </Badge>
                  ) : null}
                </div>
                <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                  <StatusBadge status={status} />
                  <span>•</span>
                  <span>最后心跳: {fmtAgo(m.last_seen_at)}</span>
                  <span>•</span>
                  <span>节点数: {m.servers_count}</span>
                </div>
                {m.notes ? (
                  <p className='max-w-[420px] truncate text-xs text-muted-foreground'>
                    {m.notes}
                  </p>
                ) : null}
              </div>
            </div>
          )
        },
        filterFn: (row, _id, value) => {
          const m = row.original
          const kw = String(value ?? '').trim().toLowerCase()
          if (!kw) return true
          return [m.name, m.notes ?? '', `sid:${m.id}`, String(m.id)]
            .join(' ')
            .toLowerCase()
            .includes(kw)
        },
      },
      {
        id: 'status',
        accessorFn: (m) => machineStatus(m),
        header: () => <div>状态</div>,
        cell: ({ row }) => (
          <StatusBadge status={machineStatus(row.original)} />
        ),
        filterFn: (row, _id, value) => {
          const arr = Array.isArray(value) ? value : []
          return !arr.length || arr.includes(machineStatus(row.original))
        },
      },
      {
        id: 'node_state',
        accessorFn: (m) => {
          const out: string[] = []
          out.push((m.servers_count ?? 0) > 0 ? 'with_nodes' : 'idle_nodes')
          if (isMachineHighLoad(m)) out.push('high_load')
          return out
        },
        filterFn: (row, _id, value) => {
          const arr = Array.isArray(value) ? value : []
          if (!arr.length) return true
          const m = row.original
          const out: string[] = []
          out.push((m.servers_count ?? 0) > 0 ? 'with_nodes' : 'idle_nodes')
          if (isMachineHighLoad(m)) out.push('high_load')
          return arr.some((v) => out.includes(String(v)))
        },
      },
      {
        id: 'load',
        header: () => <div>负载</div>,
        cell: ({ row }) => {
          const m = row.original
          const load = readLoad(m.load_status)
          if (!m.load_status) {
            return (
              <span className='text-xs text-muted-foreground'>暂无负载数据</span>
            )
          }
          const cpu = load.cpu ?? 0
          const memPct = pct(load.mem?.used, load.mem?.total)
          return (
            <div className='w-[180px] space-y-2'>
              <LoadBar
                icon={<Cpu className='size-3' />}
                label='cpu'
                value={cpu}
                percent={cpu}
              />
              <LoadBar
                icon={<MemoryStick className='size-3' />}
                label='mem'
                value={memPct}
                percent={memPct}
              />
              <div className='flex items-center justify-between text-[10px] text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <HardDrive className='size-3' /> DISK
                </span>
                <span className='font-mono'>
                  {fmtBytes(load.disk?.used)} / {fmtBytes(load.disk?.total)}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        id: 'relation',
        header: () => <div>节点数</div>,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className='min-w-[140px] space-y-2'>
              <div className='flex items-center gap-2'>
                <div className='font-mono text-base font-semibold'>
                  {m.servers_count}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {(m.servers_count ?? 0) > 0 ? '已承载节点' : '暂无承载'}
                </div>
              </div>
              <Button
                variant='outline'
                size='sm'
                className='h-7 gap-1.5 px-2 text-xs'
                onClick={() => openDetail(m)}
              >
                <Eye className='size-3.5' /> 服务器详情
              </Button>
            </div>
          )
        },
      },
      {
        id: 'last_seen',
        header: () => <div>最后心跳</div>,
        cell: ({ row }) => {
          const reportedAt = (row.original.load_status as { updated_at?: number } | null)
            ?.updated_at
          return (
            <div className='space-y-1 text-xs'>
              <div className='font-medium'>{fmtAgo(row.original.last_seen_at)}</div>
              <div className='text-muted-foreground'>
                {reportedAt ? `负载上报: ${fmtAgo(reportedAt)}` : '暂无负载数据'}
              </div>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: () => <div className='text-end'>操作</div>,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className='flex items-center justify-end gap-1 whitespace-nowrap'>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                title='查看详情'
                aria-label='服务器详情'
                onClick={() => openDetail(m)}
              >
                <Eye className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                title='编辑'
                aria-label='编辑'
                onClick={() => {
                  setCurrent(m)
                  setMutateOpen(true)
                }}
              >
                <Pencil className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 text-destructive hover:text-destructive'
                title='删除'
                aria-label='删除'
                onClick={() => setDeleting(m)}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          )
        },
        meta: { className: 'text-end' },
      },
    ],
    []
  )

  const table = useReactTable({
    data: machines,
    columns,
    state: {
      pagination,
      columnFilters,
      columnVisibility: { node_state: false },
      globalFilter: keyword,
    },
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: (row, _id, value) => {
      const m = row.original
      const kw = String(value ?? '').trim().toLowerCase()
      if (!kw) return true
      return [m.name, m.notes ?? '', `sid:${m.id}`, String(m.id)]
        .join(' ')
        .toLowerCase()
        .includes(kw)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const isFiltered = columnFilters.length > 0 || keyword.length > 0

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropMachine(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  function onCreated(result: MachineCreateResult) {
    queryClient.invalidateQueries({ queryKey: ['machines'] })
    setSecret({
      title: '服务器已创建',
      description: '请保存 token 与安装命令，token 仅在此完整展示一次。',
      fields: [
        { label: 'Token', value: result.token, mono: true },
        { label: '安装命令', value: result.install_command, mono: true },
      ],
    })
  }

  function openDetail(m: Machine) {
    setDetail(m)
    setDetailOpen(true)
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>服务器管理</h2>
            <p className='mt-2 text-muted-foreground'>
              用于查看服务器健康、负载与承载节点，并从运维视角快捷发起节点操作。
            </p>
          </div>
        </div>

        {/* 汇总条 */}
        <OverviewBar machines={machines} />

        {/* 工具栏 */}
        <div className='flex flex-col gap-2'>
          <div className='flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between'>
            <div className='flex flex-1 flex-wrap items-center gap-2'>
              <Button
                onClick={() => {
                  setCurrent(null)
                  setMutateOpen(true)
                }}
              >
                <Plus className='size-4' /> 添加服务器
              </Button>
              <Input
                placeholder='搜索服务器名称、备注或 SID...'
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className={cn(
                  'h-9 w-full min-w-[180px] sm:w-[220px] lg:w-[280px]',
                  keyword && 'border-primary/50 ring-primary/20'
                )}
              />
              <DataTableFacetedFilter
                column={table.getColumn('status')}
                title='状态'
                options={[
                  { label: '在线', value: 'online' },
                  { label: '离线', value: 'offline' },
                  { label: '已禁用', value: 'inactive' },
                  { label: '从未上报', value: 'never' },
                ]}
              />
              <DataTableFacetedFilter
                column={table.getColumn('node_state')}
                title='节点'
                options={[
                  { label: '已承载节点', value: 'with_nodes' },
                  { label: '空闲服务器', value: 'idle_nodes' },
                  { label: '高负载', value: 'high_load' },
                ]}
              />
              {isFiltered && (
                <Button
                  variant='ghost'
                  onClick={() => {
                    table.resetColumnFilters()
                    setKeyword('')
                  }}
                  className='h-9 px-2 lg:px-3'
                >
                  重置 <X className='ml-2 h-4 w-4' />
                </Button>
              )}
            </div>
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <span className='rounded-md border bg-muted/40 px-2.5 py-1 font-mono'>
                在线: {onlineRatio}
              </span>
              <span className='rounded-md border bg-muted/40 px-2.5 py-1 font-mono'>
                高负载: {highLoadCount}
              </span>
            </div>
          </div>
          <p className='text-xs text-muted-foreground'>
            适合集中查看服务器在线情况、承载节点数量与资源压力。
          </p>
        </div>

        {/* 列表 */}
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className='group/row'>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(header.column.columnDef.meta?.className)}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleFlatColumns().length}
                    className='h-24 text-center'
                  >
                    加载中...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className='group/row'>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(cell.column.columnDef.meta?.className)}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleFlatColumns().length}
                    className='text-muted-foreground h-24 text-center'
                  >
                    暂无服务器
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DataTablePagination table={table} className='mt-auto' />
      </Main>

      <MachineMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
        onCreated={onCreated}
      />

      <MachineDetailDrawer
        machine={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAddNode={() => {
          setDetailOpen(false)
          setCurrent(null)
          setMutateOpen(true)
        }}
      />

      {secret && (
        <InstallCommandDialog
          open={!!secret}
          onOpenChange={(o) => !o && setSecret(null)}
          title={secret.title}
          description={secret.description}
          fields={secret.fields}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除服务器'
        desc={`确定删除服务器「${deleting?.name}」吗？关联节点会自动解除绑定。`}
        confirmText='删除'
        destructive
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
        isLoading={dropMutation.isPending}
      />
    </>
  )
}
