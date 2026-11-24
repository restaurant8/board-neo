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
import { UserEmailLink } from '@/components/user-email-link'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import {
  type SubscriptionRecord,
  type SubscriptionTarget,
  type User,
  type SubscriptionRecordOrderBy,
  type UsageOrderDir,
  clearUsageRecords,
  fetchSubscriptionRecordEvents,
  fetchSubscriptionRecords,
} from '../api'
import { formatTimestamp } from '../format'
import { AccessAudit, AccessOverview } from './subscription-access'
import { PolicyPanel } from './subscription-policy'

const globalTabs = {
  overview: '访问概览',
  history: '历史汇总',
  policy: '全站规则',
  audit: '操作记录',
}
const userTabs = {
  events: '请求明细',
  policy: '用户规则与操作',
  audit: '操作记录',
}
const decisions = {
  allowed: '规则放行',
  observed: '观察命中 · 放行',
  limited: '限频拦截',
  paused: '人工暂停',
  unavailable: '账户或套餐不可用',
}
type SelectedUser = SubscriptionTarget & Partial<SubscriptionRecord>

const DEFAULT_PAGE_SIZE = 50

type ClearTarget =
  | { kind: 'filtered'; keyword: string }
  | { kind: 'user'; record: SubscriptionTarget }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillUser?: Pick<User, 'id' | 'email'>
}

export function SubscriptionRecordsDialog(props: Props) {
  return props.open ? (
    <RecordsContent key={props.prefillUser?.id ?? 'all'} {...props} />
  ) : null
}

function RecordsContent({ open, onOpenChange, prefillUser }: Props) {
  const [tab, setTab] = useState<keyof typeof globalTabs>('overview')
  const [userTab, setUserTab] = useState<keyof typeof userTabs>('events')
  const queryClient = useQueryClient()
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orderBy, setOrderBy] = useState<SubscriptionRecordOrderBy>('record_at')
  const [orderDir, setOrderDir] = useState<UsageOrderDir>('desc')
  const [selected, setSelected] = useState<SelectedUser | null>(
    prefillUser
      ? { user_id: prefillUser.id, user_email: prefillUser.email }
      : null
  )
  const [eventPage, setEventPage] = useState(1)
  const [eventPageSize, setEventPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [clearTarget, setClearTarget] = useState<ClearTarget | null>(null)

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
    enabled: open && !selected && tab === 'history',
  })

  const eventQuery = useQuery({
    staleTime: 0,
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
    enabled: open && !!selected && userTab === 'events',
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
      queryClient.invalidateQueries({ queryKey: ['subscription-access'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-audit'] })
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

  const openEvents = (record: SelectedUser) => {
    setUserTab('events')
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
      <DialogContent className='flex h-[85dvh] max-h-[85dvh] w-[95vw] max-w-6xl flex-col gap-3 sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle>
            {selected
              ? selected.user_email || `用户 #${selected.user_id}`
              : '订阅记录'}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? `订阅记录 · 用户 #${selected.user_id}`
              : tab === 'history'
                ? '历史汇总按用户和 IP 去重，同一来源 30 秒内计一次。'
                : '查看近 24 小时的请求、管理订阅下载和拉取频率。'}
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-wrap items-center gap-1 border-b pb-2'>
          {selected ? (
            <>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className='size-4' />
                返回列表
              </Button>
              {(Object.keys(userTabs) as (keyof typeof userTabs)[]).map(
                (key) => (
                  <Button
                    key={key}
                    variant={userTab === key ? 'secondary' : 'ghost'}
                    aria-pressed={userTab === key}
                    size='sm'
                    onClick={() => setUserTab(key)}
                  >
                    {userTabs[key]}
                  </Button>
                )
              )}
            </>
          ) : (
            (Object.keys(globalTabs) as (keyof typeof globalTabs)[]).map(
              (key) => (
                <Button
                  key={key}
                  variant={tab === key ? 'secondary' : 'ghost'}
                  aria-pressed={tab === key}
                  size='sm'
                  onClick={() => setTab(key)}
                >
                  {globalTabs[key]}
                </Button>
              )
            )
          )}
        </div>
        {selected ? (
          userTab === 'policy' ? (
            <PolicyPanel user={selected} />
          ) : userTab === 'audit' ? (
            <AccessAudit userId={selected.user_id} />
          ) : (
            <>
              <div className='flex flex-wrap items-center gap-2'>
                {selected.subscribe_count !== undefined && (
                  <>
                    <Badge variant='secondary'>
                      累计 {selected.subscribe_count} 次
                    </Badge>
                    <Badge variant='outline'>{selected.ip_count} 个 IP</Badge>
                    <span className='text-xs text-muted-foreground'>
                      历史汇总：{formatTimestamp(selected.first_at)} 至{' '}
                      {formatTimestamp(selected.record_at)}
                    </span>
                  </>
                )}
                <Button
                  variant='destructive'
                  size='sm'
                  className='ms-auto'
                  onClick={() =>
                    setClearTarget({ kind: 'user', record: selected })
                  }
                >
                  <Trash2 className='size-4' /> 清理访问记录
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
                      <TableHead>结果 / 原因</TableHead>
                      <TableHead className='whitespace-nowrap'>IP</TableHead>
                      <TableHead className='whitespace-nowrap'>
                        归属地
                      </TableHead>
                      <TableHead className='max-w-[420px]'>
                        User-Agent
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventQuery.isFetching ? (
                      <TableRow>
                        <TableCell colSpan={5} className='h-24 text-center'>
                          加载中...
                        </TableCell>
                      </TableRow>
                    ) : eventQuery.isError ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          读取明细失败，请刷新重试。
                        </TableCell>
                      </TableRow>
                    ) : eventRows.length > 0 ? (
                      eventRows.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className='whitespace-nowrap'>
                            {formatTimestamp(event.record_at)}
                          </TableCell>
                          <TableCell className='max-w-72 whitespace-normal'>
                            <Badge
                              variant={
                                event.decision === 'limited' ||
                                event.decision === 'paused'
                                  ? 'destructive'
                                  : 'outline'
                              }
                            >
                              {event.decision
                                ? decisions[event.decision]
                                : '历史去重记录'}
                            </Badge>
                            {event.http_status != null && (
                              <span className='ms-2 text-xs text-muted-foreground'>
                                HTTP {event.http_status}
                              </span>
                            )}
                            {event.reason && (
                              <div className='mt-1 text-xs break-words'>
                                {event.reason}
                              </div>
                            )}
                            {event.retry_at && (
                              <div className='text-xs text-muted-foreground'>
                                {event.decision === 'paused'
                                  ? '计划恢复'
                                  : '窗口结束'}{' '}
                                {formatTimestamp(event.retry_at)}
                              </div>
                            )}
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
                        <TableCell colSpan={5} className='h-28 text-center'>
                          <div>暂无请求明细</div>
                          <div className='mt-1 text-xs text-muted-foreground'>
                            新请求会在这里记录，早期记录可在历史汇总中查询。
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
          )
        ) : tab === 'overview' ? (
          <AccessOverview onSelect={openEvents} />
        ) : tab === 'policy' ? (
          <PolicyPanel />
        ) : tab === 'audit' ? (
          <AccessAudit />
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
                disabled={summaryQuery.isPending || summaryQuery.isError}
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
                      去重次数{sortIcon('count')}
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
                            <UserEmailLink
                              email={record.user_email}
                              fallback={`#${record.user_id}`}
                              onNavigate={() => onOpenChange(false)}
                            />
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
