import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  Gauge,
  Globe,
  History,
  Info,
  MoreHorizontal,
  Network,
  RefreshCw,
  RotateCw,
  ScrollText,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { getCookie, setCookie } from '@/lib/cookies'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { UserEmailLink } from '@/components/user-email-link'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import { fetchResellerSites } from '@/features/reseller/api'
import { resetSecret, updateUser } from '@/features/user/api'
import { SubscriptionRecordsPanel } from '@/features/user/components/subscription-records-dialog'
import { UsageRecordsPanel } from '@/features/user/components/usage-records-dialog'
import {
  RISK_RULE_LABELS,
  type OnlineConnectionOrderBy,
  type OnlineConnectionRow,
  type RiskFilterLevel,
  type RiskLevel,
  type RiskRuleCode,
  fetchOnlineConnections,
} from './api'
import { ConnectionDetailSheet } from './connection-detail-sheet'
import { SpeedLimitDialog } from './speed-limit-dialog'
import {
  buildExactIpFilterState,
  reconcileDetailSnapshot,
  reconcileUrlSearchSync,
} from './state'

const route = getRouteApi('/_authenticated/user/connections')

const ALL = '__all__'
const FOREIGN_LOCATIONS_COOKIE = 'usage_records_include_foreign_locations'

type WorkspaceTab = 'realtime' | 'usage' | 'subscription'

const REFRESH_OPTIONS = [
  { label: '关闭自动刷新', value: '0' },
  { label: '每 5 秒刷新', value: '5000' },
  { label: '每 10 秒刷新', value: '10000' },
  { label: '每 30 秒刷新', value: '30000' },
]

function formatRelativeTime(ts: number) {
  if (!ts) return '-'
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (diff < 5) return '刚刚'
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  return new Date(ts * 1000).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatExactTime(ts: number) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

function riskBadgeClass(level: RiskLevel) {
  switch (level) {
    case 'critical':
      return 'border-destructive/50 bg-destructive/10 text-destructive'
    case 'warning':
      return 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-500'
    case 'low':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
    default:
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
  }
}

function riskLabel(level: RiskLevel) {
  switch (level) {
    case 'critical':
      return '高危'
    case 'warning':
      return '预警'
    case 'low':
      return '关注'
    default:
      return '正常'
  }
}

export function UserConnectionsPage() {
  const queryClient = useQueryClient()
  const navigate = route.useNavigate()
  const {
    tab: urlTab,
    keyword: urlKeyword,
    user_id: urlUserId,
    server_id: urlServerId,
  } = route.useSearch()

  const activeTab: WorkspaceTab = urlTab ?? 'realtime'
  const setActiveTab = (next: WorkspaceTab) => {
    navigate({
      search: (prev) => ({
        ...prev,
        tab: next === 'realtime' ? undefined : next,
      }),
      replace: true,
    })
  }

  const [includeForeignLocations, setIncludeForeignLocations] = useState(
    () => getCookie(FOREIGN_LOCATIONS_COOKIE) === '1'
  )
  const changeForeignLocations = (enabled: boolean) => {
    setIncludeForeignLocations(enabled)
    setCookie(FOREIGN_LOCATIONS_COOKIE, enabled ? '1' : '0', 365 * 86400)
  }

  const prefillUser =
    urlUserId != null
      ? { id: urlUserId, email: urlKeyword }
      : undefined

  const [keywordInput, setKeywordInput] = useState(urlKeyword ?? '')
  const [appliedKeyword, setAppliedKeyword] = useState(urlKeyword ?? '')
  /** 独立精确客户端 IP 反查条件，严格相等，避免 192.0.2.1 混入 192.0.2.10。 */
  const [exactIp, setExactIp] = useState<string>('')
  const [serverId, setServerId] = useState<string>(
    urlServerId ? String(urlServerId) : ALL
  )
  const [siteId, setSiteId] = useState<string>(ALL)
  const [riskLevel, setRiskLevel] = useState<string>(ALL)
  const [riskRule, setRiskRule] = useState<string>(ALL)
  const [minConnInput, setMinConnInput] = useState<string>('')
  const [appliedMinConn, setAppliedMinConn] = useState<number | undefined>(
    undefined
  )
  const [onlyOverLimit, setOnlyOverLimit] = useState(false)

  const [orderBy, setOrderBy] =
    useState<OnlineConnectionOrderBy>('connections')
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [refreshMs, setRefreshMs] = useState<number>(10000)

  const [syncedSearch, setSyncedSearch] = useState({
    keyword: urlKeyword,
    serverId: urlServerId,
  })
  const urlSync = reconcileUrlSearchSync(syncedSearch, {
    keyword: urlKeyword,
    serverId: urlServerId,
  })
  if (urlSync.changed) {
    setSyncedSearch(urlSync.nextSyncedSearch)
    if (urlSync.applyKeyword !== undefined) {
      setKeywordInput(urlSync.applyKeyword)
      setAppliedKeyword(urlSync.applyKeyword)
      setPage(1)
    }
    if (urlSync.applyServerId !== undefined) {
      setServerId(urlSync.applyServerId)
      setPage(1)
    }
  }

  const [selectedRowSnapshot, setSelectedRowSnapshot] =
    useState<OnlineConnectionRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [banTarget, setBanTarget] = useState<OnlineConnectionRow | null>(null)
  const [speedTarget, setSpeedTarget] = useState<OnlineConnectionRow | null>(
    null
  )

  const queryParams = {
    keyword: appliedKeyword || undefined,
    ip: exactIp || undefined,
    server_id: serverId !== ALL ? Number(serverId) : undefined,
    site_id: siteId !== ALL ? siteId : undefined,
    min_connections: appliedMinConn,
    only_over_limit: onlyOverLimit ? (1 as const) : undefined,
    risk_level:
      riskLevel !== ALL ? (riskLevel as RiskFilterLevel) : undefined,
    risk_rule: riskRule !== ALL ? (riskRule as RiskRuleCode) : undefined,
    order_by: orderBy,
    order_dir: orderDir,
    page,
    page_size: pageSize,
  }

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['user-online-connections', queryParams],
    queryFn: () => fetchOnlineConnections(queryParams),
    enabled: activeTab === 'realtime',
    refetchInterval:
      activeTab === 'realtime' && refreshMs > 0 ? refreshMs : false,
  })

  const { data: sites } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
    staleTime: 60_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['user-online-connections'] })
  }

  const quickResetMutation = useMutation({
    mutationFn: (userId: number) => resetSecret(userId),
    onSuccess: () => {
      toast.success('已重置 UUID 与订阅链接，节点同步后将断开旧连接')
      invalidate()
    },
    onError: handleServerError,
  })

  const quickBanMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: (_, vars) => {
      if (vars.banned !== undefined) {
        toast.success(vars.banned ? '已封禁该风险账号' : '已解除账号封禁')
        setSelectedRowSnapshot((prev) =>
          prev && prev.user_id === vars.id
            ? { ...prev, banned: vars.banned ? 1 : 0 }
            : prev
        )
      }
      setBanTarget(null)
      invalidate()
    },
    onError: handleServerError,
  })

  const summary = data?.summary
  const nodes = data?.nodes ?? []
  const activeNodes = nodes.filter(
    (n) =>
      n.effective_connections > 0 || n.online_users > 0 || n.online_ips > 0
  )
  const topNode = activeNodes[0] ?? null
  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const {
    activeRow: activeDetailRow,
    nextSnapshot,
    isRealtimePresent: isDetailRealtimePresent,
  } = reconcileDetailSnapshot(selectedRowSnapshot, rows, data !== undefined)

  // 用户仍在当前实时分页时同步刷新快照；用户离线或移出当前页时保留最后快照，避免中断历史取证
  if (nextSnapshot !== selectedRowSnapshot) {
    setSelectedRowSnapshot(nextSnapshot)
  }

  const applySearch = () => {
    setPage(1)
    setAppliedKeyword(keywordInput.trim())
    const parsedMin = Number(minConnInput.trim())
    setAppliedMinConn(
      minConnInput.trim() !== '' && Number.isFinite(parsedMin) && parsedMin > 0
        ? Math.floor(parsedMin)
        : undefined
    )
  }

  const filterByExactIp = (ip: string) => {
    const next = buildExactIpFilterState(ip)
    setPage(next.page)
    setKeywordInput(next.keywordInput)
    setAppliedKeyword(next.appliedKeyword)
    setExactIp(next.exactIp)
    if (urlKeyword !== undefined || urlUserId !== undefined) {
      // 不提前改写 syncedSearch：等异步 navigate 真正清除 URL 参数后再自然同步，
      // 防止 URL 尚未更新时的中间渲染帧把旧 urlKeyword 重新写回输入框和请求参数。
      navigate({
        search: (prev) => ({
          ...prev,
          keyword: undefined,
          user_id: undefined,
        }),
        replace: true,
      })
    }
    toast.success(`已精确反查客户端 IP：${ip}（已清空用户关键词以显示全部共用账号）`)
  }

  const resetFilters = () => {
    setPage(1)
    setKeywordInput('')
    setAppliedKeyword('')
    setExactIp('')
    setServerId(ALL)
    setSiteId(ALL)
    setRiskLevel(ALL)
    setRiskRule(ALL)
    setMinConnInput('')
    setAppliedMinConn(undefined)
    setOnlyOverLimit(false)
  }

  const hasActiveFilters =
    appliedKeyword !== '' ||
    exactIp !== '' ||
    serverId !== ALL ||
    siteId !== ALL ||
    riskLevel !== ALL ||
    riskRule !== ALL ||
    appliedMinConn !== undefined ||
    onlyOverLimit

  const toggleSort = (col: OnlineConnectionOrderBy) => {
    setPage(1)
    if (orderBy !== col) {
      setOrderBy(col)
      setOrderDir('desc')
    } else {
      setOrderDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    }
  }

  const renderSortIcon = (col: OnlineConnectionOrderBy) => {
    if (orderBy !== col) {
      return <ArrowUpDown className='ms-1 size-3.5 opacity-40' />
    }
    return orderDir === 'desc' ? (
      <ArrowDown className='ms-1 size-3.5 text-primary' />
    ) : (
      <ArrowUp className='ms-1 size-3.5 text-primary' />
    )
  }

  const openDetail = (row: OnlineConnectionRow) => {
    setSelectedRowSnapshot(row)
    setSheetOpen(true)
  }

  const errorMessage =
    error instanceof Error && error.message
      ? error.message
      : '无法获取实时在线连接数据，请检查后端接口或网络连接'

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
        {/* 标题与实时刷新控制栏 */}
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h2 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <Activity className='size-6 text-primary' />
              连接与风控
            </h2>
            <p className='text-sm text-muted-foreground'>
              一站式实时并发监控、历史 IP 归属地追踪与订阅访问风控工作台，支持单用户四维取证后再处置。
            </p>
          </div>

          {activeTab === 'realtime' && (
            <div className='flex flex-wrap items-center gap-2'>
              {dataUpdatedAt > 0 && (
                <span className='text-xs text-muted-foreground'>
                  更新于{' '}
                  {new Date(dataUpdatedAt).toLocaleTimeString('zh-CN', {
                    hour12: false,
                  })}
                </span>
              )}
              <Select
                value={String(refreshMs)}
                onValueChange={(v) => setRefreshMs(Number(v))}
              >
                <SelectTrigger className='h-9 w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant='outline'
                size='sm'
                className='h-9'
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={cn('size-4', isFetching && 'animate-spin')}
                />
                刷新
              </Button>
            </div>
          )}
        </div>

        {/* 一站式工作台一级页签 */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as WorkspaceTab)}
          className='flex min-h-0 flex-1 flex-col gap-4'
        >
          <TabsList className='w-fit'>
            <TabsTrigger value='realtime' className='gap-1.5'>
              <Activity className='size-4' />
              实时连接与风控
              {(summary?.risk_users ?? 0) > 0 && (
                <Badge
                  variant='destructive'
                  className='ms-1 h-4 px-1.5 font-mono text-[10px]'
                >
                  {summary?.risk_users}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value='usage' className='gap-1.5'>
              <ScrollText className='size-4' />
              历史使用记录
            </TabsTrigger>
            <TabsTrigger value='subscription' className='gap-1.5'>
              <History className='size-4' />
              订阅访问风控
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value='realtime'
            className='mt-0 flex min-h-0 flex-1 flex-col gap-4'
          >

        {/* 接口请求错误告警（防止请求失败被误认为「暂无在线连接」） */}
        {isError && (
          <Alert variant='destructive'>
            <AlertCircle className='size-4' />
            <AlertTitle>实时连接数据加载失败</AlertTitle>
            <AlertDescription className='flex flex-wrap items-center justify-between gap-2'>
              <span>{errorMessage}</span>
              <Button
                variant='outline'
                size='sm'
                className='h-7 border-destructive/40 bg-background text-destructive hover:bg-destructive/10'
                onClick={() => refetch()}
              >
                <RefreshCw className='size-3.5' />
                立即重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 顶部 5 张实时指标与风控情报卡片 */}
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
          <Card className='gap-1.5 py-3.5'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 px-4 pb-0'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>
                实时在线用户
              </CardTitle>
              <Users className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent className='px-4'>
              <div className='text-2xl font-bold tabular-nums'>
                {summary?.online_users ?? '-'}
              </div>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                活跃节点 {summary?.active_nodes ?? 0} 个 · 达限{' '}
                {summary?.over_limit_users ?? 0} 人
              </p>
            </CardContent>
          </Card>

          <Card className='gap-1.5 border-primary/25 py-3.5'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 px-4 pb-0'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>
                用户 TCP/UDP 并发连接
              </CardTitle>
              <Zap className='size-4 text-primary' />
            </CardHeader>
            <CardContent className='px-4'>
              <div className='text-2xl font-bold text-primary tabular-nums'>
                {summary != null
                  ? summary.has_connection_report
                    ? summary.total_user_connections.toLocaleString()
                    : '未上报'
                  : '-'}
              </div>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                节点总活跃连接：
                {summary != null
                  ? summary.total_node_connections.toLocaleString()
                  : '-'}
              </p>
            </CardContent>
          </Card>

          <Card className='gap-1.5 py-3.5'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 px-4 pb-0'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>
                实时在线设备 (去重 IP)
              </CardTitle>
              <Globe className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent className='px-4'>
              <div className='text-2xl font-bold tabular-nums'>
                {summary != null
                  ? summary.total_online_ips.toLocaleString()
                  : '-'}
              </div>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                异地共线 {summary?.multi_region_users ?? 0} 人 · 串号 IP{' '}
                {summary?.shared_ip_groups ?? 0} 组
              </p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer gap-1.5 py-3.5 transition-colors hover:bg-muted/40',
              riskLevel === 'any_risk' && 'ring-2 ring-destructive/50',
              (summary?.risk_users ?? 0) > 0 && 'border-destructive/40'
            )}
            onClick={() => {
              setPage(1)
              if (riskLevel === 'any_risk') {
                setRiskLevel(ALL)
              } else {
                setRiskLevel('any_risk')
                setOrderBy('risk')
                setOrderDir('desc')
              }
            }}
            title='点击切换「仅看风控异常账号」并按风险分排序'
          >
            <CardHeader className='flex flex-row items-center justify-between space-y-0 px-4 pb-0'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>
                风控告警账号
              </CardTitle>
              {(summary?.risk_users ?? 0) > 0 ? (
                <ShieldAlert className='size-4 text-destructive' />
              ) : (
                <ShieldCheck className='size-4 text-emerald-500' />
              )}
            </CardHeader>
            <CardContent className='px-4'>
              <div
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  (summary?.critical_risk_users ?? 0) > 0
                    ? 'text-destructive'
                    : (summary?.warning_risk_users ?? 0) > 0
                      ? 'text-amber-600 dark:text-amber-500'
                      : ''
                )}
              >
                {summary?.risk_users ?? '-'}
              </div>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                高危 {summary?.critical_risk_users ?? 0} · 预警{' '}
                {summary?.warning_risk_users ?? 0}
                {riskLevel === 'any_risk' ? ' (已筛选)' : ''}
              </p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'gap-1.5 py-3.5 transition-colors',
              topNode && 'cursor-pointer hover:bg-muted/40',
              topNode &&
                serverId === String(topNode.id) &&
                'ring-2 ring-primary/50'
            )}
            onClick={() => {
              if (!topNode) return
              setPage(1)
              setServerId((prev) =>
                prev === String(topNode.id) ? ALL : String(topNode.id)
              )
            }}
            title={topNode ? '点击按该节点过滤' : undefined}
          >
            <CardHeader className='flex flex-row items-center justify-between space-y-0 px-4 pb-0'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>
                最高连接负载节点
              </CardTitle>
              <Server className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent className='px-4'>
              <div className='truncate text-base font-bold'>
                {topNode ? topNode.name : '暂无活跃节点'}
              </div>
              <p className='mt-1 text-xs text-muted-foreground tabular-nums'>
                {topNode
                  ? `${topNode.effective_connections.toLocaleString()} 连接 · ${topNode.online_users} 人${!topNode.connections_reported ? ' (仅节点总数)' : ''}`
                  : '-'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 旧节点未上报真实并发连接数的清晰提示 */}
        {summary && summary.unreported_users > 0 && (
          <Alert>
            <Info className='size-4' />
            <AlertTitle>
              {summary.has_connection_report
                ? `部分旧版节点暂未上报逐用户并发连接数（涉及 ${summary.unreported_users} 位用户）`
                : '当前节点暂未上报逐用户 TCP/UDP 并发连接数'}
            </AlertTitle>
            <AlertDescription>
              只上报在线设备数的旧节点会明确显示「并发数未上报」，且高并发风控规则已自动跳过避免漏误判。请将
              Xboard-Node 升级至支持{' '}
              <code className='rounded bg-muted px-1 py-0.5 text-xs'>
                user_conns
              </code>{' '}
              上报的版本以获取精确的单用户 TCP/UDP 并发连接数。
            </AlertDescription>
          </Alert>
        )}

        {/* 活跃节点快捷筛选胶囊条 */}
        {activeNodes.length > 0 && (
          <div className='flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/20 px-3 py-2'>
            <span className='me-1 flex items-center gap-1 text-xs font-medium text-muted-foreground'>
              <Network className='size-3.5' />
              节点负载分布：
            </span>
            {activeNodes.slice(0, 12).map((n) => {
              const selected = serverId === String(n.id)
              return (
                <button
                  key={n.id}
                  type='button'
                  onClick={() => {
                    setPage(1)
                    setServerId(selected ? ALL : String(n.id))
                  }}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background hover:border-primary/50 hover:bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      selected
                        ? 'bg-primary-foreground'
                        : n.is_online
                          ? 'bg-emerald-500'
                          : 'bg-muted-foreground'
                    )}
                  />
                  <span className='max-w-36 truncate font-medium'>{n.name}</span>
                  <span
                    className={cn(
                      'font-mono tabular-nums',
                      selected
                        ? 'text-primary-foreground/90'
                        : 'text-muted-foreground'
                    )}
                  >
                    {n.effective_connections.toLocaleString()} 连接 /{' '}
                    {n.online_users} 人
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* 多维过滤工具栏 */}
        <div className='space-y-2 rounded-md border bg-card p-3'>
          <div className='flex flex-wrap items-end gap-2.5'>
            <div className='grid gap-1'>
              <span className='text-xs text-muted-foreground'>
                用户 / 客户端 IP
              </span>
              <Input
                className='h-9 w-52'
                placeholder='邮箱、UID 或客户端 IP'
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch()
                }}
              />
            </div>

            <div className='grid gap-1'>
              <span className='text-xs text-muted-foreground'>风控等级</span>
              <Select
                value={riskLevel}
                onValueChange={(v) => {
                  setPage(1)
                  setRiskLevel(v)
                  if (v !== ALL && v !== 'normal') {
                    setOrderBy('risk')
                    setOrderDir('desc')
                  }
                }}
              >
                <SelectTrigger className='h-9 w-36'>
                  <SelectValue placeholder='全部等级' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部等级</SelectItem>
                  <SelectItem value='any_risk'>全部异常 (高危+预警)</SelectItem>
                  <SelectItem value='critical'>高危 (≥70分)</SelectItem>
                  <SelectItem value='warning'>预警 (35-69分)</SelectItem>
                  <SelectItem value='low'>关注 (1-34分)</SelectItem>
                  <SelectItem value='normal'>正常 (0分)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='grid gap-1'>
              <span className='text-xs text-muted-foreground'>命中风控规则</span>
              <Select
                value={riskRule}
                onValueChange={(v) => {
                  setPage(1)
                  setRiskRule(v)
                }}
              >
                <SelectTrigger className='h-9 w-44'>
                  <SelectValue placeholder='全部规则' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部风控规则</SelectItem>
                  {(Object.keys(RISK_RULE_LABELS) as RiskRuleCode[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {RISK_RULE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='grid gap-1'>
              <span className='text-xs text-muted-foreground'>所连节点</span>
              <Select
                value={serverId}
                onValueChange={(v) => {
                  setPage(1)
                  setServerId(v)
                }}
              >
                <SelectTrigger className='h-9 w-44'>
                  <SelectValue placeholder='全部节点' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>全部节点</SelectItem>
                  {nodes.map((n) => (
                    <SelectItem key={n.id} value={String(n.id)}>
                      {n.name} ({n.effective_connections} 连接 / {n.online_users}{' '}
                      人)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sites && sites.length > 0 && (
              <div className='grid gap-1'>
                <span className='text-xs text-muted-foreground'>归属站点</span>
                <Select
                  value={siteId}
                  onValueChange={(v) => {
                    setPage(1)
                    setSiteId(v)
                  }}
                >
                  <SelectTrigger className='h-9 w-32'>
                    <SelectValue placeholder='全部站点' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>全部站点</SelectItem>
                    <SelectItem value='main'>主站</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className='grid gap-1'>
              <span className='text-xs text-muted-foreground'>并发连接 ≥</span>
              <Input
                type='number'
                min={0}
                className='h-9 w-24 font-mono'
                placeholder='如 200'
                value={minConnInput}
                onChange={(e) => setMinConnInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch()
                }}
              />
            </div>

            <Button className='h-9' onClick={applySearch}>
              <Search className='size-4' />
              查询
            </Button>

            {hasActiveFilters && (
              <Button variant='ghost' className='h-9' onClick={resetFilters}>
                <X className='size-4' />
                重置
              </Button>
            )}
          </div>

          {exactIp && (
            <div className='flex items-center gap-2 pt-1 text-xs'>
              <span className='text-muted-foreground'>当前精确反查：</span>
              <Badge
                variant='secondary'
                className='gap-1.5 font-mono text-xs'
              >
                IP = {exactIp}
                <button
                  type='button'
                  aria-label='清除精确 IP 筛选'
                  className='cursor-pointer rounded-full hover:bg-muted-foreground/20'
                  onClick={() => {
                    setPage(1)
                    setExactIp('')
                  }}
                >
                  <X className='size-3' />
                </button>
              </Badge>
            </div>
          )}
        </div>

        {/* 主表格：单用户并发连接数 + 风控评估 + 在线设备 IP + 所连节点合并视图 */}
        <div className='overflow-hidden rounded-md border bg-card'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='px-4'>用户</TableHead>
                <TableHead className='px-4 whitespace-nowrap'>
                  <button
                    type='button'
                    onClick={() => toggleSort('risk')}
                    className='inline-flex cursor-pointer items-center font-medium hover:text-foreground'
                  >
                    风控评估
                    {renderSortIcon('risk')}
                  </button>
                </TableHead>
                <TableHead className='px-4 whitespace-nowrap'>
                  <button
                    type='button'
                    onClick={() => toggleSort('connections')}
                    className='inline-flex cursor-pointer items-center font-medium hover:text-foreground'
                  >
                    TCP/UDP 并发连接
                    {renderSortIcon('connections')}
                  </button>
                </TableHead>
                <TableHead className='px-4 whitespace-nowrap'>
                  <button
                    type='button'
                    onClick={() => toggleSort('devices')}
                    className='inline-flex cursor-pointer items-center font-medium hover:text-foreground'
                  >
                    在线设备 (IP)
                    {renderSortIcon('devices')}
                  </button>
                </TableHead>
                <TableHead className='px-4 whitespace-nowrap'>
                  <button
                    type='button'
                    onClick={() => toggleSort('nodes')}
                    className='inline-flex cursor-pointer items-center font-medium hover:text-foreground'
                  >
                    所连节点分布
                    {renderSortIcon('nodes')}
                  </button>
                </TableHead>
                <TableHead className='px-4 whitespace-nowrap'>
                  实时客户端 IP / 归属地
                </TableHead>
                <TableHead className='px-4 whitespace-nowrap'>
                  <button
                    type='button'
                    onClick={() => toggleSort('last_seen_at')}
                    className='inline-flex cursor-pointer items-center font-medium hover:text-foreground'
                  >
                    最近活跃
                    {renderSortIcon('last_seen_at')}
                  </button>
                </TableHead>
                <TableHead className='px-4 text-end whitespace-nowrap'>
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className='h-28 text-center'>
                    加载实时连接与风控数据中...
                  </TableCell>
                </TableRow>
              ) : isError && !data ? (
                <TableRow>
                  <TableCell colSpan={8} className='h-32 text-center'>
                    <div className='flex flex-col items-center gap-2 text-destructive'>
                      <span className='text-sm font-medium'>
                        实时连接数据加载失败：{errorMessage}
                      </span>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => refetch()}
                      >
                        <RefreshCw className='size-3.5' />
                        重新加载
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((row) => {
                  const totalSysConn = Math.max(
                    1,
                    summary?.total_user_connections ?? 0
                  )
                  const displayReported =
                    serverId !== ALL
                      ? row.filtered_connections_reported
                      : row.connections_reported
                  const displayConn =
                    serverId !== ALL
                      ? row.filtered_connections
                      : row.total_connections
                  const connSharePct =
                    displayReported &&
                    row.total_connections != null &&
                    (summary?.total_user_connections ?? 0) > 0
                      ? Math.min(
                          100,
                          (row.total_connections / totalSysConn) * 100
                        )
                      : 0

                  return (
                    <TableRow
                      key={row.user_id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        row.risk_level === 'critical' && 'bg-destructive/[0.03]'
                      )}
                      onClick={() => openDetail(row)}
                    >
                      {/* 用户信息 */}
                      <TableCell className='px-4'>
                        <div className='flex flex-col gap-0.5'>
                          <div className='flex items-center gap-1.5'>
                            <UserEmailLink
                              email={row.user_email}
                              className='font-medium'
                            />
                            <button
                              type='button'
                              aria-label='复制邮箱'
                              className='rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground'
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard
                                  ?.writeText(row.user_email)
                                  .then(() => toast.success('已复制邮箱'))
                              }}
                            >
                              <Copy className='size-3.5' />
                            </button>
                            {row.banned ? (
                              <Badge
                                variant='destructive'
                                className='text-[10px]'
                              >
                                封禁
                              </Badge>
                            ) : null}
                            {row.speed_limit ? (
                              <Badge
                                variant='outline'
                                className='text-[10px] tabular-nums'
                              >
                                {row.speed_limit}M
                              </Badge>
                            ) : null}
                          </div>
                          <div className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
                            <span className='font-mono'>#{row.user_id}</span>
                            <span>·</span>
                            <span>{row.plan_name || '无套餐'}</span>
                            {row.site_name ? (
                              <>
                                <span>·</span>
                                <Badge
                                  variant='secondary'
                                  className='h-4 px-1.5 text-[10px]'
                                >
                                  {row.site_name}
                                </Badge>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      {/* 风控评估 */}
                      <TableCell className='px-4'>
                        {row.risk_reasons.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className='flex flex-col items-start gap-1'>
                                <Badge
                                  variant='outline'
                                  className={cn(
                                    'font-mono text-xs font-semibold tabular-nums',
                                    riskBadgeClass(row.risk_level)
                                  )}
                                >
                                  {riskLabel(row.risk_level)} · {row.risk_score}
                                </Badge>
                                <div className='flex flex-wrap gap-1'>
                                  {row.risk_reasons.slice(0, 2).map((r) => (
                                    <span
                                      key={r.code}
                                      className={cn(
                                        'inline-block rounded px-1.5 py-0.5 text-[11px] leading-tight',
                                        r.level === 'critical'
                                          ? 'bg-destructive/15 text-destructive'
                                          : r.level === 'warning'
                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                            : 'bg-muted text-muted-foreground'
                                      )}
                                    >
                                      {r.label}
                                    </span>
                                  ))}
                                  {row.risk_reasons.length > 2 && (
                                    <span className='text-[11px] text-muted-foreground'>
                                      +{row.risk_reasons.length - 2}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className='max-w-xs space-y-1'>
                              {row.risk_reasons.map((r) => (
                                <p key={r.code} className='text-xs'>
                                  <strong>{r.label}：</strong>
                                  {r.detail}
                                </p>
                              ))}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge
                            variant='outline'
                            className={cn(
                              'text-xs',
                              riskBadgeClass('normal')
                            )}
                          >
                            正常
                          </Badge>
                        )}
                      </TableCell>

                      {/* TCP/UDP 并发连接数（旧节点显式展示「并发数未上报」） */}
                      <TableCell className='px-4'>
                        {displayReported && displayConn != null ? (
                          <div className='w-36 space-y-1'>
                            <div className='flex items-baseline justify-between gap-2'>
                              <Badge
                                variant='outline'
                                className={cn(
                                  'font-mono text-sm font-semibold tabular-nums',
                                  displayConn >= 500
                                    ? 'border-destructive/50 bg-destructive/10 text-destructive'
                                    : displayConn >= 250
                                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-500'
                                      : displayConn > 0
                                        ? 'border-primary/40 bg-primary/5 text-primary'
                                        : 'text-muted-foreground'
                                )}
                              >
                                {displayConn.toLocaleString()}
                              </Badge>
                              {serverId !== ALL &&
                              row.total_connections != null &&
                              row.total_connections !== displayConn ? (
                                <span className='text-xs text-muted-foreground tabular-nums'>
                                  全站 {row.total_connections.toLocaleString()}
                                </span>
                              ) : row.partial_connections_reported ? (
                                <span className='text-[11px] text-muted-foreground'>
                                  部分上报
                                </span>
                              ) : (summary?.total_user_connections ?? 0) > 0 &&
                                displayConn > 0 ? (
                                <span className='text-xs text-muted-foreground tabular-nums'>
                                  {connSharePct.toFixed(1)}%
                                </span>
                              ) : null}
                            </div>
                            {(summary?.total_user_connections ?? 0) > 0 &&
                              displayConn > 0 && (
                                <div className='h-1.5 w-full overflow-hidden rounded-full bg-secondary'>
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      displayConn >= 500
                                        ? 'bg-destructive'
                                        : displayConn >= 250
                                          ? 'bg-amber-500'
                                          : 'bg-primary'
                                    )}
                                    style={{
                                      width: `${Math.max(3, connSharePct)}%`,
                                    }}
                                  />
                                </div>
                              )}
                          </div>
                        ) : (
                          <Badge
                            variant='outline'
                            className='text-xs font-normal text-muted-foreground'
                            title='该用户当前所连节点为旧版本，仅上报了在线设备 IP 数，未上报逐用户 TCP/UDP 并发数'
                          >
                            并发数未上报
                          </Badge>
                        )}
                      </TableCell>

                      {/* 在线设备 IP 数 */}
                      <TableCell className='px-4 whitespace-nowrap'>
                        <div className='flex flex-col items-start gap-0.5'>
                          <Badge
                            variant='outline'
                            className={cn(
                              'min-w-16 justify-center font-mono tabular-nums',
                              row.is_over_limit
                                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                                : 'border-primary/30 bg-primary/5 text-foreground'
                            )}
                          >
                            {row.online_devices} /{' '}
                            {row.device_limit == null ? '∞' : row.device_limit}
                          </Badge>
                          {row.online_region_count >= 2 && (
                            <span className='text-[11px] font-medium text-amber-600 dark:text-amber-500'>
                              {row.online_region_count} 城同时在线
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* 所连节点及各自连接数 */}
                      <TableCell className='px-4'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          {row.nodes.slice(0, 2).map((nd) => (
                            <Badge
                              key={nd.server_id}
                              variant='secondary'
                              className='gap-1 font-normal'
                              onClick={(e) => {
                                e.stopPropagation()
                                setPage(1)
                                setServerId(String(nd.server_id))
                              }}
                              title='点击按此节点筛选'
                            >
                              <span className='max-w-28 truncate'>
                                {nd.server_name}
                              </span>
                              <span className='font-mono text-xs text-primary tabular-nums'>
                                (
                                {nd.connections_reported &&
                                nd.connections != null
                                  ? nd.connections
                                  : '未上报'}
                                )
                              </span>
                            </Badge>
                          ))}
                          {row.nodes.length > 2 && (
                            <Badge variant='outline' className='text-xs'>
                              +{row.nodes.length - 2} 节点
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* 实时客户端 IP 预览 */}
                      <TableCell className='px-4'>
                        {row.ips.length > 0 ? (
                          <div className='flex flex-col gap-1'>
                            {row.ips.slice(0, 2).map((ipItem) => (
                              <div
                                key={ipItem.ip}
                                className='flex items-center gap-1.5 text-xs'
                              >
                                <button
                                  type='button'
                                  className='cursor-pointer font-mono hover:text-primary hover:underline'
                                  title='点击精确反查此 IP 关联的所有在线账号'
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    filterByExactIp(ipItem.ip)
                                  }}
                                >
                                  {ipItem.ip}
                                </button>
                                {ipItem.shared_users > 1 && (
                                  <Badge
                                    variant='destructive'
                                    className='h-4 px-1 text-[10px]'
                                  >
                                    {ipItem.shared_users}号共用
                                  </Badge>
                                )}
                                {ipItem.location ? (
                                  <span className='max-w-36 truncate text-muted-foreground'>
                                    {ipItem.location}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                            {row.ips.length > 2 && (
                              <span className='text-xs text-muted-foreground'>
                                等共 {row.ips.length} 个活跃 IP
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className='text-xs text-muted-foreground'>
                            -
                          </span>
                        )}
                      </TableCell>

                      {/* 最近活跃 */}
                      <TableCell
                        className='px-4 text-xs whitespace-nowrap text-muted-foreground'
                        title={formatExactTime(row.last_seen_at)}
                      >
                        {formatRelativeTime(row.last_seen_at)}
                      </TableCell>

                      {/* 操作 */}
                      <TableCell
                        className='px-4 text-end'
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className='inline-flex items-center gap-1'>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 px-2'
                            onClick={() => openDetail(row)}
                          >
                            <Eye className='size-4' />
                            明细
                          </Button>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='size-8'
                                aria-label='风控处置'
                              >
                                <MoreHorizontal className='size-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem onClick={() => openDetail(row)}>
                                <Eye className='size-4' />
                                查看风控与节点明细
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  quickResetMutation.mutate(row.user_id)
                                }
                              >
                                <RotateCw className='size-4' />
                                重置订阅踢下线
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSpeedTarget(row)}
                              >
                                <Gauge className='size-4' />
                                调整账号限速...
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {row.banned ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    quickBanMutation.mutate({
                                      id: row.user_id,
                                      banned: false,
                                    })
                                  }
                                >
                                  <CheckCircle2 className='size-4' />
                                  解除封禁
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className='text-destructive focus:text-destructive'
                                  onClick={() => setBanTarget(row)}
                                >
                                  <Ban className='size-4' />
                                  封禁风险账号
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className='h-28 text-center text-muted-foreground'
                  >
                    {hasActiveFilters
                      ? '没有符合筛选条件的实时在线连接记录'
                      : '当前暂无在线连接或活跃设备'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <SimplePagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPage(1)
            setPageSize(size)
          }}
        />
          </TabsContent>

          <TabsContent
            value='usage'
            className='mt-0 flex min-h-[60vh] flex-1 flex-col'
          >
            <UsageRecordsPanel
              active={activeTab === 'usage'}
              prefillUser={prefillUser}
              includeForeignLocations={includeForeignLocations}
              onForeignLocationsChange={changeForeignLocations}
            />
          </TabsContent>

          <TabsContent
            value='subscription'
            className='mt-0 flex min-h-[60vh] flex-1 flex-col'
          >
            <SubscriptionRecordsPanel
              active={activeTab === 'subscription'}
              prefillUser={prefillUser}
            />
          </TabsContent>
        </Tabs>
      </Main>

      <ConnectionDetailSheet
        row={activeDetailRow}
        isRealtimePresent={isDetailRealtimePresent}
        open={sheetOpen && activeDetailRow != null}
        onOpenChange={setSheetOpen}
        onRowPatch={(userId, patch) => {
          setSelectedRowSnapshot((prev) =>
            prev && prev.user_id === userId ? { ...prev, ...patch } : prev
          )
        }}
        includeForeignLocations={includeForeignLocations}
        onForeignLocationsChange={changeForeignLocations}
        onFilterByNode={(sid) => {
          setPage(1)
          setServerId(String(sid))
        }}
        onFilterByIp={(ip) => filterByExactIp(ip)}
      />

      <SpeedLimitDialog
        row={speedTarget}
        open={speedTarget != null}
        onOpenChange={(v) => !v && setSpeedTarget(null)}
        onSaved={(userId, speedLimit) => {
          setSelectedRowSnapshot((prev) =>
            prev && prev.user_id === userId
              ? { ...prev, speed_limit: speedLimit }
              : prev
          )
        }}
      />

      <ConfirmDialog
        open={banTarget != null}
        onOpenChange={(v) => !v && setBanTarget(null)}
        destructive
        isLoading={quickBanMutation.isPending}
        title='确认封禁该风险账号？'
        desc={
          banTarget
            ? `封禁账号 ${banTarget.user_email}（#${banTarget.user_id}）后，其会话将立即注销且所有节点将同步阻断连接。`
            : ''
        }
        cancelBtnText='取消'
        confirmText='立即封禁'
        handleConfirm={() => {
          if (banTarget) {
            quickBanMutation.mutate({ id: banTarget.user_id, banned: true })
          }
        }}
      />
    </>
  )
}
