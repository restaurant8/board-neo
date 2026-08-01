import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, RefreshCw, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import {
  type UsageOrderBy,
  type UsageOrderDir,
  type UsageRecordType,
  clearUsageRecords,
  fetchUsageRecords,
} from '../api'
import { formatTimestamp } from '../format'

const DEFAULT_PAGE_SIZE = 50

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 行内入口预填的关键词（用户邮箱或 ID）。 */
  prefillKeyword?: string
}

export function UsageRecordsDialog({
  open,
  onOpenChange,
  prefillKeyword,
}: Props) {
  const queryClient = useQueryClient()

  // 表单输入（待提交）
  const [keywordInput, setKeywordInput] = useState('')
  const [ipInput, setIpInput] = useState('')
  const [typeInput, setTypeInput] = useState<UsageRecordType | ''>('')

  // 已应用的查询条件
  const [applied, setApplied] = useState<{
    keyword: string
    ip: string
    type: UsageRecordType | ''
  }>({ keyword: '', ip: '', type: '' })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orderBy, setOrderBy] = useState<UsageOrderBy>('record_at')
  const [orderDir, setOrderDir] = useState<UsageOrderDir>('desc')
  const [clearMode, setClearMode] = useState<'scoped' | 'all' | null>(null)

  // 时间范围：默认今天，可切最近 7/15/30 天或自定义起止日期
  const [rangeMode, setRangeMode] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // 由范围模式派生 start_time/end_time（秒级时间戳；不限一侧则 undefined）
  const timeRange = ((): { start_time?: number; end_time?: number } => {
    const dayStart = (d: Date) => {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      return Math.floor(x.getTime() / 1000)
    }
    const today = dayStart(new Date())
    if (rangeMode === 'today') return { start_time: today }
    if (rangeMode === '7d') return { start_time: today - 6 * 86400 }
    if (rangeMode === '15d') return { start_time: today - 14 * 86400 }
    if (rangeMode === '30d') return { start_time: today - 29 * 86400 }
    if (rangeMode === 'all') return {}
    const r: { start_time?: number; end_time?: number } = {}
    if (customStart)
      r.start_time = dayStart(new Date(`${customStart}T00:00:00`))
    if (customEnd)
      r.end_time = dayStart(new Date(`${customEnd}T00:00:00`)) + 86399
    return r
  })()

  // 打开时重置并应用预填：渲染期间派生重置（React 官方模式），避免 effect 里同步 setState
  const [loaded, setLoaded] = useState<{
    open: boolean
    prefillKeyword?: string
  } | null>(null)

  if (loaded?.open !== open || loaded?.prefillKeyword !== prefillKeyword) {
    setLoaded({ open, prefillKeyword })
    if (open) {
      const kw = prefillKeyword ?? ''
      setKeywordInput(kw)
      setIpInput('')
      setTypeInput('')
      setApplied({ keyword: kw, ip: '', type: '' })
      setPage(1)
      setPageSize(DEFAULT_PAGE_SIZE)
      setOrderBy('record_at')
      setOrderDir('desc')
      setRangeMode('today')
      setCustomStart('')
      setCustomEnd('')
    }
  }

  const queryParams = {
    keyword: applied.keyword || undefined,
    ip: applied.ip || undefined,
    type: applied.type || undefined,
    ...timeRange,
    order_by: orderBy,
    order_dir: orderDir,
    page,
    page_size: pageSize,
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['usage-records', queryParams],
    queryFn: () => fetchUsageRecords(queryParams),
    enabled: open,
  })

  const hasFilter = !!(applied.keyword || applied.ip || applied.type)
  // 一键清除是否被限定范围（除关键词/IP/类型外，非「全部时间」也算限定）
  const clearScoped = hasFilter || rangeMode !== 'all'
  const total = data?.total ?? 0
  const rows = data?.data ?? []
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  const applyFilters = () => {
    setApplied({
      keyword: keywordInput.trim(),
      ip: ipInput.trim(),
      type: typeInput,
    })
    setPage(1)
  }

  const resetFilters = () => {
    setKeywordInput('')
    setIpInput('')
    setTypeInput('')
    setApplied({ keyword: '', ip: '', type: '' })
    setPage(1)
  }

  const toggleSort = (key: UsageOrderBy) => {
    if (orderBy === key) {
      setOrderDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrderBy(key)
      setOrderDir('desc')
    }
    setPage(1)
  }

  const clearMutation = useMutation({
    mutationFn: (mode: 'scoped' | 'all') =>
      clearUsageRecords(
        mode === 'all'
          ? {}
          : {
              keyword: applied.keyword || undefined,
              ip: applied.ip || undefined,
              type: applied.type || undefined,
              ...timeRange,
            }
      ),
    onSuccess: (res) => {
      toast.success(
        `已清除 ${res.deleted} 条使用记录、${res.event_deleted} 条订阅时间明细`
      )
      setClearMode(null)
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['usage-records'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-records'] })
      queryClient.invalidateQueries({
        queryKey: ['subscription-record-events'],
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const sortIcon = (key: UsageOrderBy) => {
    if (orderBy !== key) return null
    return orderDir === 'asc' ? (
      <ArrowUp className='ms-1 inline size-3' />
    ) : (
      <ArrowDown className='ms-1 inline size-3' />
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='flex h-[85vh] max-h-[85vh] w-[95vw] max-w-6xl flex-col gap-3 sm:max-w-6xl'>
          <DialogHeader>
            <DialogTitle>使用记录</DialogTitle>
            <DialogDescription>
              用户连接 / 订阅过的真实 IP、归属地与 User-Agent。
            </DialogDescription>
          </DialogHeader>

          {/* 筛选条 */}
          <div className='flex flex-wrap items-center gap-2'>
            {hasFilter && (
              <Button variant='outline' size='sm' onClick={resetFilters}>
                <ArrowLeft className='size-4' /> 返回全部
              </Button>
            )}
            <Select
              value={rangeMode}
              onValueChange={(v) => {
                setRangeMode(v)
                setPage(1)
              }}
            >
              <SelectTrigger className='h-8 w-28'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='today'>今天</SelectItem>
                <SelectItem value='7d'>最近7天</SelectItem>
                <SelectItem value='15d'>最近15天</SelectItem>
                <SelectItem value='30d'>最近30天</SelectItem>
                <SelectItem value='all'>全部时间</SelectItem>
                <SelectItem value='custom'>自定义范围</SelectItem>
              </SelectContent>
            </Select>
            {rangeMode === 'custom' && (
              <>
                <Input
                  type='date'
                  className='h-8 w-[140px]'
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value)
                    setPage(1)
                  }}
                />
                <span className='text-sm text-muted-foreground'>至</span>
                <Input
                  type='date'
                  className='h-8 w-[140px]'
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value)
                    setPage(1)
                  }}
                />
              </>
            )}
            <Input
              className='h-8 w-44'
              placeholder='用户邮箱 / ID'
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
            <Input
              className='h-8 w-40'
              placeholder='IP（可模糊）'
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
            <Select
              value={typeInput || 'all'}
              onValueChange={(v) =>
                setTypeInput(v === 'all' ? '' : (v as UsageRecordType))
              }
            >
              <SelectTrigger className='h-8 w-32'>
                <SelectValue placeholder='全部类型' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部类型</SelectItem>
                <SelectItem value='connect'>连接</SelectItem>
                <SelectItem value='subscribe'>订阅</SelectItem>
              </SelectContent>
            </Select>
            <Button size='sm' onClick={applyFilters}>
              查询
            </Button>
            <Button variant='outline' size='sm' onClick={() => refetch()}>
              <RefreshCw className='size-4' /> 刷新
            </Button>
            <div className='ms-auto flex gap-2'>
              {clearScoped && (
                <Button
                  variant='outline'
                  size='sm'
                  className='text-destructive'
                  onClick={() => setClearMode('scoped')}
                >
                  <Trash2 className='size-4' /> 清理当前范围
                </Button>
              )}
              <Button
                variant='destructive'
                size='sm'
                onClick={() => setClearMode('all')}
              >
                <Trash2 className='size-4' /> 清空全部
              </Button>
            </div>
          </div>

          {/* 表格 */}
          <div className='flex-1 overflow-x-auto overflow-y-auto rounded-md border'>
            <Table className='w-max min-w-full'>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead className='w-[180px]'>用户</TableHead>
                  <TableHead
                    className='w-[72px] cursor-pointer whitespace-nowrap select-none'
                    onClick={() => toggleSort('online')}
                  >
                    在线IP{sortIcon('online')}
                  </TableHead>
                  <TableHead className='whitespace-nowrap'>类型</TableHead>
                  <TableHead className='whitespace-nowrap'>IP</TableHead>
                  <TableHead className='whitespace-nowrap'>归属地</TableHead>
                  <TableHead className='whitespace-nowrap'>节点</TableHead>
                  <TableHead className='max-w-[280px]'>User-Agent</TableHead>
                  <TableHead
                    className='w-[64px] cursor-pointer whitespace-nowrap select-none'
                    onClick={() => toggleSort('count')}
                  >
                    次数{sortIcon('count')}
                  </TableHead>
                  <TableHead
                    className='w-[170px] cursor-pointer whitespace-nowrap select-none'
                    onClick={() => toggleSort('record_at')}
                  >
                    时间{sortIcon('record_at')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={9} className='h-24 text-center'>
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className='align-top'>
                        <div
                          className='truncate'
                          title={r.user_email || `#${r.user_id}`}
                        >
                          {r.user_email || `#${r.user_id}`}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          ID {r.user_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            r.online_ip_count > 0
                              ? 'font-semibold text-emerald-600'
                              : 'text-muted-foreground'
                          }
                        >
                          {r.online_ip_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        {r.type === 'subscribe' ? (
                          <Badge variant='secondary' className='text-blue-600'>
                            订阅
                          </Badge>
                        ) : (
                          <Badge
                            variant='secondary'
                            className='text-emerald-600'
                          >
                            连接
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className='font-mono text-xs whitespace-nowrap'
                        title={r.ip}
                      >
                        {r.ip}
                      </TableCell>
                      <TableCell
                        className='whitespace-nowrap'
                        title={r.location || ''}
                      >
                        {r.location || (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className='text-sm whitespace-nowrap text-muted-foreground'
                        title={r.server_name || ''}
                      >
                        {r.server_name || '—'}
                      </TableCell>
                      <TableCell
                        className='max-w-[280px] truncate text-xs text-muted-foreground'
                        title={r.ua ?? ''}
                      >
                        {r.ua || '—'}
                      </TableCell>
                      <TableCell>{r.count || 1}</TableCell>
                      <TableCell className='whitespace-nowrap'>
                        <div>{formatTimestamp(r.record_at)}</div>
                        <div className='text-xs text-muted-foreground'>
                          首次 {formatTimestamp(r.first_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className='h-24 text-center'>
                      暂无记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页页脚 */}
          <SimplePagination
            page={page}
            totalPages={maxPage}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!clearMode}
        onOpenChange={(nextOpen) => !nextOpen && setClearMode(null)}
        title='清除使用记录'
        desc={
          clearMode === 'scoped'
            ? '确认清除【当前筛选条件（含所选时间范围）】下的所有使用记录？此操作不可恢复。'
            : '确认清除【全部】使用记录？此操作不可恢复！'
        }
        confirmText='清除'
        destructive
        isLoading={clearMutation.isPending}
        handleConfirm={() => clearMode && clearMutation.mutate(clearMode)}
      />
    </>
  )
}
