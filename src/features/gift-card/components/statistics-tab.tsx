import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
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
import { fetchStatistics } from '../api'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
      </CardContent>
    </Card>
  )
}

export function StatisticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['gift-statistics'],
    queryFn: () => fetchStatistics(),
  })

  if (isLoading || !data) {
    return (
      <p className='text-muted-foreground py-8 text-center text-sm'>加载中...</p>
    )
  }

  const s = data.total_stats

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5'>
        <Stat label='模板总数' value={s.templates_count} />
        <Stat label='启用模板' value={s.active_templates_count} />
        <Stat label='兑换码总数' value={s.codes_count} />
        <Stat label='已使用兑换码' value={s.used_codes_count} />
        <Stat label='使用次数' value={s.usages_count} />
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <div>
          <h3 className='mb-2 text-sm font-semibold'>按类型统计</h3>
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模板</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className='text-end'>次数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.type_stats.length > 0 ? (
                  data.type_stats.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{t.template_name}</TableCell>
                      <TableCell>{t.type_name}</TableCell>
                      <TableCell className='text-end'>{t.count}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className='h-16 text-center'>
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h3 className='mb-2 text-sm font-semibold'>每日使用（近30天）</h3>
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead className='text-end'>次数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.daily_usages.length > 0 ? (
                  data.daily_usages.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>{d.date}</TableCell>
                      <TableCell className='text-end'>{d.count}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className='h-16 text-center'>
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
