import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchServerLastRank, fetchServerYesterdayRank } from '../api'
import { formatBytes } from '../format'

export function ServerRank() {
  const [period, setPeriod] = useState<'today' | 'yesterday'>('today')

  const { data, isLoading } = useQuery({
    queryKey: ['server-rank', period],
    queryFn: () =>
      period === 'today' ? fetchServerLastRank() : fetchServerYesterdayRank(),
  })

  const rows = (data ?? []).slice(0, 10)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>节点流量排行</CardTitle>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList>
            <TabsTrigger value='today'>今日</TabsTrigger>
            <TabsTrigger value='yesterday'>昨日</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>#</TableHead>
              <TableHead>节点</TableHead>
              <TableHead className='text-end'>流量</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((s, i) => (
                <TableRow key={`${s.server_id}-${s.server_type}`}>
                  <TableCell className='text-muted-foreground'>{i + 1}</TableCell>
                  <TableCell className='font-medium'>{s.server_name}</TableCell>
                  <TableCell className='text-end'>{formatBytes(s.total)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className='h-24 text-center'>
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
