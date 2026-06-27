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
          <h2 className='text-2xl font-bold tracking-tight'>礼品卡管理</h2>
          <p className='text-muted-foreground mt-2'>
            在这里可以管理礼品卡模板、兑换码和使用记录等功能。
          </p>
        </div>

        <Tabs defaultValue='templates' className='flex-1'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='templates'>模板管理</TabsTrigger>
            <TabsTrigger value='codes'>兑换码管理</TabsTrigger>
            <TabsTrigger value='usages'>使用记录</TabsTrigger>
            <TabsTrigger value='statistics'>统计数据</TabsTrigger>
          </TabsList>
          <TabsContent value='templates' className='mt-6 flex-1'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-lg font-medium'>模板管理</h3>
                  <p className='text-muted-foreground text-sm'>
                    管理礼品卡模板，包括创建、编辑和删除模板。
                  </p>
                </div>
              </div>
              <TemplatesTab />
            </div>
          </TabsContent>
          <TabsContent value='codes' className='mt-6 flex-1'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-lg font-medium'>兑换码管理</h3>
                  <p className='text-muted-foreground text-sm'>
                    管理礼品卡兑换码，包括生成、查看和导出兑换码。
                  </p>
                </div>
              </div>
              <CodesTab />
            </div>
          </TabsContent>
          <TabsContent value='usages' className='mt-6 flex-1'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-lg font-medium'>使用记录</h3>
                  <p className='text-muted-foreground text-sm'>
                    查看礼品卡的使用记录和详细信息。
                  </p>
                </div>
              </div>
              <UsagesTab />
            </div>
          </TabsContent>
          <TabsContent value='statistics' className='mt-6 flex-1'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-lg font-medium'>统计数据</h3>
                  <p className='text-muted-foreground text-sm'>
                    查看礼品卡的统计数据和使用情况分析。
                  </p>
                </div>
              </div>
              <StatisticsTab />
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
