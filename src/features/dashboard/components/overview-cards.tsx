import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  LifeBuoy,
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
  onClick,
}: {
  title: string
  value: React.ReactNode
  icon: React.ReactNode
  sub?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        onClick &&
          'hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors'
      )}
    >
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
  const navigate = useNavigate()
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
        title='待处理工单'
        value={data.ticketPendingTotal}
        icon={<LifeBuoy className='size-4' />}
        sub='有工单需要处理'
        onClick={() => navigate({ to: '/ticket', search: { status: '0' } })}
      />
      <StatCard
        title='待处理佣金'
        value={data.commissionPendingTotal}
        icon={<DollarSign className='size-4' />}
        sub='有佣金需要确认'
        onClick={() =>
          navigate({ to: '/order', search: { commission_status: ['0'] } })
        }
      />
      <StatCard
        title='月上传'
        value={formatBytes(data.monthTraffic.upload)}
        icon={<ArrowUpRight className='size-4' />}
        sub={`今日：${formatBytes(data.todayTraffic.upload)}`}
      />
      <StatCard
        title='月下载'
        value={formatBytes(data.monthTraffic.download)}
        icon={<ArrowDownRight className='size-4' />}
        sub={`今日：${formatBytes(data.todayTraffic.download)}`}
      />
    </div>
  )
}
