import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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
  PLAN_PERIOD_NAMES,
  type Plan,
  type PlanPeriod,
  dropPlan,
  fetchPlans,
  updatePlan,
} from './api'
import { PlanMutateDialog } from './components/plan-mutate-dialog'

function priceSummary(prices: Plan['prices']) {
  if (!prices) return '-'
  const entries = Object.entries(prices).filter(
    ([k, v]) => k in PLAN_PERIOD_NAMES && v > 0
  )
  if (entries.length === 0) return '-'
  return entries
    .map(([k, v]) => `${PLAN_PERIOD_NAMES[k as PlanPeriod]} ¥${v}`)
    .join(' / ')
}

export function PlanPage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: number
      show?: boolean
      renew?: boolean
      sell?: boolean
    }) => updatePlan(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropPlan(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['plans'] })
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
            <h2 className='text-2xl font-bold tracking-tight'>套餐管理</h2>
            <p className='text-muted-foreground'>管理订阅套餐与价格。</p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 新建套餐
          </Button>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>权限组</TableHead>
                <TableHead className='w-24 text-end'>流量(GB)</TableHead>
                <TableHead>价格</TableHead>
                <TableHead className='w-20 text-end'>用户数</TableHead>
                <TableHead className='w-20'>显示</TableHead>
                <TableHead className='w-20'>售卖</TableHead>
                <TableHead className='w-20'>续费</TableHead>
                <TableHead className='w-24 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : data && data.length > 0 ? (
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.id}</TableCell>
                    <TableCell className='font-medium'>
                      {p.name}
                      {p.tags && p.tags.length > 0 && (
                        <span className='ms-1 inline-flex flex-wrap gap-1'>
                          {p.tags.map((t) => (
                            <Badge key={t} variant='secondary'>
                              {t}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{p.group?.name ?? '-'}</TableCell>
                    <TableCell className='text-end'>{p.transfer_enable}</TableCell>
                    <TableCell className='text-xs'>
                      {priceSummary(p.prices)}
                    </TableCell>
                    <TableCell className='text-end'>
                      {p.users_count ?? 0}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.show}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: p.id, show: v })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.sell}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: p.id, sell: v })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.renew}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: p.id, renew: v })
                        }
                      />
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setCurrent(p)
                          setMutateOpen(true)
                        }}
                      >
                        <Pencil className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 className='size-4 text-destructive' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className='h-24 text-center'>
                    暂无套餐
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Main>

      <PlanMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除套餐'
        desc={`确定删除套餐「${deleting?.name}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
