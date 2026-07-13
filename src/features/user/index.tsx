import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Clock,
  Copy,
  Download,
  FileText,
  Filter,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCw,
  ScrollText,
  Search,
  ShieldAlert,
  Trash2,
  X,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api-client'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import { fetchResellerSites } from '@/features/reseller/api'
import {
  type SubscriptionRiskInfo,
  type SubscriptionRiskType,
  type User,
  type UserFilter,
  type UserRiskMeta,
  type UserSort,
  banUsers,
  destroyUser,
  fetchPlans,
  fetchUsers,
  resetSecret,
  resetUserTraffic,
} from './api'
import { UsageRecordsDialog } from './components/usage-records-dialog'
import {
  UserAdvancedFilter,
  type FilterCondition,
} from './components/user-advanced-filter'
import { UserAssignOrderDialog } from './components/user-assign-order-dialog'
import { UserEditDialog } from './components/user-edit-dialog'
import { UserGenerateDialog } from './components/user-generate-dialog'
import { UserSendMailDialog } from './components/user-send-mail-dialog'
import { UserTrafficDialog } from './components/user-traffic-dialog'
import {
  formatBytes,
  formatDeviceLimit,
  formatExpireStatus,
  formatOnlineStatus,
} from './format'

const route = getRouteApi('/_authenticated/user/')

/** Partial：后端新增规则类型时旧前端回退展示原始标识，不渲染空白徽章。 */
const riskTypeLabels: Partial<Record<SubscriptionRiskType, string>> = {
  frequent: '高频订阅',
  low_usage: '低使用',
  multi_source: '多来源',
}

function SubscriptionRiskCell({
  risk,
}: {
  risk?: SubscriptionRiskInfo | null
}) {
  if (risk === undefined) {
    return (
      <div className='min-w-[17rem] rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground'>
        当前后端暂未提供风险数据
      </div>
    )
  }

  if (risk === null) {
    return (
      <div className='min-w-[17rem] rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground'>
        暂无可用的风险数据
      </div>
    )
  }

  if (risk.level === 'none' || risk.types.length === 0) {
    const coverageDays = risk.activity_coverage_days ?? 0
    const message =
      risk.data_healthy === false
        ? coverageDays > 0
          ? '统计链路异常，当前暂停判定'
          : '风险数据开始采集中'
        : risk.frequent_ready === false
          ? `数据采集中 · 已覆盖 ${coverageDays} 天`
          : risk.low_usage_ready === false
            ? `高频规则已启用 · 低使用采集中（${coverageDays}/30 天）`
            : risk.eligible !== false
              ? '未命中当前已启用的风险规则'
              : '账号当前不可用 · 历史风险未命中'
    return (
      <div className='min-w-[17rem] rounded-md border border-dashed bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground'>
        {message}
      </div>
    )
  }

  const high = risk.level === 'high'

  return (
    <div
      className={cn(
        'min-w-[17rem] space-y-1.5 rounded-md border px-2.5 py-2',
        high
          ? 'border-destructive/35 bg-destructive/5'
          : 'border-amber-500/40 bg-amber-500/5'
      )}
    >
      <div className='flex flex-wrap items-center gap-1'>
        <Badge
          className={cn(
            'gap-1 whitespace-nowrap',
            high
              ? 'bg-destructive/15 text-destructive hover:bg-destructive/20'
              : 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400'
          )}
        >
          <ShieldAlert className='size-3' />
          {high ? '高风险' : '需关注'}
        </Badge>
        {risk.types.map((type) => (
          <Badge
            key={type}
            variant='outline'
            className='bg-background/70 text-[11px] whitespace-nowrap'
          >
            {riskTypeLabels[type] ?? type}
          </Badge>
        ))}
        {risk.eligible === false && (
          <Badge
            variant='outline'
            className='border-dashed bg-background/70 text-[10px] whitespace-nowrap text-muted-foreground'
          >
            历史证据
          </Badge>
        )}
        {risk.data_healthy === false && (
          <Badge
            variant='outline'
            className='border-destructive/40 text-[10px] text-destructive'
          >
            采集异常
          </Badge>
        )}
        {risk.low_usage_ready === false && risk.data_healthy !== false && (
          <Badge
            variant='outline'
            className='border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-400'
          >
            部分规则采集中
          </Badge>
        )}
      </div>
      <div className='text-[11px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums'>
        {(risk.activity_coverage_days ?? 0) >= 30
          ? '近30日'
          : `已采集${risk.activity_coverage_days ?? 0}日`}
        订阅 {risk.subscribe_count_30d} 次 / {risk.subscribe_days_30d} 活跃日
      </div>
      <div className='text-[11px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums'>
        IP 订 {risk.subscribe_ip_count} / 连 {risk.connect_ip_count_30d} · 连接{' '}
        {risk.connect_days_30d} 天 · 流量 {formatBytes(risk.traffic_bytes_30d)}{' '}
        / {risk.traffic_days_30d} 天 · 套餐占比{' '}
        {((risk.traffic_usage_ratio ?? 0) * 100).toFixed(1)}%
      </div>
    </div>
  )
}

function RiskStatusBanner({ meta }: { meta?: UserRiskMeta }) {
  if (!meta) {
    return (
      <div className='flex items-start gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground'>
        <ShieldAlert className='mt-0.5 size-4 shrink-0' />
        当前后端未声明风险分析能力，订阅风险筛选已隐藏。请先发布并迁移后端。
      </div>
    )
  }

  // 以 data_healthy 为主信号：last_write_failure_at 是永久保留的历史水位，
  // 故障恢复后仍有值，单独用它判断会让横幅在一次瞬时故障后永久变红。
  const tone = !meta.data_healthy
    ? 'border-destructive/35 bg-destructive/5 text-destructive'
    : !meta.full_window_ready || !meta.traffic_fresh
      ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400'
      : 'border-emerald-500/35 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
  const message = !meta.data_healthy
    ? '风险采集写入异常且尚未恢复，高频与低使用规则已自动关闭；多来源结果仍可用于人工排查。'
    : meta.activity_coverage_days === 0
      ? '风险数据等待首条有效订阅，当前仅多来源规则可用。'
      : !meta.traffic_fresh
        ? `行为日报已覆盖 ${meta.activity_coverage_days} 天，但流量统计超过新鲜度 SLA，低使用规则已关闭。`
        : !meta.frequent_ready
          ? `行为日报已覆盖 ${meta.activity_coverage_days}/${meta.thresholds.frequent_window_days} 天；当前仅多来源规则可用。`
          : !meta.low_usage_ready
            ? `高频规则已启用；低使用规则仍在采集（${meta.activity_coverage_days}/${meta.thresholds.low_usage_coverage_days} 天）。`
            : !meta.full_window_ready
              ? `高频和低使用规则已启用，当前日报覆盖 ${meta.activity_coverage_days} 天；30 天展示窗口仍在积累。`
              : `风险统计健康，规则版本 ${meta.rule_version}；所有命中仅作为人工复核线索。`

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        tone
      )}
    >
      <ShieldAlert className='mt-0.5 size-4 shrink-0' />
      <span>{message}</span>
    </div>
  )
}

export function UserPage() {
  const queryClient = useQueryClient()

  const navigate = useNavigate()

  // 从其他页面（如订单详情）跳转时携带的邮箱，作为快速搜索的初始值
  const { email: emailFromUrl, invite_user_id: inviteUserId } =
    route.useSearch()

  // 快速搜索（邮箱）
  const [emailInput, setEmailInput] = useState(emailFromUrl ?? '')
  const [appliedEmail, setAppliedEmail] = useState(emailFromUrl ?? '')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 高级筛选
  const [filterOpen, setFilterOpen] = useState(false)
  // 已应用的高级筛选条件（用于回显 + 生成 filter）
  const [conditions, setConditions] = useState<FilterCondition[]>([])
  // 由高级筛选条件生成的后端 filter 项
  const [advancedFilter, setAdvancedFilter] = useState<UserFilter[]>([])
  // 列排序：单列三态 none → asc → desc → none，驱动后端 sort 参数
  const [sort, setSort] = useState<UserSort[]>([])
  const toggleSort = (field: string) => {
    setPage(1)
    setSort((prev) => {
      const cur = prev[0]
      if (!cur || cur.id !== field) return [{ id: field, desc: false }]
      if (!cur.desc) return [{ id: field, desc: true }]
      return []
    })
  }
  const sortHead = (field: string, label: string, className?: string) => {
    const cur = sort[0]
    const sorted = cur && cur.id === field ? (cur.desc ? 'desc' : 'asc') : false
    const icon =
      sorted === 'asc' ? (
        <ArrowUp className='h-4 w-4 text-foreground/70' />
      ) : sorted === 'desc' ? (
        <ArrowDown className='h-4 w-4 text-foreground/70' />
      ) : (
        <ArrowUpDown className='h-4 w-4 text-muted-foreground/70 transition-colors hover:text-foreground/70' />
      )
    return (
      <TableHead
        className={cn('h-11 bg-card px-4 text-muted-foreground', className)}
      >
        <div className='flex items-center gap-1'>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='default'
              onClick={() => toggleSort(field)}
              className='-ml-3 flex h-8 items-center gap-2 font-medium text-nowrap hover:bg-muted/60'
            >
              <span>{label}</span>
              {icon}
            </Button>
          </div>
        </div>
      </TableHead>
    )
  }
  // 异地登录单元格：去重地区数 >1 标红「异地·N」，=1 显示 1，0 显示 —
  const remoteCell = (n?: number) => {
    const c = n ?? 0
    if (c <= 0) return <span className='text-muted-foreground'>—</span>
    if (c > 1)
      return (
        <Badge variant='destructive' className='whitespace-nowrap'>
          异地 · {c}
        </Badge>
      )
    return <span>{c}</span>
  }

  // 多选（当前页选中的用户 id）
  const [selected, setSelected] = useState<number[]>([])

  // 弹窗状态
  const [editing, setEditing] = useState<User | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usagePrefill, setUsagePrefill] = useState<string | undefined>(
    undefined
  )
  const [deleting, setDeleting] = useState<User | null>(null)
  // 行操作：分配订单 / TA的订单 / TA的邀请 / TA的流量记录 / 重置流量
  const [assignTarget, setAssignTarget] = useState<User | null>(null)
  const [trafficTarget, setTrafficTarget] = useState<User | null>(null)
  const [resetTrafficTarget, setResetTrafficTarget] = useState<User | null>(
    null
  )
  // 批量封禁范围：'selected' | 'filtered' | 'all'
  const [batchBanScope, setBatchBanScope] = useState<
    'selected' | 'filtered' | null
  >(null)

  const { data: plans } = useQuery({
    queryKey: ['plans-brief'],
    queryFn: fetchPlans,
  })

  // 分站归属筛选：'' 全部 / 'main' 主站 / 分站 id 字符串
  const [siteFilter, setSiteFilter] = useState('')
  const { data: resellerSites } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
  })

  const filter = useMemo<UserFilter[]>(() => {
    const f: UserFilter[] = []
    if (appliedEmail) f.push({ id: 'email', value: `like:${appliedEmail}` })
    if (inviteUserId != null)
      f.push({ id: 'invite_user_id', value: `eq:${inviteUserId}` })
    if (siteFilter) f.push({ id: 'site_id', value: siteFilter })
    f.push(...advancedFilter)
    return f
  }, [appliedEmail, inviteUserId, siteFilter, advancedFilter])

  const hasFilter = filter.length > 0
  const hasRiskFilter = filter.some((item) => item.id === 'subscription_risk')

  const params = {
    current: page,
    pageSize,
    filter: hasFilter ? filter : undefined,
    sort: sort.length ? sort : undefined,
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
  })

  const total = data?.total ?? 0
  const rows = data?.data ?? []
  const riskMeta = data?.risk_meta
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  const allOnPageSelected =
    rows.length > 0 && rows.every((u) => selected.includes(u.id))
  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelected((s) => s.filter((id) => !rows.some((u) => u.id === id)))
    } else {
      setSelected((s) => [...new Set([...s, ...rows.map((u) => u.id)])])
    }
  }
  const toggleOne = (id: number) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    )

  const applyQuickSearch = () => {
    setAppliedEmail(emailInput.trim())
    setSelected([])
    setPage(1)
  }

  // 应用高级筛选：保存条件与生成的 filter 项
  const applyAdvancedFilter = (f: UserFilter[], conds: FilterCondition[]) => {
    setAdvancedFilter(f)
    setConditions(conds)
    setSelected([])
    setPage(1)
  }

  // 重置高级筛选
  const resetAdvancedFilter = () => {
    setAdvancedFilter([])
    setConditions([])
    setSelected([])
    setPage(1)
  }

  const resetMutation = useMutation({
    mutationFn: (id: number) => resetSecret(id),
    onSuccess: () => {
      toast.success('订阅已重置')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const batchBanMutation = useMutation({
    mutationFn: (scope: 'selected' | 'filtered') =>
      banUsers({
        scope,
        user_ids: scope === 'selected' ? selected : undefined,
        filter: scope === 'filtered' && hasFilter ? filter : undefined,
      }),
    onSuccess: (result) => {
      // 旧后端返回 boolean 而非结构化结果；仅在字段确实存在时展示明细，
      // 避免「已封禁 undefined 个用户」和误报审计失败。
      if (typeof result?.banned_count === 'number') {
        toast.success(
          `已封禁 ${result.banned_count} 个用户${result.protected_count > 0 ? `，保护并跳过 ${result.protected_count} 个管理员/员工` : ''}`
        )
        if (result.audit_logged === false) {
          toast.warning(
            `封禁已完成，但结果审计写入失败；操作编号 ${result.action_id}`
          )
        }
      } else {
        toast.success('批量封禁成功')
      }
      setBatchBanScope(null)
      setSelected([])
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const resetTrafficMutation = useMutation({
    mutationFn: (id: number) => resetUserTraffic(id),
    onSuccess: () => {
      toast.success('流量已重置')
      setResetTrafficTarget(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => destroyUser(id),
    onSuccess: () => {
      toast.success('已删除')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const exportCSV = async () => {
    try {
      const scope =
        selected.length > 0 ? 'selected' : hasFilter ? 'filtered' : 'all'
      const res = await adminApi.post(
        '/user/dumpCSV',
        {
          scope,
          user_ids: scope === 'selected' ? selected : undefined,
          filter: scope === 'filtered' ? filter : undefined,
        },
        { responseType: 'blob' }
      )
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      handleServerError(e)
    }
  }

  const openUsageForUser = (u: User) => {
    setUsagePrefill(u.email)
    setUsageOpen(true)
  }

  const copyUrl = (u: User) => {
    if (!u.subscribe_url) {
      toast.error('暂无订阅地址')
      return
    }
    navigator.clipboard
      .writeText(u.subscribe_url)
      .then(() => toast.success('订阅URL已复制'))
      .catch(() => toast.error('复制失败'))
  }

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
            <h2 className='text-2xl font-bold tracking-tight'>用户管理</h2>
            <p className='mt-2 text-muted-foreground'>
              在这里可以管理用户，包括增加、删除、编辑、查询等操作。
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              onClick={() => {
                setUsagePrefill(undefined)
                setUsageOpen(true)
              }}
            >
              <ScrollText className='size-4' /> 使用记录
            </Button>
            <Button variant='outline' onClick={() => setMailOpen(true)}>
              <Mail className='size-4' /> 发送邮件
            </Button>
            <Button variant='outline' onClick={exportCSV}>
              <Download className='size-4' /> 导出 CSV
            </Button>
            <Button onClick={() => setGenerateOpen(true)}>
              <Plus className='size-4' /> 创建用户
            </Button>
          </div>
        </div>

        {/* 搜索 + 高级筛选 */}
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            className='h-9 w-56'
            placeholder='搜索用户邮箱...'
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyQuickSearch()}
          />
          <Button onClick={applyQuickSearch}>
            <Search className='size-4' /> 查询
          </Button>
          {(resellerSites ?? []).length > 0 && (
            <Select
              value={siteFilter || 'all'}
              onValueChange={(v) => {
                setSiteFilter(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className='h-9 w-[160px]'>
                <SelectValue placeholder='全部站点' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部站点</SelectItem>
                <SelectItem value='main'>主站</SelectItem>
                {(resellerSites ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant='outline' onClick={() => setFilterOpen(true)}>
            <Filter className='size-4' /> 高级筛选
            {conditions.length > 0 && (
              <Badge variant='secondary' className='ms-1'>
                {conditions.length}
              </Badge>
            )}
          </Button>
          {conditions.length > 0 && (
            <Button variant='ghost' size='sm' onClick={resetAdvancedFilter}>
              <X className='size-4' /> 清除筛选
            </Button>
          )}
        </div>

        {/* 「TA的邀请」跳转筛选提示（invite_user_id） */}
        {inviteUserId != null && (
          <div className='flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm'>
            <Users className='size-4 text-muted-foreground' />
            <span>仅显示 邀请人 #{inviteUserId} 邀请的用户</span>
            <Button
              variant='ghost'
              size='sm'
              className='ms-auto h-7'
              onClick={() =>
                navigate({
                  to: '/user',
                  search: (prev) => ({ ...prev, invite_user_id: undefined }),
                })
              }
            >
              <X className='size-4' /> 清除
            </Button>
          </div>
        )}

        {/* 请求失败时不渲染：此时 riskMeta 缺失是网络/服务问题，不代表后端无能力 */}
        {!isLoading && !isError && <RiskStatusBanner meta={riskMeta} />}

        {/* 批量操作栏 */}
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm text-muted-foreground'>
            已选择 {selected.length} 项
          </span>
          <Button
            variant='destructive'
            size='sm'
            disabled={selected.length === 0}
            onClick={() => setBatchBanScope('selected')}
          >
            <Ban className='size-4' /> 批量封禁（选中）
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={!hasFilter || hasRiskFilter}
            title={
              hasRiskFilter ? '风险结果必须逐个复核并勾选后才能封禁' : undefined
            }
            onClick={() => setBatchBanScope('filtered')}
          >
            封禁筛选结果
          </Button>
          {selected.length > 0 && (
            <Button variant='ghost' size='sm' onClick={() => setSelected([])}>
              清除选择
            </Button>
          )}
        </div>

        <div className='relative overflow-auto rounded-md border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='h-11 w-10 bg-card px-4 text-muted-foreground'>
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label='全选本页'
                  />
                </TableHead>
                {sortHead('id', 'ID', 'w-16')}
                <TableHead className='h-11 bg-card px-4 text-muted-foreground'>
                  邮箱
                </TableHead>
                <TableHead className='h-11 bg-card px-4 text-muted-foreground'>
                  订阅
                </TableHead>
                <TableHead className='h-11 bg-card px-4 text-muted-foreground'>
                  权限组
                </TableHead>
                <TableHead className='h-11 bg-card px-4 whitespace-nowrap text-muted-foreground'>
                  分站
                </TableHead>
                {sortHead('expired_at', '到期时间')}
                {sortHead('total_used', '已用流量')}
                {sortHead('transfer_enable', '总流量')}
                {sortHead('balance', '余额')}
                {sortHead('commission_balance', '佣金')}
                {sortHead('online_count', '在线设备')}
                <TableHead className='h-11 bg-card px-4 whitespace-nowrap text-muted-foreground'>
                  订阅异地
                </TableHead>
                <TableHead className='h-11 bg-card px-4 whitespace-nowrap text-muted-foreground'>
                  连接异地
                </TableHead>
                <TableHead className='h-11 min-w-[18rem] bg-card px-4 whitespace-nowrap text-muted-foreground'>
                  风险分析
                </TableHead>
                {sortHead('banned', '状态')}
                {sortHead('created_at', '注册时间')}
                <TableHead className='h-11 bg-card px-4 text-end text-muted-foreground'>
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={18} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((u) => {
                  const exp = formatExpireStatus(u.expired_at)
                  const on = formatOnlineStatus(u.t)
                  return (
                    <TableRow
                      key={u.id}
                      className='animate-fade-in hover:bg-muted/50'
                      data-state={
                        selected.includes(u.id) ? 'selected' : undefined
                      }
                    >
                      <TableCell className='bg-card'>
                        <Checkbox
                          checked={selected.includes(u.id)}
                          onCheckedChange={() => toggleOne(u.id)}
                          aria-label={`选择 ${u.email}`}
                        />
                      </TableCell>
                      <TableCell className='bg-card'>
                        <Badge variant='outline'>{u.id}</Badge>
                      </TableCell>
                      <TableCell className='bg-card font-medium'>
                        <div
                          className='group flex items-center gap-2.5'
                          title={on.text}
                        >
                          <div
                            className={cn(
                              'size-2.5 rounded-full ring-2 ring-offset-2 transition-all duration-300',
                              on.online
                                ? 'bg-green-500 ring-green-500/20'
                                : 'bg-gray-300 ring-gray-300/20'
                            )}
                          />
                          <span className='inline-flex min-w-[14em] cursor-pointer flex-col font-medium text-foreground/90 transition-colors hover:text-primary hover:underline'>
                            <span className='break-all'>{u.email}</span>
                          </span>
                          {!!u.is_admin && (
                            <Badge variant='outline'>管理员</Badge>
                          )}
                          {!!u.is_staff && (
                            <Badge variant='outline'>员工</Badge>
                          )}
                          <button
                            type='button'
                            tabIndex={-1}
                            aria-label='复制邮箱'
                            style={{ lineHeight: 0 }}
                            className='ml-1 rounded bg-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted'
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard
                                .writeText(u.email)
                                .then(() => toast.success('复制成功'))
                                .catch(() => toast.error('复制失败'))
                            }}
                          >
                            <Copy className='h-4 w-4 text-muted-foreground' />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className='bg-card'>
                        <div className='min-w-[10em] break-all'>
                          {u.plan?.name ?? (
                            <span className='text-muted-foreground'>-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='bg-card'>
                        <div className='flex flex-wrap gap-1'>
                          <Badge
                            variant='outline'
                            className='flex cursor-default items-center gap-1.5 border border-border/50 bg-secondary/50 px-2 py-0.5 font-medium whitespace-nowrap transition-all duration-200 select-none hover:bg-secondary/70'
                          >
                            {u.group?.name || '-'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className='bg-card whitespace-nowrap'>
                        {u.site_name ? (
                          <Badge variant='secondary'>{u.site_name}</Badge>
                        ) : (
                          <span className='text-xs text-muted-foreground'>
                            主站
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='bg-card whitespace-nowrap'>
                        <Badge
                          variant='outline'
                          className={cn(
                            'w-full justify-center transition-colors',
                            exp.expired
                              ? 'border-destructive/50 bg-destructive/10 text-destructive'
                              : exp.permanent
                                ? 'border-primary/40 bg-primary/5 text-primary/90'
                                : exp.expiringSoon
                                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-500'
                                  : 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-500'
                          )}
                        >
                          {exp.permanent
                            ? '长期有效'
                            : (() => {
                                const d = new Date(u.expired_at! * 1000)
                                const m = String(d.getMonth() + 1).padStart(
                                  2,
                                  '0'
                                )
                                const day = String(d.getDate()).padStart(2, '0')
                                return `${d.getFullYear()}-${m}-${day}`
                              })()}
                        </Badge>
                      </TableCell>
                      {(() => {
                        const used = u.total_used ?? (u.u ?? 0) + (u.d ?? 0)
                        const total = u.transfer_enable ?? 0
                        const pct = total > 0 ? (used / total) * 100 : 0
                        return (
                          <>
                            <TableCell className='min-w-[7rem] bg-card'>
                              <div className='w-full space-y-1'>
                                <div className='flex justify-between text-sm'>
                                  <span className='text-muted-foreground'>
                                    {formatBytes(used)}
                                  </span>
                                  <span className='text-xs text-muted-foreground'>
                                    {pct.toFixed(1)}%
                                  </span>
                                </div>
                                <div className='h-1.5 w-full rounded-full bg-secondary'>
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      pct > 90 ? 'bg-destructive' : 'bg-primary'
                                    )}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className='bg-card font-medium whitespace-nowrap text-muted-foreground'>
                              {formatBytes(total)}
                            </TableCell>
                          </>
                        )
                      })()}
                      <TableCell className='bg-card whitespace-nowrap'>
                        <div className='flex items-center gap-1 font-medium'>
                          <span className='text-sm text-muted-foreground'>
                            ¥
                          </span>
                          <span className='text-foreground tabular-nums'>
                            {Number(u.balance ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className='bg-card whitespace-nowrap'>
                        <div className='flex items-center gap-1 font-medium'>
                          <span className='text-sm text-muted-foreground'>
                            ¥
                          </span>
                          <span className='text-foreground tabular-nums'>
                            {Number(u.commission_balance ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className='bg-card'
                        title={formatDeviceLimit(u.device_limit)}
                      >
                        <div className='flex items-center gap-1.5'>
                          <Badge
                            variant='outline'
                            className={cn(
                              'min-w-[4rem] justify-center',
                              u.device_limit != null &&
                                (u.online_count ?? 0) >= u.device_limit
                                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                                : 'border-primary/40 bg-primary/5 text-primary/90'
                            )}
                          >
                            {u.online_count ?? 0} /{' '}
                            {u.device_limit == null ? '∞' : u.device_limit}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className='bg-card'>
                        {remoteCell(u.subscribe_locations)}
                      </TableCell>
                      <TableCell className='bg-card'>
                        {remoteCell(u.connect_locations)}
                      </TableCell>
                      <TableCell className='bg-card'>
                        <SubscriptionRiskCell risk={u.subscription_risk} />
                      </TableCell>
                      <TableCell className='bg-card'>
                        <div className='flex justify-center'>
                          <Badge
                            className={cn(
                              'min-w-20 justify-center transition-colors',
                              u.banned
                                ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                                : 'bg-green-500/15 text-green-600 hover:bg-green-500/25 dark:text-green-500'
                            )}
                          >
                            {u.banned ? '封禁' : '正常'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className='bg-card text-sm whitespace-nowrap text-muted-foreground'>
                        <div className='truncate'>
                          {new Date(u.created_at * 1000).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className='bg-card'>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <div className='text-center'>
                              <Button
                                variant='ghost'
                                className='h-8 w-8 p-0 hover:bg-muted'
                                aria-label='操作'
                              >
                                <MoreHorizontal className='size-4' />
                              </Button>
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(u)
                                setEditOpen(true)
                              }}
                            >
                              <Pencil className='size-4' /> 编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setAssignTarget(u)}
                            >
                              <Plus className='size-4' /> 分配订单
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyUrl(u)}>
                              <Copy className='size-4' /> 复制订阅URL
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => resetMutation.mutate(u.id)}
                            >
                              <RotateCw className='size-4' /> 重置UUID及订阅URL
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                navigate({
                                  to: '/order',
                                  search: { user_id: `eq:${u.id}` },
                                })
                              }
                            >
                              <FileText className='size-4' /> TA的订单
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                navigate({
                                  to: '/user',
                                  search: { invite_user_id: u.id },
                                })
                              }
                            >
                              <Users className='size-4' /> TA的邀请
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTrafficTarget(u)}
                            >
                              <Clock className='size-4' /> TA的流量记录
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openUsageForUser(u)}
                            >
                              <ScrollText className='size-4' /> 使用记录
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setResetTrafficTarget(u)}
                            >
                              <RotateCw className='size-4' /> 重置流量
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className='text-destructive'
                              onClick={() => setDeleting(u)}
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
                  <TableCell colSpan={18} className='h-24 text-center'>
                    未找到结果
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
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
          left={
            <>
              已选择 {selected.length} 项，共 {total} 个用户
            </>
          }
        />
      </Main>

      <UserAdvancedFilter
        open={filterOpen}
        onOpenChange={setFilterOpen}
        plans={plans}
        riskMeta={riskMeta}
        initial={conditions}
        onApply={applyAdvancedFilter}
        onReset={resetAdvancedFilter}
      />

      <UserEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        current={editing}
      />
      <UserGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      <UserSendMailDialog
        open={mailOpen}
        onOpenChange={setMailOpen}
        filter={filter}
        selectedIds={selected}
        sort={sort}
      />
      <UsageRecordsDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        prefillKeyword={usagePrefill}
      />

      <UserAssignOrderDialog
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        email={assignTarget?.email}
      />
      <UserTrafficDialog
        open={!!trafficTarget}
        onOpenChange={(o) => !o && setTrafficTarget(null)}
        user={trafficTarget}
      />

      <ConfirmDialog
        open={!!resetTrafficTarget}
        onOpenChange={(o) => !o && setResetTrafficTarget(null)}
        title='重置流量'
        desc={`确定重置用户「${resetTrafficTarget?.email}」的已用流量吗？该用户的已用流量将清零。`}
        confirmText='重置'
        destructive
        isLoading={resetTrafficMutation.isPending}
        handleConfirm={() =>
          resetTrafficTarget &&
          resetTrafficMutation.mutate(resetTrafficTarget.id)
        }
      />

      <ConfirmDialog
        open={!!batchBanScope}
        onOpenChange={(o) => !o && setBatchBanScope(null)}
        title='确认批量封禁'
        desc={
          batchBanScope === 'selected'
            ? `此操作将封禁选中的 ${selected.length} 个用户。此操作无法撤销。`
            : '此操作将封禁所有符合当前筛选条件的用户。此操作无法撤销。'
        }
        confirmText='确认封禁'
        destructive
        isLoading={batchBanMutation.isPending}
        handleConfirm={() =>
          batchBanScope && batchBanMutation.mutate(batchBanScope)
        }
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='确认删除用户'
        desc={`此操作将永久删除用户「${deleting?.email}」及其所有相关数据，包括订单、优惠码、流量记录、工单记录等信息。删除后无法恢复，是否继续？`}
        confirmText='删除'
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  )
}
