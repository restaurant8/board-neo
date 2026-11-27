import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getCookie, setCookie } from '@/lib/cookies'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
  type UsageOrderBy,
  type UsageOrderDir,
  type UsageRecordType,
  clearUsageRecords,
  fetchUsageRecords,
} from '../api'
import { formatTimestamp } from '../format'

const DEFAULT_PAGE_SIZE = 50
const MODE_COOKIE = 'usage_records_mode'

export type UsageRecordsPanelProps = {
  includeForeignLocations: boolean
  onForeignLocationsChange: (enabled: boolean) => void
  /** 是否激活（用于 Tab / 抽屉内按需拉取数据，默认 true） */
  active?: boolean
  /** 预填用户（可被用户手动清除/切换） */
  prefillUser?: { id: number; email?: string }
  /** 锁定单用户（用于取证抽屉：固定查该用户，隐藏用户搜索与“清空全部”） */
  lockedUser?: { id: number; email?: string }
  /** 路由跳转离开时的回调（如关闭弹窗/抽屉） */
  onNavigateAway?: () => void
  /** 默认时间范围（抽屉取证默认 7d，方便核对近期轨迹；全页默认 today） */
  defaultRange?: 'today' | '7d' | '15d' | '30d' | 'all'
}

export function UsageRecordsPanel({
  active = true,
  prefillUser,
  lockedUser,
  includeForeignLocations,
  onForeignLocationsChange,
  onNavigateAway,
  defaultRange = 'today',
}: UsageRecordsPanelProps) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'strict' | 'relaxed'>(() =>
    getCookie(MODE_COOKIE) === 'strict' ? 'strict' : 'relaxed'
  )
  const [detail, setDetail] = useState<{
    id: number
    userId: number
    location: string
    page: number
  } | null>(null)
  const relaxed = mode === 'relaxed' && !detail

  const targetUser = lockedUser ?? prefillUser
  const initialKeyword = targetUser?.email ?? (targetUser ? String(targetUser.id) : '')

  // 表单输入（待提交）
  const [keywordInput, setKeywordInput] = useState(initialKeyword)
  const [ipInput, setIpInput] = useState('')
  const [typeInput, setTypeInput] = useState<UsageRecordType | ''>('')

  // 已应用的查询条件
  const [applied, setApplied] = useState<{
    keyword: string
    ip: string
    type: UsageRecordType | ''
  }>({ keyword: initialKeyword, ip: '', type: '' })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [orderBy, setOrderBy] = useState<UsageOrderBy>('record_at')
  const [orderDir, setOrderDir] = useState<UsageOrderDir>('desc')
  const [clearMode, setClearMode] = useState<'scoped' | 'all' | null>(null)

  // 时间范围：默认今天（或抽屉传入的 7d），可切最近 7/15/30 天或自定义起止日期
  const [rangeMode, setRangeMode] = useState<string>(defaultRange)
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

  // 目标用户或激活状态变化时同步重置查询条件（渲染期间派生重置）
  const [loaded, setLoaded] = useState<{
    active: boolean
    userId?: number
    email?: string
  }>({ active, userId: targetUser?.id, email: targetUser?.email })

  if (
    loaded.userId !== targetUser?.id ||
    loaded.email !== targetUser?.email ||
    (!loaded.active && active)
  ) {
    setLoaded({ active, userId: targetUser?.id, email: targetUser?.email })
    if (active) {
      setDetail(null)
      const kw =
        targetUser?.email ?? (targetUser ? String(targetUser.id) : '')
      setKeywordInput(kw)
      setIpInput('')
      setTypeInput('')
      setApplied({ keyword: kw, ip: '', type: '' })
      setPage(1)
      setPageSize(DEFAULT_PAGE_SIZE)
      setOrderBy('record_at')
      setOrderDir('desc')
      setRangeMode(defaultRange)
      setCustomStart('')
      setCustomEnd('')
    }
  }

  const userFilter = lockedUser
    ? { user_id: lockedUser.id }
    : prefillUser &&
        (applied.keyword === (prefillUser.email ?? '') ||
          applied.keyword === String(prefillUser.id))
      ? { user_id: prefillUser.id }
      : { keyword: applied.keyword || undefined }
  const queryParams = {
    include_foreign_locations: Number(includeForeignLocations),
    mode: detail ? ('strict' as const) : mode,
    location_record_id: detail?.id,
    ...userFilter,
    user_id: detail?.userId ?? userFilter.user_id,
    ip: applied.ip || undefined,
    type: applied.type || undefined,
    ...timeRange,
    order_by: orderBy,
    order_dir: orderDir,
    page,
    page_size: pageSize,
  }

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['usage-records', queryParams],
    queryFn: () => fetchUsageRecords(queryParams),
    enabled: active,
  })

  const hasFilter = !!(
    (!lockedUser && applied.keyword) ||
    applied.ip ||
    applied.type
  )
  // 一键清除是否被限定范围（除关键词/IP/类型外，非「全部时间」也算限定）
  const clearScoped =
    hasFilter || rangeMode !== 'all' || !includeForeignLocations || !!lockedUser
  const total = data?.total ?? 0
  const rows = data?.data ?? []
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  const applyFilters = () => {
    setApplied({
      keyword: lockedUser ? initialKeyword : keywordInput.trim(),
      ip: ipInput.trim(),
      type: typeInput,
    })
    setPage(1)
  }

  const resetFilters = () => {
    if (!lockedUser) {
      setKeywordInput('')
    }
    setIpInput('')
    setTypeInput('')
    setApplied({
      keyword: lockedUser ? initialKeyword : '',
      ip: '',
      type: '',
    })
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
              include_foreign_locations: Number(includeForeignLocations),
              ...userFilter,
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
      queryClient.invalidateQueries({ queryKey: ['subscription-access'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-audit'] })
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
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='text-xs text-muted-foreground'>
        {detail
          ? `当前查看归属地明细：${detail.location || '未知归属地'}`
          : relaxed
            ? '宽松模式：同一账号的完整归属地相同则合并，点击 IP 可展开该地区原始 IP 明细。'
            : '严格模式：显示每个账号的原始 IP、类型（连接/订阅）和节点记录。'}
      </div>

      {/* 筛选条 */}
      <div className='flex flex-wrap items-center gap-2'>
        {detail ? (
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              setPage(detail.page)
              setDetail(null)
            }}
          >
            <ArrowLeft className='size-4' /> 返回归属地汇总
          </Button>
        ) : (
          <div className='flex items-center gap-2'>
            <Switch
              id={
                lockedUser
                  ? `usage-records-strict-mode-${lockedUser.id}`
                  : 'usage-records-strict-mode'
              }
              checked={mode === 'strict'}
              onCheckedChange={(checked) => {
                const next = checked ? 'strict' : 'relaxed'
                setMode(next)
                setCookie(MODE_COOKIE, next, 365 * 86400)
                setPage(1)
              }}
            />
            <Label
              htmlFor={
                lockedUser
                  ? `usage-records-strict-mode-${lockedUser.id}`
                  : 'usage-records-strict-mode'
              }
            >
              严格模式
            </Label>
          </div>
        )}
        {!detail && (
          <>
            <div
              className='flex items-center gap-2'
              title='同时影响订阅异地、连接异地和使用记录'
            >
              <Switch
                id={
                  lockedUser
                    ? `usage-records-include-foreign-${lockedUser.id}`
                    : 'usage-records-include-foreign'
                }
                checked={includeForeignLocations}
                onCheckedChange={(enabled) => {
                  onForeignLocationsChange(enabled)
                  setPage(1)
                }}
              />
              <Label
                htmlFor={
                  lockedUser
                    ? `usage-records-include-foreign-${lockedUser.id}`
                    : 'usage-records-include-foreign'
                }
              >
                计入其他国家
              </Label>
            </div>
            {hasFilter && (
              <Button variant='outline' size='sm' onClick={resetFilters}>
                <ArrowLeft className='size-4' /> 重置筛选
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
            {!lockedUser && (
              <Input
                className='h-8 w-44'
                placeholder='用户邮箱 / ID'
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            )}
            <Input
              className='h-8 w-36'
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
              <SelectTrigger className='h-8 w-28'>
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
          </>
        )}
        <Button variant='outline' size='sm' onClick={() => refetch()}>
          <RefreshCw className='size-4' /> 刷新
        </Button>
        {!detail && !lockedUser && (
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
        )}
      </div>

      {/* 表格 */}
      <div className='min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border'>
        <Table className='w-max min-w-full'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              {!lockedUser && (
                <TableHead className='min-w-[200px] whitespace-nowrap'>
                  用户
                </TableHead>
              )}
              <TableHead
                className='w-[72px] cursor-pointer whitespace-nowrap select-none'
                onClick={() => toggleSort('online')}
              >
                在线 IP{sortIcon('online')}
              </TableHead>
              <TableHead className='whitespace-nowrap'>类型</TableHead>
              <TableHead className='whitespace-nowrap'>IP</TableHead>
              <TableHead className='whitespace-nowrap'>归属地</TableHead>
              {!relaxed && (
                <>
                  <TableHead className='whitespace-nowrap'>节点</TableHead>
                  <TableHead className='max-w-[280px]'>User-Agent</TableHead>
                </>
              )}
              <TableHead
                className='w-[64px] cursor-pointer whitespace-nowrap select-none'
                onClick={() => toggleSort('count')}
              >
                累计次数{sortIcon('count')}
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
                <TableCell
                  colSpan={(relaxed ? 7 : 9) - (lockedUser ? 1 : 0)}
                  className='h-24 text-center'
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={(relaxed ? 7 : 9) - (lockedUser ? 1 : 0)}
                  className='h-24 text-center'
                >
                  使用记录加载失败，请点击刷新重试。
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((r) => (
                <TableRow key={r.id}>
                  {!lockedUser && (
                    <TableCell className='min-w-[200px] max-w-[260px] align-top'>
                      <div
                        className='truncate whitespace-nowrap'
                        title={r.user_email || `#${r.user_id}`}
                      >
                        <UserEmailLink
                          email={r.user_email}
                          fallback={`#${r.user_id}`}
                          className='break-normal whitespace-nowrap'
                          onNavigate={onNavigateAway}
                        />
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        ID {r.user_id}
                      </div>
                      {relaxed && r.region_count != null && (
                        <div
                          className={
                            r.region_count > 1
                              ? 'text-xs font-medium text-amber-700 dark:text-amber-400'
                              : 'text-xs text-muted-foreground'
                          }
                          title='当前筛选范围内，该账号所有记录中可识别的不同地区数'
                        >
                          {r.region_count
                            ? `涉及 ${r.region_count} 个地区`
                            : '地区未知'}
                        </div>
                      )}
                    </TableCell>
                  )}
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
                    {r.type !== 'connect' && (
                      <Badge variant='secondary' className='text-blue-600'>
                        订阅
                      </Badge>
                    )}
                    {r.type !== 'subscribe' && (
                      <Badge variant='secondary' className='text-emerald-600'>
                        连接
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className='font-mono text-xs whitespace-nowrap'
                    title={r.ip}
                  >
                    {relaxed ? (
                      <Button
                        variant='link'
                        size='sm'
                        className='h-auto p-0 font-mono text-xs'
                        onClick={() => {
                          setDetail({
                            id: r.id,
                            userId: r.user_id,
                            location: r.location ?? '',
                            page,
                          })
                          setPage(1)
                        }}
                      >
                        {(r.ip_count ?? 0) > 1 ? `${r.ip_count} 个 IP` : r.ip}
                      </Button>
                    ) : (
                      r.ip
                    )}
                  </TableCell>
                  <TableCell
                    className='whitespace-nowrap'
                    title={r.location || ''}
                  >
                    {r.location || (
                      <span className='text-muted-foreground'>
                        {relaxed ? '未知归属地' : '—'}
                      </span>
                    )}
                  </TableCell>
                  {!relaxed && (
                    <>
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
                    </>
                  )}
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
                <TableCell
                  colSpan={(relaxed ? 7 : 9) - (lockedUser ? 1 : 0)}
                  className='h-24 text-center'
                >
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
        left={relaxed ? `共 ${total} 组归属地` : undefined}
        totalPages={maxPage}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
      />

      <ConfirmDialog
        open={!!clearMode}
        onOpenChange={(nextOpen) => !nextOpen && setClearMode(null)}
        title='清除使用记录'
        desc={
          clearMode === 'scoped'
            ? '确认清除当前筛选范围内的使用记录（含时间和国家范围）？此操作不可恢复。'
            : '确认清除所有国家的全部使用记录？此操作不可恢复！'
        }
        confirmText='清除'
        destructive
        isLoading={clearMutation.isPending}
        handleConfirm={() => clearMode && clearMutation.mutate(clearMode)}
      />
    </div>
  )
}

type DialogProps = {
  includeForeignLocations: boolean
  onForeignLocationsChange: (enabled: boolean) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillUser?: { id: number; email: string }
}

export function UsageRecordsDialog({
  open,
  onOpenChange,
  prefillUser,
  includeForeignLocations,
  onForeignLocationsChange,
}: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[85dvh] max-h-[85dvh] w-[95vw] max-w-6xl flex-col gap-3 sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle>使用记录</DialogTitle>
          <DialogDescription>
            查看用户历史连接与订阅 IP 及归属地记录。
          </DialogDescription>
        </DialogHeader>
        <UsageRecordsPanel
          active={open}
          prefillUser={prefillUser}
          includeForeignLocations={includeForeignLocations}
          onForeignLocationsChange={onForeignLocationsChange}
          onNavigateAway={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
