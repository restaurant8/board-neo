import { useQuery } from '@tanstack/react-query'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchResellerDashboard } from './api'

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className='rounded-lg border p-4'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 font-mono text-2xl font-bold'>{value}</div>
      {hint && <div className='mt-0.5 text-xs text-muted-foreground'>{hint}</div>}
    </div>
  )
}

export function ResellerDashboardPage() {
  const { data } = useQuery({
    queryKey: ['reseller-dashboard'],
    queryFn: fetchResellerDashboard,
  })

  const rev = data?.revenue
  const top = data?.top_sites ?? []

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col' fixed>
        <div className='mb-2'>
          <h2 className='mb-2 text-2xl font-bold tracking-tight'>分销看板</h2>
          <p className='text-muted-foreground'>
            分销体系关键指标与分站收入排行。营收数据仅统计「已入账」结算。
          </p>
        </div>

        <div className='mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <StatCard
            label='分站数'
            value={String(data?.sites.total ?? 0)}
            hint={`启用 ${data?.sites.enabled ?? 0}`}
          />
          <StatCard label='分站用户' value={String(data?.users ?? 0)} />
          <StatCard label='分站订单' value={String(data?.orders ?? 0)} />
          <StatCard
            label='待审批申请'
            value={String(data?.pending_applications ?? 0)}
          />
        </div>

        <div className='mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <StatCard label='流水总额' value={yuan(rev?.gross ?? 0)} />
          <StatCard label='平台收入（底价）' value={yuan(rev?.platform ?? 0)} />
          <StatCard
            label='站长利润（价差）'
            value={yuan(rev?.reseller_profit ?? 0)}
          />
          <StatCard
            label='已退款流水'
            value={yuan(rev?.refunded ?? 0)}
            hint='已回滚'
          />
        </div>

        <div className='mb-2'>
          <h3 className='text-lg font-semibold'>分站收入排行（Top 10）</h3>
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[50px]'>#</TableHead>
                  <TableHead>分站</TableHead>
                  <TableHead>站长</TableHead>
                  <TableHead className='w-[80px] text-center'>订单</TableHead>
                  <TableHead className='w-[110px]'>流水</TableHead>
                  <TableHead className='w-[110px]'>平台收入</TableHead>
                  <TableHead className='w-[110px]'>站长利润</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.length > 0 ? (
                  top.map((s, i) => (
                    <TableRow key={s.site_id}>
                      <TableCell className='font-mono'>{i + 1}</TableCell>
                      <TableCell className='font-medium'>{s.site_name}</TableCell>
                      <TableCell className='font-mono text-xs text-muted-foreground'>
                        {s.owner_email ?? '—'}
                      </TableCell>
                      <TableCell className='text-center font-mono'>
                        {s.order_count}
                      </TableCell>
                      <TableCell className='font-mono'>{yuan(s.gross)}</TableCell>
                      <TableCell className='font-mono'>
                        {yuan(s.platform)}
                      </TableCell>
                      <TableCell className='font-mono text-green-600'>
                        {yuan(s.profit)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center'>
                      暂无结算数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Main>
    </>
  )
}
