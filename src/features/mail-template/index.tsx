import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { MailTemplateManager } from './components/mail-template-manager'

export function MailTemplatePage() {
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
          <h2 className='text-2xl font-bold tracking-tight'>邮件模板</h2>
          <p className='text-muted-foreground'>
            自定义系统发送的各类邮件内容模板
          </p>
        </div>

        <MailTemplateManager />
      </Main>
    </>
  )
}
