import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type RouteAction,
  type ServerRoute,
  dropServerRoute,
  fetchServerRoutes,
} from './api'
import { RouteMutateDialog } from './components/route-mutate-dialog'

const ACTION_LABEL: Record<RouteAction, string> = {
  block: '阻断',
  direct: '直连',
  dns: 'DNS',
  proxy: '代理',
}

const ACTION_VARIANT: Record<
  RouteAction,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  block: 'destructive',
  direct: 'secondary',
  dns: 'outline',
  proxy: 'default',
}

export function ServerRoutePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<ServerRoute | null>(null)
  const [deleting, setDeleting] = useState<ServerRoute | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['server-routes'],
    queryFn: fetchServerRoutes,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropServerRoute(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['server-routes'] })
      setDeleting(null)
    },
    onError: handleServerError,
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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>路由规则</h2>
            <p className='text-muted-foreground'>
              配置节点流量的匹配与处理动作（阻断 / 直连 / DNS / 代理）。
            </p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 新建规则
          </Button>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>匹配规则</TableHead>
                <TableHead className='w-24'>动作</TableHead>
                <TableHead>动作值</TableHead>
                <TableHead className='w-28 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : data && data.length > 0 ? (
                data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell className='font-medium'>{r.remarks}</TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        {(r.match ?? []).slice(0, 6).map((m, i) => (
                          <Badge key={`${m}-${i}`} variant='secondary'>
                            {m}
                          </Badge>
                        ))}
                        {(r.match?.length ?? 0) > 6 && (
                          <Badge variant='outline'>
                            +{(r.match?.length ?? 0) - 6}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_VARIANT[r.action]}>
                        {ACTION_LABEL[r.action] ?? r.action}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {r.action_value || '-'}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setCurrent(r)
                          setMutateOpen(true)
                        }}
                      >
                        <Pencil className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 className='size-4 text-destructive' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    暂无路由规则
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Main>

      <RouteMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除路由规则'
        desc={`确定删除路由规则「${deleting?.remarks}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
