import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodesTab } from './components/codes-tab'
import { StatisticsTab } from './components/statistics-tab'
import { TemplatesTab } from './components/templates-tab'
import { UsagesTab } from './components/usages-tab'

export function GiftCardPage() {
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
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>礼品卡</h2>
          <p className='text-muted-foreground'>
            管理礼品卡模板、兑换码、使用记录与统计。
          </p>
        </div>

        <Tabs defaultValue='templates' className='flex-1'>
          <TabsList>
            <TabsTrigger value='templates'>模板</TabsTrigger>
            <TabsTrigger value='codes'>卡密</TabsTrigger>
            <TabsTrigger value='usages'>使用记录</TabsTrigger>
            <TabsTrigger value='statistics'>统计</TabsTrigger>
          </TabsList>
          <TabsContent value='templates' className='mt-4'>
            <TemplatesTab />
          </TabsContent>
          <TabsContent value='codes' className='mt-4'>
            <CodesTab />
          </TabsContent>
          <TabsContent value='usages' className='mt-4'>
            <UsagesTab />
          </TabsContent>
          <TabsContent value='statistics' className='mt-4'>
            <StatisticsTab />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
