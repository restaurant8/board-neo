import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  CheckIcon,
  ChevronsUpDown,
  Copy,
  Download,
  PlusCircle,
  SlidersHorizontal,
  Ticket,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
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
  type GiftCardCode,
  GIFT_CODE_STATUS_DISABLED,
  GIFT_CODE_STATUS_EXPIRED,
  GIFT_CODE_STATUS_MAP,
  GIFT_CODE_STATUS_UNUSED,
  GIFT_CODE_STATUS_USED,
  deleteCode,
  fetchCodes,
  toggleCode,
} from '../api'
import { GenerateCodesDialog } from './generate-codes-dialog'
import { SimplePagination } from './simple-pagination'

function time(ts?: number | null) {
  if (!ts) return '-'
  return format(new Date(ts * 1000), 'yyyy/MM/dd HH:mm:ss')
}

/** 对齐原版：未使用→default，已使用→secondary，已禁用/已过期→destructive。 */
function statusVariant(status: number) {
  if (status === GIFT_CODE_STATUS_USED) return 'secondary' as const
  if (
    status === GIFT_CODE_STATUS_DISABLED ||
    status === GIFT_CODE_STATUS_EXPIRED
  )
    return 'destructive' as const
  return 'default' as const
}

/** 列定义（对齐原版兑换码列表：ID/兑换码/模板名称/状态/过期时间/已用次数/可用次数/创建时间）。 */
type ColumnKey =
  | 'id'
  | 'code'
  | 'template_name'
  | 'status'
  | 'expires_at'
  | 'usage_count'
  | 'max_usage'
  | 'created_at'

type SortKey = Exclude<ColumnKey, 'status'>

const COLUMNS: {
  key: ColumnKey
  label: string
  /** 列宽（显式 Tailwind，列均匀分布、无尾部空白）。 */
  width: string
  align?: 'end'
  sortable?: boolean
}[] = [
  { key: 'id', label: 'ID', width: 'w-16', sortable: true },
  { key: 'code', label: '兑换码', width: 'w-56' },
  { key: 'template_name', label: '模板名称', width: 'w-40' },
  { key: 'status', label: '状态', width: 'w-32' },
  { key: 'expires_at', label: '过期时间', width: 'w-44', sortable: true },
  {
    key: 'usage_count',
    label: '已用次数',
    width: 'w-24',
    align: 'end',
    sortable: true,
  },
  {
    key: 'max_usage',
    label: '可用次数',
    width: 'w-24',
    align: 'end',
    sortable: true,
  },
  { key: 'created_at', label: '创建时间', width: 'w-44', sortable: true },
]

const STATUS_OPTIONS = Object.entries(GIFT_CODE_STATUS_MAP).map(
  ([value, label]) => ({ value, label })
)

/** 状态多选（faceted）筛选——复刻原版「状态」筛选胶囊。 */
function StatusFilter({
  selected,
  onChange,
}: {
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='h-8 border-dashed'>
          <PlusCircle className='size-4' />
          状态
          {selected.size > 0 && (
            <>
              <Separator orientation='vertical' className='mx-2 h-4' />
              <Badge
                variant='secondary'
                className='rounded-sm px-1 font-normal lg:hidden'
              >
                {selected.size}
              </Badge>
              <div className='hidden space-x-1 lg:flex'>
                {selected.size > 2 ? (
                  <Badge
                    variant='secondary'
                    className='rounded-sm px-1 font-normal'
                  >
                    已选 {selected.size} 项
                  </Badge>
                ) : (
                  STATUS_OPTIONS.filter((o) => selected.has(o.value)).map(
                    (o) => (
                      <Badge
                        key={o.value}
                        variant='secondary'
                        className='rounded-sm px-1 font-normal'
                      >
                        {o.label}
                      </Badge>
                    )
                  )
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-50 p-0' align='start'>
        <Command>
          <CommandInput placeholder='状态' />
          <CommandList>
            <CommandEmpty>无结果。</CommandEmpty>
            <CommandGroup>
              {STATUS_OPTIONS.map((option) => {
                const isSelected = selected.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const next = new Set(selected)
                      if (isSelected) next.delete(option.value)
                      else next.add(option.value)
                      onChange(next)
                    }}
                  >
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className='text-background h-4 w-4' />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange(new Set())}
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

/** 可排序表头按钮（复刻原版 column-header 风格）。 */
function SortHeader({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  align?: 'end'
  onClick: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center',
        align === 'end' ? 'justify-end' : 'justify-start'
      )}
    >
      <Button
        variant='ghost'
        size='sm'
        className='data-[active=true]:bg-accent -ms-3 h-8'
        data-active={active}
        onClick={onClick}
      >
        <span>{label}</span>
        {active ? (
          dir === 'desc' ? (
            <ArrowDown className='ms-2 h-4 w-4' />
          ) : (
            <ArrowUp className='ms-2 h-4 w-4' />
          )
        ) : (
          <ChevronsUpDown className='ms-2 h-4 w-4' />
        )}
      </Button>
    </div>
  )
}

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? '' : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function CodesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<GiftCardCode | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'id',
    dir: 'desc',
  })
  const [hidden, setHidden] = useState<Set<ColumnKey>>(new Set())

  // 服务端筛选只支持单一 status；多选时取全部交给客户端过滤。
  const singleStatus =
    statusFilter.size === 1 ? Number([...statusFilter][0]) : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['gift-codes', page, pageSize, singleStatus],
    queryFn: () =>
      fetchCodes({
        page,
        per_page: pageSize,
        status: singleStatus,
      }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'enable' | 'disable' }) =>
      toggleCode(id, action),
    onSuccess: (res) => {
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['gift-codes'] })
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => deleteCode(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['gift-codes'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  // 客户端：搜索 + 多选状态过滤 + 排序（针对当前页数据）。
  const rows = useMemo(() => {
    let r = data?.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.template_name.toLowerCase().includes(q)
      )
    }
    if (statusFilter.size > 1) {
      r = r.filter((c) => statusFilter.has(String(c.status)))
    }
    const { key, dir } = sort
    const factor = dir === 'asc' ? 1 : -1
    return [...r].sort((a, b) => {
      const av = a[key] ?? 0
      const bv = b[key] ?? 0
      if (av < bv) return -1 * factor
      if (av > bv) return 1 * factor
      return 0
    })
  }, [data, search, statusFilter, sort])

  const lastPage = data?.last_page ?? 1

  const visibleColumns = COLUMNS.filter((c) => !hidden.has(c.key))
  const colSpan = visibleColumns.length + 1 // + 操作列

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }

  function exportCsv() {
    if (rows.length === 0) {
      toast.error('当前没有可导出的兑换码')
      return
    }
    const header = COLUMNS.map((c) => c.label)
    const lines = [header.map(csvCell).join(',')]
    for (const c of rows) {
      lines.push(
        [
          c.id,
          c.code,
          c.template_name,
          c.status_name ?? GIFT_CODE_STATUS_MAP[c.status],
          time(c.expires_at),
          c.usage_count,
          c.max_usage,
          time(c.created_at),
        ]
          .map(csvCell)
          .join(',')
      )
    }
    const blob = new Blob(['﻿' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gift-codes-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('已导出当前数据')
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* 工具栏：搜索 + 状态筛选 + 生成/导出/显示列 */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex flex-1 items-center gap-2'>
          <Input
            placeholder='搜索礼品卡...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='h-8 w-37.5 lg:w-62.5'
          />
          <StatusFilter
            selected={statusFilter}
            onChange={(next) => {
              setStatusFilter(next)
              setPage(1)
            }}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='h-8'
            onClick={() => setGenOpen(true)}
          >
            <Ticket className='size-4' /> 生成兑换码
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='h-8'
            onClick={exportCsv}
          >
            <Download className='size-4' /> 导出
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm' className='h-8'>
                <SlidersHorizontal className='size-4' /> 显示列
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-37.5'>
              <DropdownMenuLabel>切换列</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={!hidden.has(c.key)}
                  onCheckedChange={(v) =>
                    setHidden((prev) => {
                      const next = new Set(prev)
                      if (v) next.delete(c.key)
                      else next.add(c.key)
                      return next
                    })
                  }
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(c.width, c.align === 'end' && 'text-end')}
                >
                  {c.sortable ? (
                    <SortHeader
                      label={c.label}
                      active={sort.key === c.key}
                      dir={sort.dir}
                      align={c.align}
                      onClick={() => toggleSort(c.key as SortKey)}
                    />
                  ) : (
                    c.label
                  )}
                </TableHead>
              ))}
              <TableHead className='w-24 text-end'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colSpan} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((c) => (
                <TableRow key={c.id}>
                  {!hidden.has('id') && (
                    <TableCell>
                      <Badge variant='outline'>{c.id}</Badge>
                    </TableCell>
                  )}
                  {!hidden.has('code') && (
                    <TableCell>
                      <div className='flex items-center space-x-2'>
                        <Badge variant='secondary' className='font-mono'>
                          {c.code}
                        </Badge>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6'
                          onClick={() => {
                            navigator.clipboard?.writeText(c.code)
                            toast.success('已复制')
                          }}
                        >
                          <Copy className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  {!hidden.has('template_name') && (
                    <TableCell>{c.template_name}</TableCell>
                  )}
                  {!hidden.has('status') && (
                    <TableCell>
                      <div className='flex items-center space-x-2'>
                        <Badge variant={statusVariant(c.status)}>
                          {c.status_name ?? GIFT_CODE_STATUS_MAP[c.status]}
                        </Badge>
                        {(c.status === GIFT_CODE_STATUS_UNUSED ||
                          c.status === GIFT_CODE_STATUS_DISABLED) && (
                          <Switch
                            checked={c.status !== GIFT_CODE_STATUS_DISABLED}
                            onCheckedChange={(v) =>
                              toggleMutation.mutate({
                                id: c.id,
                                action: v ? 'enable' : 'disable',
                              })
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                  {!hidden.has('expires_at') && (
                    <TableCell className='text-muted-foreground text-sm'>
                      {time(c.expires_at)}
                    </TableCell>
                  )}
                  {!hidden.has('usage_count') && (
                    <TableCell className='text-end'>{c.usage_count}</TableCell>
                  )}
                  {!hidden.has('max_usage') && (
                    <TableCell className='text-end'>{c.max_usage}</TableCell>
                  )}
                  {!hidden.has('created_at') && (
                    <TableCell className='text-muted-foreground text-sm'>
                      {time(c.created_at)}
                    </TableCell>
                  )}
                  <TableCell className='text-end'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className='text-muted-foreground h-4 w-4 hover:text-red-600 dark:hover:text-red-400' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={colSpan} className='h-24 text-center'>
                  暂无兑换码
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <SimplePagination
        page={page}
        totalPages={lastPage}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
      />

      <GenerateCodesDialog open={genOpen} onOpenChange={setGenOpen} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除兑换码'
        desc={`确定删除兑换码「${deleting?.code}」吗？已使用或有记录的无法删除。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </div>
  )
}
