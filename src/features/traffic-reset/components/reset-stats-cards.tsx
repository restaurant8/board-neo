import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { type TrafficStats, fetchResetStats } from '../api'

const ITEMS: { key: keyof TrafficStats; label: string }[] = [
  { key: 'total_resets', label: '重置总数' },
  { key: 'auto_resets', label: '自动重置' },
  { key: 'manual_resets', label: '手动重置' },
  { key: 'cron_resets', label: '定时重置' },
]

type Props = { days: number }

export function ResetStatsCards({ days }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['traffic-reset-stats', days],
    queryFn: () => fetchResetStats(days),
  })

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {ITEMS.map((item) => (
        <Card key={item.key}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {isLoading ? '—' : (data?.[item.key] ?? 0)}
            </div>
            <p className='text-xs text-muted-foreground'>近 {days} 天</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
