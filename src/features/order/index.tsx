import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, Check, X, Search } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Order,
  ORDER_STATUS_MAP,
  ORDER_TYPE_MAP,
  PERIOD_MAP,
  cancelOrder,
  fetchOrders,
  markOrderPaid,
} from './api'
import { OrderAssignDialog } from './components/order-assign-dialog'
import { OrderDetailDialog } from './components/order-detail-dialog'

function yuan(cents?: number | null) {
  if (cents == null) return '-'
  return `¥${(cents / 100).toFixed(2)}`
}

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function statusVariant(status: number) {
  if (status === 3) return 'default' as const
  if (status === 0) return 'secondary' as const
  if (status === 2) return 'outline' as const
  return 'secondary' as const
}

export function OrderPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [paying, setPaying] = useState<Order | null>(null)
  const [cancelling, setCancelling] = useState<Order | null>(null)

  const filter = keyword
    ? [{ id: 'trade_no', value: keyword }]
    : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, pageSize, keyword],
    queryFn: () =>
      fetchOrders({ current: page, pageSize, filter }),
  })

  const paidMutation = useMutation({
    mutationFn: (trade_no: string) => markOrderPaid(trade_no),
    onSuccess: () => {
      toast.success('已标记为已支付')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setPaying(null)
    },
    onError: handleServerError,
  })

  const cancelMutation = useMutation({
    mutationFn: (trade_no: string) => cancelOrder(trade_no),
    onSuccess: () => {
      toast.success('订单已取消')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setCancelling(null)
    },
    onError: handleServerError,
  })

  const rows = data?.data ?? []
  const lastPage = data?.last_page ?? 1

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
            <h2 className='text-2xl font-bold tracking-tight'>订单管理</h2>
            <p className='text-muted-foreground'>查看与管理用户订单。</p>
          </div>
          <Button
            onClick={() => setAssignOpen(true)}
          >
            <Plus className='size-4' /> 分配订单
          </Button>
        </div>

        <form
          className='flex gap-2'
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setKeyword(search.trim())
          }}
        >
          <Input
            placeholder='按订单号搜索'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='max-w-xs'
          />
          <Button type='submit' variant='secondary'>
            <Search className='size-4' /> 搜索
          </Button>
        </form>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead className='w-20'>周期</TableHead>
                <TableHead className='w-20'>类型</TableHead>
                <TableHead className='w-24 text-end'>金额</TableHead>
                <TableHead className='w-20'>状态</TableHead>
                <TableHead className='w-40'>创建时间</TableHead>
                <TableHead className='w-32 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className='font-mono text-xs'>
                      {o.trade_no}
                    </TableCell>
                    <TableCell>{o.plan?.name ?? o.plan_id}</TableCell>
                    <TableCell>
                      {o.period ? (PERIOD_MAP[o.period] ?? o.period) : '-'}
                    </TableCell>
                    <TableCell>
                      {ORDER_TYPE_MAP[o.type] ?? o.type}
                    </TableCell>
                    <TableCell className='text-end'>
                      {yuan(o.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(o.status)}>
                        {ORDER_STATUS_MAP[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {time(o.created_at)}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        title='详情'
                        onClick={() => setDetailId(o.id)}
                      >
                        <Eye className='size-4' />
                      </Button>
                      {o.status === 0 && (
                        <>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='标记已支付'
                            onClick={() => setPaying(o)}
                          >
                            <Check className='size-4 text-green-600' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='取消订单'
                            onClick={() => setCancelling(o)}
                          >
                            <X className='size-4 text-destructive' />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className='h-24 text-center'>
                    暂无订单
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-sm'>
            共 {data?.total ?? 0} 条，第 {page} / {lastPage} 页
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </Main>

      <OrderAssignDialog open={assignOpen} onOpenChange={setAssignOpen} />

      <OrderDetailDialog
        open={detailId != null}
        onOpenChange={(o) => !o && setDetailId(null)}
        orderId={detailId}
      />

      <ConfirmDialog
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        title='标记为已支付'
        desc={`确定将订单「${paying?.trade_no}」标记为已支付吗？`}
        confirmText='确定'
        isLoading={paidMutation.isPending}
        handleConfirm={() =>
          paying && paidMutation.mutate(paying.trade_no)
        }
      />

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title='取消订单'
        desc={`确定取消订单「${cancelling?.trade_no}」吗？此操作不可撤销。`}
        confirmText='取消订单'
        destructive
        isLoading={cancelMutation.isPending}
        handleConfirm={() =>
          cancelling && cancelMutation.mutate(cancelling.trade_no)
        }
      />
    </>
  )
}
