import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { IncomeTrendChart } from './components/income-trend-chart'
import { JobDetailCard } from './components/job-detail-card'
import { OverviewCards } from './components/overview-cards'
import { ServerRank } from './components/server-rank'
import { TimeRangeSelect, useTimeRange } from './components/time-range'
import { UserRank } from './components/user-rank'

export function Dashboard() {
  const timeRange = useTimeRange('7')

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>仪表盘</h2>
            <p className='text-muted-foreground'>
              站点收入、用户、流量与节点概览。
            </p>
          </div>
          <TimeRangeSelect {...timeRange} />
        </div>

        <OverviewCards />

        <div className='grid gap-4 lg:grid-cols-3'>
          <div className='lg:col-span-2'>
            <IncomeTrendChart range={timeRange.range} />
          </div>
          <JobDetailCard />
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <ServerRank />
          <UserRank />
        </div>
      </Main>
    </>
  )
}

export default Dashboard
