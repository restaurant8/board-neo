import { useCallback, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { handleServerError } from '@/lib/handle-server-error'
import { toast } from 'sonner'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { type Order, cancelOrder, markOrderPaid } from './api'
import { OrderAssignDialog } from './components/order-assign-dialog'
import { OrderDetailDialog } from './components/order-detail-dialog'
import { type OrderColumnHandlers } from './components/orders-columns'
import { OrdersTable } from './components/orders-table'

const route = getRouteApi('/_authenticated/order/')

export function OrderPage() {
  const queryClient = useQueryClient()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const [assignOpen, setAssignOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [paying, setPaying] = useState<Order | null>(null)
  const [cancelling, setCancelling] = useState<Order | null>(null)

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

  const handlers: OrderColumnHandlers = {
    onView: useCallback((order: Order) => setDetailId(order.id), []),
    onMarkPaid: useCallback((order: Order) => setPaying(order), []),
    onCancel: useCallback((order: Order) => setCancelling(order), []),
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
            <h2 className='text-2xl font-bold tracking-tight'>订单管理</h2>
            <p className='text-muted-foreground'>
              在这里可以查看用户订单，包括分配、查看、删除等操作。
            </p>
          </div>
        </div>

        <OrdersTable
          search={search}
          navigate={navigate}
          handlers={handlers}
          onAdd={() => setAssignOpen(true)}
        />
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
        handleConfirm={() => paying && paidMutation.mutate(paying.trade_no)}
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
