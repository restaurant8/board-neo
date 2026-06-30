import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ResellerSite,
  dropResellerSite,
  fetchResellerSites,
  toggleResellerSite,
} from './api'
import { DomainManageDialog } from './components/domain-manage-dialog'
import { ResellerMutateDialog } from './components/reseller-mutate-dialog'

export function ResellerPage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<ResellerSite | null>(null)
  const [domainSite, setDomainSite] = useState<ResellerSite | null>(null)
  const [deleting, setDeleting] = useState<ResellerSite | null>(null)
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleResellerSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reseller-sites'] })
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropResellerSite(id),
    onSuccess: () => {
      toast.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['reseller-sites'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const rows = (data ?? []).filter((s) => {
    const kw = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(kw) ||
      (s.domain ?? '').toLowerCase().includes(kw) ||
      (s.owner_email ?? '').toLowerCase().includes(kw)
    )
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

      <Main className='flex flex-1 flex-col' fixed>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <div className='mb-2'>
              <h2 className='text-2xl font-bold tracking-tight'>分站管理</h2>
            </div>
            <p className='text-muted-foreground'>
              创建分站、绑定独立域名并指定站长。绑定域名后，该域名注册的用户与下单将自动归属对应分站。
            </p>
          </div>
        </div>

        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          <div className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex flex-1 flex-wrap items-center gap-2 sm:flex-nowrap'>
                <Button
                  variant='outline'
                  size='sm'
                  className='space-x-2'
                  onClick={() => {
                    setCurrent(null)
                    setMutateOpen(true)
                  }}
                >
                  <Plus className='h-4 w-4' /> <div>添加分站</div>
                </Button>
                <Input
                  placeholder='搜索名称 / 域名 / 站长邮箱...'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='h-8 w-full min-w-[150px] sm:w-[150px] lg:w-[280px]'
                />
                {search !== '' && (
                  <Button
                    variant='ghost'
                    onClick={() => setSearch('')}
                    className='h-9 px-2 lg:px-3'
                  >
                    重置
                    <X className='ml-2 h-4 w-4' />
                  </Button>
                )}
              </div>
            </div>

            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[60px]'>ID</TableHead>
                    <TableHead className='w-[90px]'>状态</TableHead>
                    <TableHead>分站名称</TableHead>
                    <TableHead>绑定域名</TableHead>
                    <TableHead>站长</TableHead>
                    <TableHead className='w-[80px] text-center'>用户</TableHead>
                    <TableHead className='w-[80px] text-center'>订单</TableHead>
                    <TableHead className='w-[130px] text-end'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Badge variant='outline' className='font-mono'>
                            {s.id}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!!s.status}
                            onCheckedChange={() => toggleMutation.mutate(s.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className='truncate font-medium'>{s.name}</span>
                        </TableCell>
                        <TableCell>
                          {s.domain ? (
                            <span className='flex items-center gap-1 font-mono text-xs'>
                              <Globe className='h-3 w-3 text-muted-foreground' />
                              {s.domain}
                              {s.aliases?.length > 0 && (
                                <Badge
                                  variant='secondary'
                                  className='ml-1 h-4 px-1 font-mono text-[10px]'
                                >
                                  +{s.aliases.length}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            <span className='text-xs text-muted-foreground'>
                              未绑定
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className='font-mono text-xs text-muted-foreground'>
                            {s.owner_email ?? `#${s.owner_user_id}`}
                          </span>
                        </TableCell>
                        <TableCell className='text-center font-mono'>
                          {s.user_count}
                        </TableCell>
                        <TableCell className='text-center font-mono'>
                          {s.order_count}
                        </TableCell>
                        <TableCell className='text-end'>
                          <div className='flex items-center justify-end space-x-2'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:bg-muted'
                              onClick={() => setDomainSite(s)}
                            >
                              <Globe className='h-4 w-4 text-muted-foreground hover:text-foreground' />
                              <span className='sr-only'>域名管理</span>
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:bg-muted'
                              onClick={() => {
                                setCurrent(s)
                                setMutateOpen(true)
                              }}
                            >
                              <Pencil className='h-4 w-4 text-muted-foreground hover:text-foreground' />
                              <span className='sr-only'>编辑</span>
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                              onClick={() => setDeleting(s)}
                            >
                              <Trash2 className='h-4 w-4 text-muted-foreground hover:text-red-600 dark:hover:text-red-400' />
                              <span className='sr-only'>删除确认</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className='h-24 text-center'>
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Main>

      <ResellerMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <DomainManageDialog
        open={!!domainSite}
        onOpenChange={(o) => !o && setDomainSite(null)}
        site={domainSite}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除确认'
        desc='确定要删除该分站吗？该分站下的用户将转为主站用户（套餐/订阅/账号不受影响），域名绑定与品牌将失效；历史订单/结算记录保留。此操作无法撤销。'
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
