import { useEffect, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
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
import { Card } from '@/components/ui/card'
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

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: string
}) {
  return (
    <Card className='flex-row items-center justify-between p-4'>
      <div>
        <div className='text-muted-foreground text-sm'>{label}</div>
        <div className='text-2xl font-bold'>{value}</div>
      </div>
      <div className={tone}>{icon}</div>
    </Card>
  )
}

/** 负载阈值（与原版一致）。 */
const LOAD_THRESHOLDS = {
  CPU: { warn: 70, danger: 85 },
  MEM: { warn: 75, danger: 90 },
  DISK: { warn: 80, danger: 90 },
} as const

function loadTone(label: keyof typeof LOAD_THRESHOLDS, percent: number) {
  const t = LOAD_THRESHOLDS[label]
  if (percent >= t.danger) return 'bg-red-500'
  if (percent >= t.warn) return 'bg-amber-500'
  return 'bg-primary'
}

function LoadBar({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode
  label: keyof typeof LOAD_THRESHOLDS
  value: string
  percent: number
}) {
  return (
    <div className='grid gap-0.5'>
      <div className='text-muted-foreground flex items-center gap-1 text-xs'>
        {icon}
        <span className='w-8 uppercase'>{label}</span>
        <span className='text-foreground ms-auto'>{value}</span>
      </div>
      <div className='bg-muted h-1 w-36 overflow-hidden rounded-full max-sm:w-full'>
        <div
          className={cn('h-full rounded-full', loadTone(label, percent))}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/** 状态徽章：在线为绿色软底，离线为红色（destructive）。 */
function StatusBadge({ online }: { online: boolean }) {
  return online ? (
    <Badge className='border-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
      在线
    </Badge>
  ) : (
    <Badge variant='destructive'>离线</Badge>
  )
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

  const { data, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
    refetchInterval: 15000,
  })

  const stats = useMemo(() => {
    const list = data ?? []
    let online = 0
    let high = 0
    let nodes = 0
    list.forEach((m) => {
      if (isOnline(m.last_seen_at)) online++
      if (isHighLoad(readLoad(m.load_status))) high++
      nodes += m.servers_count ?? 0
    })
    return { total: list.length, online, offline: list.length - online, high, nodes }
  }, [data])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return data ?? []
    return (data ?? []).filter(
      (m) =>
        m.name.toLowerCase().includes(kw) ||
        (m.notes ?? '').toLowerCase().includes(kw) ||
        String(m.id).includes(kw)
    )
  }, [data, keyword])

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // 搜索变化回到第一页
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [keyword])

  const columns = useMemo<ColumnDef<Machine>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => <div>服务器名称</div>,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div>
              <div className='flex items-center gap-2'>
                <span className='font-medium'>{m.name}</span>
                <Badge variant='secondary' className='text-[10px]'>
                  SID:{m.id}
                </Badge>
              </div>
              {m.notes && (
                <div className='text-muted-foreground text-xs'>{m.notes}</div>
              )}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: () => <div>状态</div>,
        cell: ({ row }) => <StatusBadge online={isOnline(row.original.last_seen_at)} />,
      },
      {
        id: 'load',
        header: () => <div>负载</div>,
        cell: ({ row }) => {
          const load = readLoad(row.original.load_status)
          return (
            <div className='grid gap-1'>
              <LoadBar
                icon={<Cpu className='size-3' />}
                label='CPU'
                value={`${(load.cpu ?? 0).toFixed(0)}%`}
                percent={load.cpu ?? 0}
              />
              <LoadBar
                icon={<MemoryStick className='size-3' />}
                label='MEM'
                value={`${pct(load.mem?.used, load.mem?.total)}%`}
                percent={pct(load.mem?.used, load.mem?.total)}
              />
              <LoadBar
                icon={<HardDrive className='size-3' />}
                label='DISK'
                value={`${fmtBytes(load.disk?.used)} / ${fmtBytes(load.disk?.total)}`}
                percent={pct(load.disk?.used, load.disk?.total)}
              />
            </div>
          )
        },
      },
      {
        id: 'nodes',
        header: () => <div>节点数</div>,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <span className='font-mono text-base font-semibold'>
                  {m.servers_count}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {(m.servers_count ?? 0) > 0 ? '已承载节点' : '暂无承载'}
                </span>
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
                onClick={() => openDetail(m)}
              >
                <Eye className='size-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                title='编辑'
                onClick={() => {
                  setCurrent(m)
                  setMutateOpen(true)
                }}
              >
                <Pencil className='size-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 text-destructive hover:text-destructive'
                title='删除'
                onClick={() => setDeleting(m)}
              >
                <Trash2 className='size-4' />
              </Button>
            </div>
          )
        },
        meta: { className: 'text-end' },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

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
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>服务器管理</h2>
          <p className='text-muted-foreground'>
            用于查看服务器健康、负载与承载节点，并从运维视角快捷发起节点操作。
          </p>
        </div>

        {/* 汇总卡片 */}
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
          <SummaryCard
            icon={<Server className='size-5' />}
            label='服务器总数'
            value={stats.total}
          />
          <SummaryCard
            icon={<CircleCheck className='size-5 text-emerald-500' />}
            label='在线服务器'
            value={stats.online}
          />
          <SummaryCard
            icon={<ServerOff className='size-5 text-muted-foreground' />}
            label='离线/失联'
            value={stats.offline}
          />
          <SummaryCard
            icon={<TriangleAlert className='size-5 text-amber-500' />}
            label='高负载'
            value={stats.high}
          />
          <SummaryCard
            icon={<Layers className='size-5 text-sky-500' />}
            label='节点数'
            value={stats.nodes}
          />
        </div>

        {/* 工具栏 */}
        <div className='flex flex-wrap items-center gap-2'>
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
            className='max-w-xs'
          />
          <div className='text-muted-foreground ms-auto text-sm'>
            在线：{stats.online}/{stats.total} · 高负载：{stats.high}
          </div>
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
                    colSpan={columns.length}
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
                    colSpan={columns.length}
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
