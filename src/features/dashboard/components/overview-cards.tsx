import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Bell,
  Download,
  MessagesSquare,
  Upload,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchStats } from '../api'
import { formatBytes, formatCents } from '../format'

type Trend = { value: number; label: string; isPositive: boolean }

function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  onClick,
  highlight,
  className,
}: {
  title: string
  value: React.ReactNode
  icon: React.ReactNode
  trend?: Trend
  description?: React.ReactNode
  onClick?: () => void
  highlight?: boolean
  className?: string
}) {
  return (
    <Card
      className={cn(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        highlight && 'border-primary/50',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {trend ? (
          <div className='flex items-center pt-1'>
            {trend.isPositive ? (
              <ArrowUpRight className='h-4 w-4 text-emerald-500' />
            ) : (
              <ArrowDownRight className='h-4 w-4 text-red-500' />
            )}
            <span
              className={cn(
                'ml-1 text-xs',
                trend.isPositive ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {trend.isPositive ? '+' : '-'}
              {Math.abs(trend.value)}%
            </span>
            <span className='ml-1 text-xs text-muted-foreground'>
              {trend.label}
            </span>
          </div>
        ) : (
          <p className='text-xs text-muted-foreground'>{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

function StatsSkeletonCard() {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <div className='h-4 w-[120px] animate-pulse rounded-md bg-primary/10' />
        <div className='h-4 w-4 animate-pulse rounded-md bg-primary/10' />
      </CardHeader>
      <CardContent>
        <div className='mb-2 h-8 w-[140px] animate-pulse rounded-md bg-primary/10' />
        <div className='flex items-center gap-2'>
          <div className='h-4 w-4 animate-pulse rounded-md bg-primary/10' />
          <div className='h-4 w-[100px] animate-pulse rounded-md bg-primary/10' />
        </div>
      </CardContent>
    </Card>
  )
}

export function OverviewCards({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['stat-stats'],
    queryFn: fetchStats,
    refetchInterval: 300000,
  })

  if (isLoading || !data) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 8 }).map((_, i) => (
          <StatsSkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      <StatCard
        title='今日收入'
        value={formatCents(data.todayIncome)}
        icon={<ArrowDownToLine className='h-4 w-4 text-emerald-500' />}
        trend={{
          value: round1(data.dayIncomeGrowth),
          label: '对比昨日',
          isPositive: data.dayIncomeGrowth > 0,
        }}
      />
      <StatCard
        title='月收入'
        value={formatCents(data.currentMonthIncome)}
        icon={<BarChart3 className='h-4 w-4 text-blue-500' />}
        trend={{
          value: round1(data.monthIncomeGrowth),
          label: '对比上月',
          isPositive: data.monthIncomeGrowth > 0,
        }}
      />
      <StatCard
        title='待处理工单'
        value={data.ticketPendingTotal}
        icon={
          <MessagesSquare
            className={cn(
              'h-4 w-4',
              data.ticketPendingTotal > 0
                ? 'text-orange-500'
                : 'text-muted-foreground'
            )}
          />
        }
        description={
          data.ticketPendingTotal > 0 ? '有工单需要处理' : '无待处理工单'
        }
        onClick={() => navigate({ to: '/ticket', search: { status: '0' } })}
        highlight={data.ticketPendingTotal > 0}
      />
      <StatCard
        title='待处理佣金'
        value={data.commissionPendingTotal}
        icon={
          <Bell
            className={cn(
              'h-4 w-4',
              data.commissionPendingTotal > 0
                ? 'text-blue-500'
                : 'text-muted-foreground'
            )}
          />
        }
        description={
          data.commissionPendingTotal > 0 ? '有佣金需要确认' : '无待处理佣金'
        }
        onClick={() =>
          // 对齐原版：仅看待确认佣金的有效订单
          //（commission_status=待确认(0)，且 is_commission：有邀请人、未取消/未待支付、佣金>0）
          navigate({
            to: '/order',
            search: { commission_status: ['0'], is_commission: true },
          })
        }
        highlight={data.commissionPendingTotal > 0}
      />
      <StatCard
        title='月新增用户'
        value={data.currentMonthNewUsers}
        icon={<Users className='h-4 w-4 text-blue-500' />}
        trend={{
          value: round1(data.userGrowth),
          label: '对比上月',
          isPositive: data.userGrowth > 0,
        }}
      />
      <StatCard
        title='总用户'
        value={data.totalUsers}
        icon={<Users className='h-4 w-4 text-muted-foreground' />}
        description={`活跃用户: ${data.activeUsers}`}
      />
      <StatCard
        title='月上传'
        value={formatBytes(data.monthTraffic.upload)}
        icon={<Upload className='h-4 w-4 text-emerald-500' />}
        description={`今日: ${formatBytes(data.todayTraffic.upload)}`}
      />
      <StatCard
        title='月下载'
        value={formatBytes(data.monthTraffic.download)}
        icon={<Download className='h-4 w-4 text-blue-500' />}
        description={`今日: ${formatBytes(data.todayTraffic.download)}`}
      />
    </div>
  )
}

// 原版趋势百分比保留 1 位（Math.abs(value) 不带小数处理时偶发离谱大数，沿用我们裁剪）。
function round1(p: number | null | undefined) {
  const n = Number(p ?? 0)
  if (!Number.isFinite(n)) return 0
  if (Math.abs(n) >= 1000) return 999
  return Math.round(n * 10) / 10
}
