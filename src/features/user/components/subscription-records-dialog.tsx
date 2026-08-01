import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  History,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
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
  type SubscriptionRecord,
  type SubscriptionRecordOrderBy,
  type UsageOrderDir,
  clearUsageRecords,
  fetchSubscriptionRecordEvents,
  fetchSubscriptionRecords,
} from '../api'
import { formatTimestamp } from '../format'

const DEFAULT_PAGE_SIZE = 50

type ClearTarget =
  | { kind: 'filtered'; keyword: string }
  | { kind: 'user'; record: SubscriptionRecord }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillKeyword?: string
}

export function SubscriptionRecordsDialog({
  open,
  onOpenChange,
  prefillKeyword,
}: Props) {
  const queryClient = useQueryClient()
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orderBy, setOrderBy] = useState<SubscriptionRecordOrderBy>('record_at')
  const [orderDir, setOrderDir] = useState<UsageOrderDir>('desc')
  const [selected, setSelected] = useState<SubscriptionRecord | null>(null)
  const [eventPage, setEventPage] = useState(1)
  const [eventPageSize, setEventPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [clearTarget, setClearTarget] = useState<ClearTarget | null>(null)

  const [loaded, setLoaded] = useState<{
    open: boolean
    prefillKeyword?: string
  } | null>(null)

  if (loaded?.open !== open || loaded?.prefillKeyword !== prefillKeyword) {
    setLoaded({ open, prefillKeyword })
    if (open) {
      const initialKeyword = prefillKeyword ?? ''
      setKeywordInput(initialKeyword)
      setKeyword(initialKeyword)
      setPage(1)
      setPageSize(DEFAULT_PAGE_SIZE)
      setOrderBy('record_at')
      setOrderDir('desc')
      setSelected(null)
      setEventPage(1)
      setEventPageSize(DEFAULT_PAGE_SIZE)
    }
  }

  const queryParams = {
    keyword: keyword || undefined,
    order_by: orderBy,
    order_dir: orderDir,
    page,
    page_size: pageSize,
  }
  const summaryQuery = useQuery({
    queryKey: ['subscription-records', queryParams],
    queryFn: () => fetchSubscriptionRecords(queryParams),
    enabled: open && !selected,
  })

  const eventQuery = useQuery({
    queryKey: [
      'subscription-record-events',
      selected?.user_id,
      eventPage,
      eventPageSize,
    ],
    queryFn: () =>
      fetchSubscriptionRecordEvents({
        user_id: selected!.user_id,
        page: eventPage,
        page_size: eventPageSize,
      }),
    enabled: open && !!selected,
  })

  const clearMutation = useMutation({
    mutationFn: (target: ClearTarget) =>
      clearUsageRecords({
        type: 'subscribe',
        user_id: target.kind === 'user' ? target.record.user_id : undefined,
        keyword:
          target.kind === 'filtered' && target.keyword
            ? target.keyword
            : undefined,
      }),
    onSuccess: (result, target) => {
      toast.success(
        `已清理 ${result.deleted} 条订阅汇总、${result.event_deleted} 条时间明细`
      )
      setClearTarget(null)
      if (target.kind === 'user') {
        setSelected(null)
        setEventPage(1)
      }
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['subscription-records'] })
      queryClient.invalidateQueries({
        queryKey: ['subscription-record-events'],
      })
      queryClient.invalidateQueries({ queryKey: ['usage-records'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const toggleSort = (key: SubscriptionRecordOrderBy) => {
    if (orderBy === key) {
      setOrderDir((value) => (value === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrderBy(key)
      setOrderDir('desc')
    }
    setPage(1)
  }

  const sortIcon = (key: SubscriptionRecordOrderBy) => {
    if (orderBy !== key) return null
    return orderDir === 'asc' ? (
      <ArrowUp className='ms-1 inline size-3' />
    ) : (
      <ArrowDown className='ms-1 inline size-3' />
    )
  }

  const applyKeyword = () => {
    setKeyword(keywordInput.trim())
    setPage(1)
  }

  const openEvents = (record: SubscriptionRecord) => {
    setSelected(record)
    setEventPage(1)
  }

  const summaryRows = summaryQuery.data?.data ?? []
  const summaryTotal = summaryQuery.data?.total ?? 0
  const summaryMaxPage = Math.max(1, Math.ceil(summaryTotal / pageSize))
  const eventRows = eventQuery.data?.data ?? []
  const eventTotal = eventQuery.data?.total ?? 0
  const eventMaxPage = Math.max(1, Math.ceil(eventTotal / eventPageSize))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[85vh] max-h-[85vh] w-[95vw] max-w-6xl flex-col gap-3 sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle>{selected ? '订阅时间明细' : '订阅记录'}</DialogTitle>
          <DialogDescription>
            {selected
              ? `${selected.user_email || `用户 #${selected.user_id}`}：逐次拉取订阅的时间、IP 与客户端。`
              : '按用户统计订阅拉取次数、来源 IP、首次与最近订阅时间；同一用户和 IP 在 30 秒内重复拉取只计一次。'}
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className='size-4' /> 返回订阅统计
              </Button>
              <Badge variant='secondary'>
                累计 {selected.subscribe_count} 次
              </Badge>
              <Badge variant='outline'>{selected.ip_count} 个 IP</Badge>
              <span className='text-xs text-muted-foreground'>
                历史汇总：{formatTimestamp(selected.first_at)} 至{' '}
                {formatTimestamp(selected.record_at)}
              </span>
              <Button
                variant='destructive'
                size='sm'
                className='ms-auto'
                onClick={() =>
                  setClearTarget({ kind: 'user', record: selected })
                }
              >
                <Trash2 className='size-4' /> 清理此用户
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => eventQuery.refetch()}
              >
                <RefreshCw className='size-4' /> 刷新
              </Button>
            </div>

            <div className='flex-1 overflow-x-auto overflow-y-auto rounded-md border'>
              <Table className='w-max min-w-full'>
                <TableHeader className='sticky top-0 z-10 bg-background'>
                  <TableRow>
                    <TableHead className='w-[180px] whitespace-nowrap'>
                      订阅时间
                    </TableHead>
                    <TableHead className='whitespace-nowrap'>IP</TableHead>
                    <TableHead className='whitespace-nowrap'>归属地</TableHead>
                    <TableHead className='max-w-[420px]'>User-Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventQuery.isFetching ? (
                    <TableRow>
                      <TableCell colSpan={4} className='h-24 text-center'>
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : eventRows.length > 0 ? (
                    eventRows.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className='whitespace-nowrap'>
                          {formatTimestamp(event.record_at)}
                        </TableCell>
                        <TableCell className='font-mono text-xs whitespace-nowrap'>
                          {event.ip}
                        </TableCell>
                        <TableCell className='whitespace-nowrap'>
                          {event.location || '—'}
                        </TableCell>
                        <TableCell
                          className='max-w-[420px] truncate text-xs text-muted-foreground'
                          title={event.ua || ''}
                        >
                          {event.ua || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className='h-28 text-center'>
                        <div>暂无逐次时间明细</div>
                        <div className='mt-1 text-xs text-muted-foreground'>
                          历史聚合数据无法还原每次时间；升级后的新订阅会从这里开始记录。
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <SimplePagination
              page={eventPage}
              totalPages={eventMaxPage}
              total={eventTotal}
              pageSize={eventPageSize}
              onPageChange={setEventPage}
              onPageSizeChange={(size) => {
                setEventPageSize(size)
                setEventPage(1)
              }}
            />
          </>
        ) : (
          <>
            <div className='flex flex-wrap items-center gap-2'>
              <Input
                className='h-8 w-56'
                placeholder='用户邮箱 / ID'
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && applyKeyword()}
              />
              <Button size='sm' onClick={applyKeyword}>
                <Search className='size-4' /> 查询
              </Button>
              {keyword && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setKeywordInput('')
                    setKeyword('')
                    setPage(1)
                  }}
                >
                  <ArrowLeft className='size-4' /> 返回全部
                </Button>
              )}
              <Button
                variant='destructive'
                size='sm'
                className='ms-auto'
                disabled={summaryTotal === 0}
                onClick={() => setClearTarget({ kind: 'filtered', keyword })}
              >
                <Trash2 className='size-4' />
                {keyword ? '清理筛选结果' : '清空全部'}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => summaryQuery.refetch()}
              >
                <RefreshCw className='size-4' /> 刷新
              </Button>
            </div>

            <div className='flex-1 overflow-x-auto overflow-y-auto rounded-md border'>
              <Table className='w-max min-w-full'>
                <TableHeader className='sticky top-0 z-10 bg-background'>
                  <TableRow>
                    <TableHead className='w-[190px]'>用户</TableHead>
                    <TableHead
                      className='cursor-pointer whitespace-nowrap'
                      onClick={() => toggleSort('count')}
                    >
                      订阅次数{sortIcon('count')}
                    </TableHead>
                    <TableHead className='whitespace-nowrap'>来源 IP</TableHead>
                    <TableHead className='max-w-[260px]'>最近客户端</TableHead>
                    <TableHead
                      className='cursor-pointer whitespace-nowrap'
                      onClick={() => toggleSort('first_at')}
                    >
                      首次订阅{sortIcon('first_at')}
                    </TableHead>
                    <TableHead
                      className='cursor-pointer whitespace-nowrap'
                      onClick={() => toggleSort('record_at')}
                    >
                      最近订阅{sortIcon('record_at')}
                    </TableHead>
                    <TableHead className='w-[110px]'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryQuery.isFetching ? (
                    <TableRow>
                      <TableCell colSpan={7} className='h-24 text-center'>
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : summaryRows.length > 0 ? (
                    summaryRows.map((record) => (
                      <TableRow key={record.user_id}>
                        <TableCell className='align-top'>
                          <div
                            className='max-w-[190px] truncate'
                            title={record.user_email || `#${record.user_id}`}
                          >
                            {record.user_email || `#${record.user_id}`}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            ID {record.user_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className='font-semibold'>
                            {record.subscribe_count}
                          </span>{' '}
                          次
                        </TableCell>
                        <TableCell className='align-top'>
                          <div>
                            {record.ip_count} 个 ·{' '}
                            <span className='font-mono text-xs'>
                              {record.last_ip || '—'}
                            </span>
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {record.last_location || '未知归属地'}
                          </div>
                        </TableCell>
                        <TableCell
                          className='max-w-[260px] truncate text-xs text-muted-foreground'
                          title={record.last_ua || ''}
                        >
                          {record.last_ua || '—'}
                        </TableCell>
                        <TableCell className='whitespace-nowrap'>
                          {formatTimestamp(record.first_at)}
                        </TableCell>
                        <TableCell className='whitespace-nowrap'>
                          {formatTimestamp(record.record_at)}
                        </TableCell>
                        <TableCell className='whitespace-nowrap'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openEvents(record)}
                          >
                            <History className='size-4' /> 明细
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='ms-1'
                            title='清理此用户的订阅记录'
                            onClick={() =>
                              setClearTarget({ kind: 'user', record })
                            }
                          >
                            <Trash2 className='size-4 text-destructive' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className='h-24 text-center'>
                        暂无订阅记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <SimplePagination
              page={page}
              totalPages={summaryMaxPage}
              total={summaryTotal}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </DialogContent>
      <ConfirmDialog
        open={!!clearTarget}
        onOpenChange={(nextOpen) => !nextOpen && setClearTarget(null)}
        title={
          clearTarget?.kind === 'user'
            ? '清理此用户的订阅记录？'
            : keyword
              ? '清理当前筛选结果？'
              : '清空全部订阅记录？'
        }
        desc={
          clearTarget?.kind === 'user'
            ? `将永久删除 ${clearTarget.record.user_email || `用户 #${clearTarget.record.user_id}`} 的订阅统计和逐次时间明细。`
            : keyword
              ? `将永久删除与“${keyword}”匹配用户的订阅统计和逐次时间明细。`
              : '将永久删除所有用户的订阅统计和逐次时间明细，此操作不可撤销。'
        }
        destructive
        confirmText='确认清理'
        cancelBtnText='取消'
        isLoading={clearMutation.isPending}
        handleConfirm={() => clearTarget && clearMutation.mutate(clearTarget)}
      />
    </Dialog>
  )
}
