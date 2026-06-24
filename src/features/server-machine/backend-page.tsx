import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { BackendManager } from './components/backend-manager'

export function ServerBackendPage() {
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
          <h2 className='text-2xl font-bold tracking-tight'>后端管理</h2>
          <p className='text-muted-foreground'>
            管理各机器/节点上报的后端进程，支持远程升级与重启。
          </p>
        </div>
        <BackendManager />
      </Main>
    </>
  )
}
