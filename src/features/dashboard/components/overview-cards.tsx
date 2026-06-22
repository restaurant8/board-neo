import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  LifeBuoy,
  Server,
  Smartphone,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { fetchStats } from '../api'
import { formatBytes, formatCents, formatPercent } from '../format'

function GrowthBadge({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs',
        up ? 'text-emerald-600' : 'text-destructive'
      )}
    >
      {up ? (
        <ArrowUpRight className='size-3' />
      ) : (
        <ArrowDownRight className='size-3' />
      )}
      {formatPercent(value)}
    </span>
  )
}

function StatCard({
  title,
  value,
  icon,
  sub,
}: {
  title: string
  value: React.ReactNode
  icon: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          {title}
        </CardTitle>
        <div className='text-muted-foreground'>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {sub && <div className='mt-1 text-xs text-muted-foreground'>{sub}</div>}
      </CardContent>
    </Card>
  )
}

export function OverviewCards() {
  const { data, isLoading } = useQuery({
    queryKey: ['stat-stats'],
    queryFn: fetchStats,
  })

  if (isLoading || !data) {
    return (
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className='h-24 animate-pulse' />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      <StatCard
        title='今日收入'
        value={formatCents(data.todayIncome)}
        icon={<DollarSign className='size-4' />}
        sub={
          <span>
            日环比 <GrowthBadge value={data.dayIncomeGrowth} />
          </span>
        }
      />
      <StatCard
        title='本月收入'
        value={formatCents(data.currentMonthIncome)}
        icon={<DollarSign className='size-4' />}
        sub={
          <span>
            月环比 <GrowthBadge value={data.monthIncomeGrowth} />
          </span>
        }
      />
      <StatCard
        title='本月新增用户'
        value={data.currentMonthNewUsers}
        icon={<Users className='size-4' />}
        sub={
          <span>
            月环比 <GrowthBadge value={data.userGrowth} />
          </span>
        }
      />
      <StatCard
        title='用户总数'
        value={data.totalUsers}
        icon={<Users className='size-4' />}
        sub={`活跃 ${data.activeUsers}`}
      />
      <StatCard
        title='在线用户 / 设备'
        value={`${data.onlineUsers} / ${data.onlineDevices}`}
        icon={<Smartphone className='size-4' />}
      />
      <StatCard
        title='在线节点'
        value={data.onlineNodes}
        icon={<Server className='size-4' />}
      />
      <StatCard
        title='待处理工单 / 佣金'
        value={`${data.ticketPendingTotal} / ${data.commissionPendingTotal}`}
        icon={<LifeBuoy className='size-4' />}
      />
      <StatCard
        title='今日流量'
        value={formatBytes(data.todayTraffic.total)}
        icon={<Activity className='size-4' />}
        sub={`本月 ${formatBytes(data.monthTraffic.total)}`}
      />
    </div>
  )
}
