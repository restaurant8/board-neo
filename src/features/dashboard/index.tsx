import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { IncomeTrendChart } from './components/income-trend-chart'
import { JobDetailCard } from './components/job-detail-card'
import { OverviewCards } from './components/overview-cards'
import { ServerRank } from './components/server-rank'
import { UserRank } from './components/user-rank'

export function Dashboard() {
  return (
    <>
      <Header fixed>
        <div className='flex items-center'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            仪表盘
          </h1>
        </div>
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='space-y-6'>
          <div className='grid gap-6'>
            <OverviewCards />
            <IncomeTrendChart />
            <div className='grid gap-4 md:grid-cols-2'>
              <ServerRank />
              <UserRank />
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <JobDetailCard />
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}

export default Dashboard
