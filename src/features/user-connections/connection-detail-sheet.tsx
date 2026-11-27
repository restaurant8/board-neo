import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  Copy,
  Gauge,
  Globe,
  History,
  Network,
  RotateCw,
  ScrollText,
  Server,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { UserEmailLink } from '@/components/user-email-link'
import { resetSecret, updateUser } from '@/features/user/api'
import { SubscriptionRecordsPanel } from '@/features/user/components/subscription-records-dialog'
import { UsageRecordsPanel } from '@/features/user/components/usage-records-dialog'
import { type OnlineConnectionRow, type RiskLevel } from './api'
import { SpeedLimitDialog } from './speed-limit-dialog'
import { UserTrafficEvidence } from './user-traffic-evidence'

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

function copyText(text: string, label = '已复制') {
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success(`${label}: ${text}`))
    .catch(() => toast.error('复制失败'))
}

function riskBadgeStyle(level: RiskLevel) {
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

function riskLevelLabel(level: RiskLevel) {
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

type EvidenceTab = 'realtime' | 'usage' | 'subscription' | 'traffic'

export function ConnectionDetailSheet({
  row,
  isRealtimePresent = true,
  open,
  onOpenChange,
  onRowPatch,
  includeForeignLocations,
  onForeignLocationsChange,
  onFilterByNode,
  onFilterByIp,
}: {
  row: OnlineConnectionRow | null
  isRealtimePresent?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onRowPatch?: (userId: number, patch: Partial<OnlineConnectionRow>) => void
  includeForeignLocations: boolean
  onForeignLocationsChange: (enabled: boolean) => void
  onFilterByNode?: (serverId: number) => void
  onFilterByIp?: (ip: string) => void
}) {
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<'ban' | 'reset' | null>(
    null
  )
  const [speedDialogOpen, setSpeedDialogOpen] = useState(false)
  const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>('realtime')
  const [realtimeView, setRealtimeView] = useState<'nodes' | 'ips'>('nodes')
  const [syncedUserId, setSyncedUserId] = useState<number | null>(
    row?.user_id ?? null
  )
  if ((row?.user_id ?? null) !== syncedUserId) {
    setSyncedUserId(row?.user_id ?? null)
    setEvidenceTab('realtime')
    setRealtimeView('nodes')
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['user-online-connections'] })
  }

  const resetMutation = useMutation({
    mutationFn: (userId: number) => resetSecret(userId),
    onSuccess: () => {
      toast.success('已重置用户 UUID 与订阅链接，节点同步后将断开旧连接')
      setConfirmAction(null)
      invalidate()
    },
    onError: handleServerError,
  })

  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: (_, vars) => {
      if (vars.banned !== undefined) {
        toast.success(vars.banned ? '已封禁该风险账号' : '已解除账号封禁')
        onRowPatch?.(vars.id, { banned: vars.banned ? 1 : 0 })
      } else if (vars.device_limit !== undefined) {
        toast.success(
          vars.device_limit
            ? `已将该账号设备上限设为 ${vars.device_limit} 台`
            : '已解除设备数量限制'
        )
        onRowPatch?.(vars.id, { device_limit: vars.device_limit ?? null })
      }
      setConfirmAction(null)
      invalidate()
    },
    onError: handleServerError,
  })

  const nodeNameMap = new Map(
    (row?.nodes ?? []).map((n) => [n.server_id, n.server_name])
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-4xl'>
          <SheetHeader className='border-b px-6 py-4'>
            <SheetTitle className='flex flex-wrap items-center gap-2 text-base'>
              {row ? (
                <>
                  <UserEmailLink
                    email={row.user_email}
                    onNavigate={() => onOpenChange(false)}
                    className='font-semibold break-normal'
                  />
                  <Badge variant='outline' className='font-mono text-xs'>
                    UID #{row.user_id}
                  </Badge>
                  <Badge
                    variant='outline'
                    className={cn(
                      'font-mono text-xs',
                      riskBadgeStyle(row.risk_level)
                    )}
                  >
                    {riskLevelLabel(row.risk_level)} · {row.risk_score} 分
                  </Badge>
                  {row.site_name ? (
                    <Badge variant='secondary'>{row.site_name}</Badge>
                  ) : (
                    <Badge variant='outline' className='text-muted-foreground'>
                      主站
                    </Badge>
                  )}
                  {row.banned ? (
                    <Badge variant='destructive'>已封禁</Badge>
                  ) : null}
                  {!isRealtimePresent ? (
                    <Badge
                      variant='outline'
                      className='border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    >
                      已离线或移出当前页 · 快照保留中
                    </Badge>
                  ) : null}
                </>
              ) : (
                '实时连接与风控明细'
              )}
            </SheetTitle>
            <SheetDescription>
              {row
                ? `套餐：${row.plan_name || '无套餐'} · 权限组：${row.group_name || '-'} · 当前限速：${row.speed_limit ? `${row.speed_limit} Mbps` : '不限速'}`
                : '查看单用户各节点 TCP/UDP 并发连接数、客户端 IP 与实时风控诊断'}
            </SheetDescription>
          </SheetHeader>

          {row ? (
            <>
              {/* 核心实时指标栏 */}
              <div className='grid grid-cols-3 gap-3 border-b bg-muted/30 px-6 py-3'>
                <div className='rounded-md border bg-background p-2.5'>
                  <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <Zap className='size-3.5 text-primary' />
                    TCP/UDP 并发
                  </div>
                  {row.connections_reported && row.total_connections != null ? (
                    <>
                      <div
                        className={cn(
                          'mt-1 text-lg font-bold tabular-nums',
                          row.total_connections >= 500
                            ? 'text-destructive'
                            : row.total_connections >= 250
                              ? 'text-amber-600 dark:text-amber-500'
                              : 'text-foreground'
                        )}
                      >
                        {row.total_connections.toLocaleString()}
                      </div>
                      <div className='text-[11px] text-muted-foreground tabular-nums'>
                        {row.partial_connections_reported
                          ? '部分旧节点未上报'
                          : `均值 ${row.avg_connections_per_ip ?? 0}/IP`}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='mt-1 text-sm font-semibold text-muted-foreground'>
                        并发数未上报
                      </div>
                      <div className='text-[11px] text-muted-foreground'>
                        当前所连节点为旧版本
                      </div>
                    </>
                  )}
                </div>

                <div className='rounded-md border bg-background p-2.5'>
                  <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <Globe className='size-3.5 text-primary' />
                    在线设备 (IP)
                  </div>
                  <div className='mt-1 flex items-baseline gap-1'>
                    <span
                      className={cn(
                        'text-lg font-bold tabular-nums',
                        row.is_over_limit
                          ? 'text-destructive'
                          : 'text-foreground'
                      )}
                    >
                      {row.online_devices}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      / {row.device_limit == null ? '∞' : row.device_limit}
                    </span>
                  </div>
                  <div className='text-[11px] text-muted-foreground'>
                    涉及 {row.online_region_count || 0} 个城市
                  </div>
                </div>

                <div className='rounded-md border bg-background p-2.5'>
                  <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <Network className='size-3.5 text-primary' />
                    所连节点数
                  </div>
                  <div className='mt-1 text-lg font-bold tabular-nums'>
                    {row.node_count}
                  </div>
                  <div className='text-[11px] text-muted-foreground'>
                    活跃于 {formatRelativeTime(row.last_seen_at)}
                  </div>
                </div>
              </div>

              {/* 实时风控诊断与一键处置区 */}
              <div className='border-b bg-card px-6 py-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='flex items-center gap-1.5 text-xs font-semibold'>
                    {row.risk_reasons.length > 0 ? (
                      <ShieldAlert className='size-4 text-destructive' />
                    ) : (
                      <ShieldCheck className='size-4 text-emerald-500' />
                    )}
                    风控检测结论
                  </span>

                  <div className='flex flex-wrap items-center gap-1.5'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-7 px-2 text-xs'
                      onClick={() => setEvidenceTab('subscription')}
                    >
                      <History className='size-3' />
                      暂停/换订阅
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-7 px-2 text-xs'
                      disabled={resetMutation.isPending}
                      onClick={() => setConfirmAction('reset')}
                    >
                      <RotateCw className='size-3' />
                      重置UUID踢下线
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-7 px-2 text-xs'
                      onClick={() => setSpeedDialogOpen(true)}
                    >
                      <Gauge className='size-3' />
                      调整限速
                      {row.speed_limit ? ` (${row.speed_limit}M)` : ''}
                    </Button>
                    {row.device_limit == null && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-7 px-2 text-xs'
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: row.user_id,
                            device_limit: 2,
                          })
                        }
                      >
                        <Smartphone className='size-3' />
                        限 2 台设备
                      </Button>
                    )}
                    <Button
                      variant={row.banned ? 'outline' : 'destructive'}
                      size='sm'
                      className='h-7 px-2 text-xs'
                      disabled={updateMutation.isPending}
                      onClick={() => {
                        if (row.banned) {
                          updateMutation.mutate({
                            id: row.user_id,
                            banned: false,
                          })
                        } else {
                          setConfirmAction('ban')
                        }
                      }}
                    >
                      {row.banned ? (
                        <>
                          <CheckCircle2 className='size-3' />
                          解封账号
                        </>
                      ) : (
                        <>
                          <Ban className='size-3' />
                          封禁账号
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {row.risk_reasons.length > 0 ? (
                  <div className='mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
                    {row.risk_reasons.map((r) => (
                      <div
                        key={r.code}
                        className={cn(
                          'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                          r.level === 'critical'
                            ? 'border-destructive/30 bg-destructive/5 text-destructive'
                            : r.level === 'warning'
                              ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400'
                              : 'border-border bg-muted/40 text-muted-foreground'
                        )}
                      >
                        <AlertTriangle className='mt-0.5 size-3.5 shrink-0' />
                        <div>
                          <span className='font-semibold'>{r.label}：</span>
                          <span>{r.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='mt-1.5 text-xs text-muted-foreground'>
                    {row.connections_reported
                      ? '未命中高并发、异地同时在线、设备超限或同 IP 串号风险规则。'
                      : '未命中异地同时在线、设备超限或同 IP 串号规则（所连节点暂未上报真实并发连接数，高并发规则已自动跳过）。'}
                  </p>
                )}
              </div>

              {/* 四维全息取证工作区：实时连接 / 历史 IP 轨迹 / 订阅与策略 / 流量与去向 */}
              <Tabs
                value={evidenceTab}
                onValueChange={(v) => setEvidenceTab(v as EvidenceTab)}
                className='flex min-h-0 flex-1 flex-col px-6 pt-3 pb-5'
              >
                <TabsList className='grid w-full grid-cols-4'>
                  <TabsTrigger value='realtime' className='gap-1.5 text-xs'>
                    <Activity className='size-3.5' />
                    实时连接 ({row.nodes.length}/{row.ips.length})
                  </TabsTrigger>
                  <TabsTrigger value='usage' className='gap-1.5 text-xs'>
                    <ScrollText className='size-3.5' />
                    历史 IP 轨迹
                  </TabsTrigger>
                  <TabsTrigger value='subscription' className='gap-1.5 text-xs'>
                    <History className='size-3.5' />
                    订阅与策略
                  </TabsTrigger>
                  <TabsTrigger value='traffic' className='gap-1.5 text-xs'>
                    <BarChart3 className='size-3.5' />
                    流量与去向
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value='realtime'
                  className='mt-3 flex min-h-0 flex-1 flex-col gap-2.5'
                >
                  <div className='flex items-center gap-1.5'>
                    <Button
                      size='sm'
                      variant={realtimeView === 'nodes' ? 'secondary' : 'ghost'}
                      className='h-7 px-2.5 text-xs'
                      onClick={() => setRealtimeView('nodes')}
                    >
                      按所连节点 ({row.nodes.length})
                    </Button>
                    <Button
                      size='sm'
                      variant={realtimeView === 'ips' ? 'secondary' : 'ghost'}
                      className='h-7 px-2.5 text-xs'
                      onClick={() => setRealtimeView('ips')}
                    >
                      按活跃客户端 IP ({row.ips.length})
                    </Button>
                  </div>

                  {realtimeView === 'nodes' ? (
                  <ScrollArea className='min-h-0 flex-1 pe-3'>
                    <div className='space-y-3'>
                      {row.nodes.map((node) => {
                        const nodeConn = node.connections ?? 0
                        const totalConn = row.total_connections ?? 0
                        const pct =
                          node.connections_reported && totalConn > 0
                            ? Math.round((nodeConn / totalConn) * 100)
                            : 0
                        return (
                          <div
                            key={node.server_id}
                            className='rounded-lg border bg-card p-3.5 shadow-2xs'
                          >
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                              <div className='flex items-center gap-2'>
                                <span
                                  className={cn(
                                    'size-2 rounded-full',
                                    node.is_online
                                      ? 'bg-emerald-500'
                                      : 'bg-muted-foreground/40'
                                  )}
                                />
                                <button
                                  type='button'
                                  className='cursor-pointer text-start font-medium hover:text-primary hover:underline'
                                  title='按此节点筛选'
                                  onClick={() => {
                                    onFilterByNode?.(node.server_id)
                                    onOpenChange(false)
                                  }}
                                >
                                  {node.server_name}
                                </button>
                                {node.server_type && (
                                  <Badge
                                    variant='outline'
                                    className='text-[11px] uppercase'
                                  >
                                    {node.server_type}
                                  </Badge>
                                )}
                              </div>

                              <div className='flex items-center gap-2'>
                                {node.connections_reported &&
                                node.connections != null ? (
                                  <Badge
                                    variant={
                                      node.connections >= 250
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    className='font-mono tabular-nums'
                                  >
                                    {node.connections.toLocaleString()} 连接
                                    {node.partial_connections_reported ? '（部分上报）' : ''}
                                    {totalConn > 0 ? ` (${pct}%)` : ''}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant='outline'
                                    className='text-xs text-muted-foreground'
                                  >
                                    并发数未上报
                                  </Badge>
                                )}
                                <Badge
                                  variant='outline'
                                  className='tabular-nums'
                                >
                                  {node.ip_count} IP
                                </Badge>
                              </div>
                            </div>

                            {node.connections_reported &&
                              totalConn > 0 &&
                              nodeConn > 0 && (
                                <div className='mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary'>
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      nodeConn >= 300
                                        ? 'bg-destructive'
                                        : 'bg-primary'
                                    )}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                              )}

                            {node.ips.length > 0 ? (
                              <>
                                <Separator className='my-2.5' />
                                <div className='space-y-1.5'>
                                  {node.ips.map((ipItem) => (
                                    <div
                                      key={ipItem.ip}
                                      className='flex items-center justify-between gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-xs'
                                    >
                                      <div className='flex min-w-0 items-center gap-2'>
                                        <button
                                          type='button'
                                          className='cursor-pointer font-mono font-medium hover:text-primary hover:underline'
                                          title='精确反查此 IP 关联的所有在线账号'
                                          onClick={() => {
                                            onFilterByIp?.(ipItem.ip)
                                            onOpenChange(false)
                                          }}
                                        >
                                          {ipItem.ip}
                                        </button>
                                        {ipItem.shared_users > 1 && (
                                          <Badge
                                            variant='destructive'
                                            className='h-4 px-1 text-[10px]'
                                          >
                                            串号 {ipItem.shared_users}
                                          </Badge>
                                        )}
                                        {ipItem.location ? (
                                          <span className='truncate text-muted-foreground'>
                                            {ipItem.location}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className='flex shrink-0 items-center gap-1.5 text-muted-foreground'>
                                        <span
                                          title={formatExactTime(
                                            ipItem.last_seen_at
                                          )}
                                        >
                                          {formatRelativeTime(
                                            ipItem.last_seen_at
                                          )}
                                        </span>
                                        <Button
                                          variant='ghost'
                                          size='icon'
                                          className='size-6'
                                          onClick={() =>
                                            copyText(ipItem.ip, '已复制 IP')
                                          }
                                        >
                                          <Copy className='size-3' />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
                                <span>暂无实时客户端 IP 明细</span>
                                <span title={formatExactTime(node.updated_at)}>
                                  更新于 {formatRelativeTime(node.updated_at)}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                  ) : (
                  <ScrollArea className='min-h-0 flex-1 pe-3'>
                    {row.ips.length > 0 ? (
                      <div className='space-y-2.5'>
                        {row.ips.map((item) => (
                          <div
                            key={item.ip}
                            className='rounded-lg border bg-card p-3 shadow-2xs'
                          >
                            <div className='flex items-center justify-between gap-2'>
                              <div className='flex items-center gap-2'>
                                <button
                                  type='button'
                                  className='cursor-pointer font-mono text-sm font-semibold hover:text-primary hover:underline'
                                  title='精确反查此 IP 关联的所有在线账号'
                                  onClick={() => {
                                    onFilterByIp?.(item.ip)
                                    onOpenChange(false)
                                  }}
                                >
                                  {item.ip}
                                </button>
                                {item.shared_users > 1 && (
                                  <Badge
                                    variant='destructive'
                                    className='cursor-pointer text-[11px]'
                                    onClick={() => {
                                      onFilterByIp?.(item.ip)
                                      onOpenChange(false)
                                    }}
                                  >
                                    同 IP 关联 {item.shared_users} 个在线账号
                                  </Badge>
                                )}
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='size-6'
                                  onClick={() => copyText(item.ip, '已复制 IP')}
                                >
                                  <Copy className='size-3.5' />
                                </Button>
                              </div>
                              <span
                                className='text-xs text-muted-foreground'
                                title={formatExactTime(item.last_seen_at)}
                              >
                                {formatRelativeTime(item.last_seen_at)}
                              </span>
                            </div>

                            <div className='mt-1 text-xs text-muted-foreground'>
                              归属地：{item.location || '未知归属地'}
                            </div>

                            <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                              <Server className='size-3.5 text-muted-foreground' />
                              {item.node_ids.map((nid) => (
                                <Badge
                                  key={nid}
                                  variant='secondary'
                                  className='cursor-pointer text-xs hover:bg-secondary/80'
                                  onClick={() => {
                                    onFilterByNode?.(nid)
                                    onOpenChange(false)
                                  }}
                                >
                                  {nodeNameMap.get(nid) ?? `Node #${nid}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className='flex h-40 items-center justify-center text-sm text-muted-foreground'>
                        暂无实时活跃客户端 IP
                      </div>
                    )}
                  </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent
                  value='usage'
                  className='mt-3 flex min-h-0 flex-1 flex-col'
                >
                  <UsageRecordsPanel
                    active={open && evidenceTab === 'usage'}
                    lockedUser={{ id: row.user_id, email: row.user_email }}
                    defaultRange='7d'
                    includeForeignLocations={includeForeignLocations}
                    onForeignLocationsChange={onForeignLocationsChange}
                    onNavigateAway={() => onOpenChange(false)}
                  />
                </TabsContent>

                <TabsContent
                  value='subscription'
                  className='mt-3 flex min-h-0 flex-1 flex-col'
                >
                  <SubscriptionRecordsPanel
                    active={open && evidenceTab === 'subscription'}
                    lockedUser={{ id: row.user_id, email: row.user_email }}
                    onNavigateAway={() => onOpenChange(false)}
                  />
                </TabsContent>

                <TabsContent
                  value='traffic'
                  className='mt-3 flex min-h-0 flex-1 flex-col'
                >
                  <UserTrafficEvidence
                    userId={row.user_id}
                    userEmail={row.user_email}
                    active={open && evidenceTab === 'traffic'}
                    onNavigateAway={() => onOpenChange(false)}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <SpeedLimitDialog
        row={row}
        open={speedDialogOpen}
        onOpenChange={setSpeedDialogOpen}
        onSaved={(userId, speedLimit) =>
          onRowPatch?.(userId, { speed_limit: speedLimit })
        }
      />

      <ConfirmDialog
        open={confirmAction === 'ban' && row != null}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        destructive
        isLoading={updateMutation.isPending}
        title='确认封禁该风险账号？'
        desc={
          row
            ? `封禁账号 ${row.user_email}（#${row.user_id}）后，其登录会话将被立即注销，且所有节点将同步移除该用户权限。`
            : ''
        }
        cancelBtnText='取消'
        confirmText='立即封禁'
        handleConfirm={() => {
          if (row) {
            updateMutation.mutate({ id: row.user_id, banned: true })
          }
        }}
      />

      <ConfirmDialog
        open={confirmAction === 'reset' && row != null}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        isLoading={resetMutation.isPending}
        title='重置 UUID 及订阅链接？'
        desc={
          row
            ? `重置后 ${row.user_email} 的旧订阅地址与节点连接凭据将立即失效，可用于阻断疑似泄露或多人合租连接。`
            : ''
        }
        cancelBtnText='取消'
        confirmText='确认重置'
        handleConfirm={() => {
          if (row) {
            resetMutation.mutate(row.user_id)
          }
        }}
      />
    </>
  )
}
