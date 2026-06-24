import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Check,
} from 'lucide-react'
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
  PLAN_PERIODS,
  PLAN_PERIOD_NAMES,
  type Plan,
  dropPlan,
  fetchPlans,
  sortPlans,
  updatePlan,
} from './api'
import { PlanMutateDialog } from './components/plan-mutate-dialog'

/** 价格 chips：按周期顺序展示已配置（>0）的价格。 */
function PriceChips({ prices }: { prices: Plan['prices'] }) {
  if (!prices) return <span className='text-muted-foreground'>-</span>
  const items = PLAN_PERIODS.filter((p) => (prices[p] ?? 0) > 0)
  if (items.length === 0) return <span className='text-muted-foreground'>-</span>
  return (
    <div className='flex flex-wrap gap-1'>
      {items.map((p) => (
        <Badge key={p} variant='secondary' className='font-normal'>
          {PLAN_PERIOD_NAMES[p]} ¥{prices[p]}
        </Badge>
      ))}
    </div>
  )
}

export function PlanPage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)
  const [keyword, setKeyword] = useState('')
  const [sortMode, setSortMode] = useState(false)
  // 排序模式下的本地顺序（id 数组），保存时一次性提交。
  const [order, setOrder] = useState<number[] | null>(null)

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

  const sortMutation = useMutation({
    mutationFn: (ids: number[]) => sortPlans(ids),
    onSuccess: () => {
      toast.success('排序已保存')
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setSortMode(false)
      setOrder(null)
    },
    onError: handleServerError,
  })

  // 实际渲染的套餐列表：排序模式按本地 order，否则按搜索过滤。
  const rows = useMemo(() => {
    const list = data ?? []
    if (sortMode && order) {
      const byId = new Map(list.map((p) => [p.id, p]))
      return order.map((id) => byId.get(id)).filter(Boolean) as Plan[]
    }
    const kw = keyword.trim().toLowerCase()
    if (!kw) return list
    return list.filter((p) => p.name.toLowerCase().includes(kw))
  }, [data, keyword, sortMode, order])

  function enterSortMode() {
    setKeyword('')
    setOrder((data ?? []).map((p) => p.id))
    setSortMode(true)
  }

  function move(index: number, dir: -1 | 1) {
    setOrder((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

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
            <h2 className='text-2xl font-bold tracking-tight'>订阅套餐</h2>
            <p className='text-muted-foreground'>管理订阅套餐、价格与销售状态。</p>
          </div>
          <div className='flex items-center gap-2'>
            {!sortMode && (
              <div className='relative'>
                <Search className='text-muted-foreground absolute start-2 top-1/2 size-4 -translate-y-1/2' />
                <Input
                  placeholder='搜索套餐名称'
                  className='w-48 ps-8'
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
            )}
            {sortMode ? (
              <>
                <Button
                  variant='outline'
                  onClick={() => {
                    setSortMode(false)
                    setOrder(null)
                  }}
                  disabled={sortMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  onClick={() => order && sortMutation.mutate(order)}
                  disabled={sortMutation.isPending || !order}
                >
                  <Check className='size-4' /> 保存排序
                </Button>
              </>
            ) : (
              <>
                <Button variant='outline' onClick={enterSortMode}>
                  <ArrowUpDown className='size-4' /> 编辑排序
                </Button>
                <Button
                  onClick={() => {
                    setCurrent(null)
                    setMutateOpen(true)
                  }}
                >
                  <Plus className='size-4' /> 添加套餐
                </Button>
              </>
            )}
          </div>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead className='w-16'>显示</TableHead>
                <TableHead className='w-16'>新购</TableHead>
                <TableHead className='w-16'>续费</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className='w-28'>统计</TableHead>
                <TableHead>权限组</TableHead>
                <TableHead>价格</TableHead>
                <TableHead className='w-28 text-end'>
                  {sortMode ? '排序' : '操作'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.id}</TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(p.show)}
                        disabled={sortMode}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: p.id, show: v })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(p.sell)}
                        disabled={sortMode}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: p.id, sell: v })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(p.renew)}
                        disabled={sortMode}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({ id: p.id, renew: v })
                        }
                      />
                    </TableCell>
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
                    <TableCell className='text-xs whitespace-nowrap'>
                      <div>用户数 {p.users_count ?? 0}</div>
                      <div className='text-muted-foreground'>
                        续费数 {p.active_users_count ?? 0}
                      </div>
                    </TableCell>
                    <TableCell>{p.group?.name ?? '-'}</TableCell>
                    <TableCell className='text-xs'>
                      <PriceChips prices={p.prices} />
                    </TableCell>
                    <TableCell className='text-end'>
                      {sortMode ? (
                        <>
                          <Button
                            variant='ghost'
                            size='icon'
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                          >
                            <ArrowUp className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            disabled={i === rows.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            <ArrowDown className='size-4' />
                          </Button>
                        </>
                      ) : (
                        <>
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
                            <Trash2 className='text-destructive size-4' />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className='h-24 text-center'>
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
