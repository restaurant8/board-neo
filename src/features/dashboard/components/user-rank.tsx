import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchTrafficRank } from '../api'
import { formatBytes, formatPercent } from '../format'

export function UserRank() {
  const { data, isLoading } = useQuery({
    queryKey: ['traffic-rank', 'user'],
    queryFn: () => fetchTrafficRank({ type: 'user' }),
  })

  const rows = data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户流量排行</CardTitle>
        <CardDescription>近 7 天消耗 Top 10（含环比）</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>#</TableHead>
              <TableHead>用户</TableHead>
              <TableHead className='text-end'>流量</TableHead>
              <TableHead className='text-end'>环比</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className='text-muted-foreground'>{i + 1}</TableCell>
                  <TableCell className='max-w-[180px] truncate font-medium'>
                    {r.name}
                  </TableCell>
                  <TableCell className='text-end'>{formatBytes(r.value)}</TableCell>
                  <TableCell className='text-end'>
                    <span
                      className={cn(
                        'inline-flex items-center text-xs',
                        r.change >= 0 ? 'text-emerald-600' : 'text-destructive'
                      )}
                    >
                      {r.change >= 0 ? (
                        <ArrowUpRight className='size-3' />
                      ) : (
                        <ArrowDownRight className='size-3' />
                      )}
                      {formatPercent(r.change)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className='h-24 text-center'>
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
