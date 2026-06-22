import { useQuery } from '@tanstack/react-query'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { fetchDnsConfig, fetchDnsNodes } from './api'
import { DnsConfigForm } from './components/dns-config-form'
import { DnsNodesTable } from './components/dns-nodes-table'

export function ServerDnsPage() {
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['dns-config'],
    queryFn: fetchDnsConfig,
  })

  const { data: nodes, isLoading: nodesLoading } = useQuery({
    queryKey: ['dns-nodes'],
    queryFn: fetchDnsNodes,
  })

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
          <h2 className='text-2xl font-bold tracking-tight'>
            Cloudflare DNS 自动同步
          </h2>
          <p className='text-muted-foreground'>
            配置 Cloudflare 凭据并为各域名节点开启自动解析同步。
          </p>
        </div>

        <DnsConfigForm config={config} isLoading={configLoading} />
        <DnsNodesTable
          nodes={nodes}
          isLoading={nodesLoading}
          zones={config?.zones ?? []}
        />
      </Main>
    </>
  )
}
