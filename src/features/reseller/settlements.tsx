import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { fetchAdminSettlements, fetchResellerSites } from './api'

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  confirmed: { label: '已入账', variant: 'secondary' },
  refunded: { label: '已退款', variant: 'destructive' },
  pending: { label: '待确认', variant: 'default' },
  withdrawn: { label: '已提现', variant: 'secondary' },
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border p-4'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 font-mono text-2xl font-bold'>{value}</div>
    </div>
  )
}

export function ResellerSettlementsPage() {
  const [siteId, setSiteId] = useState<string>('all')
  const [page, setPage] = useState(1)

  const { data: sites } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
  })

  const { data } = useQuery({
    queryKey: ['reseller-settlements', siteId, page],
    queryFn: () =>
      fetchAdminSettlements({
        current: page,
        pageSize: 20,
        site_id: siteId === 'all' ? undefined : Number(siteId),
      }),
  })

  const rows = data?.data ?? []
  const summary = data?.summary
  const lastPage = data?.last_page ?? 1

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
          <h2 className='mb-2 text-2xl font-bold tracking-tight'>结算总览</h2>
          <p className='text-muted-foreground'>
            各分站价差结算流水与汇总。汇总仅统计「已入账」记录（退款已回滚不计）。
          </p>
        </div>

        <div className='mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <StatCard
            label='平台收入（底价）'
            value={yuan(summary?.platform_revenue ?? 0)}
          />
          <StatCard
            label='站长利润（价差）'
            value={yuan(summary?.reseller_profit ?? 0)}
          />
          <StatCard label='流水总额（实付）' value={yuan(summary?.gross ?? 0)} />
        </div>

        <div className='mb-4 flex items-center gap-2'>
          <span className='text-sm text-muted-foreground'>分站筛选：</span>
          <Select
            value={siteId}
            onValueChange={(v) => {
              setSiteId(v)
              setPage(1)
            }}
          >
            <SelectTrigger className='w-[240px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部分站</SelectItem>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[70px]'>订单</TableHead>
                  <TableHead>分站</TableHead>
                  <TableHead>站长</TableHead>
                  <TableHead className='w-[90px]'>实付</TableHead>
                  <TableHead className='w-[90px]'>平台收</TableHead>
                  <TableHead className='w-[90px]'>站长利润</TableHead>
                  <TableHead className='w-[90px]'>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className='font-mono'>#{s.order_id}</TableCell>
                      <TableCell>{s.site_name ?? `#${s.site_id}`}</TableCell>
                      <TableCell className='font-mono text-xs text-muted-foreground'>
                        {s.owner_email ?? '—'}
                      </TableCell>
                      <TableCell className='font-mono'>
                        {yuan(s.order_amount)}
                      </TableCell>
                      <TableCell className='font-mono'>
                        {yuan(s.floor_amount)}
                      </TableCell>
                      <TableCell className='font-mono text-green-600'>
                        {yuan(s.profit_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_BADGE[s.status]?.variant ?? 'default'}
                        >
                          {STATUS_BADGE[s.status]?.label ?? s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center'>
                      暂无结算记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {lastPage > 1 && (
            <div className='mt-3 flex items-center justify-end gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span className='text-sm text-muted-foreground'>
                {page} / {lastPage}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </Main>
    </>
  )
}
