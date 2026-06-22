import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ORDER_STATUS_MAP,
  ORDER_TYPE_MAP,
  PERIOD_MAP,
  fetchOrderDetail,
} from '../api'

function yuan(cents?: number | null) {
  if (cents == null) return '-'
  return `¥${(cents / 100).toFixed(2)}`
}

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: number | null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='grid grid-cols-3 gap-2 py-1 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='col-span-2 break-all'>{value}</span>
    </div>
  )
}

export function OrderDetailDialog({ open, onOpenChange, orderId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => fetchOrderDetail(orderId as number),
    enabled: open && orderId != null,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>订单详情</DialogTitle>
          <DialogDescription>查看订单完整信息。</DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[60vh] pr-4'>
          {isLoading || !data ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              加载中...
            </p>
          ) : (
            <div className='divide-y'>
              <Row label='订单号' value={data.trade_no} />
              <Row label='用户' value={data.user?.email ?? data.user_id} />
              <Row label='套餐' value={data.plan?.name ?? data.plan_id} />
              <Row
                label='周期'
                value={
                  data.period ? (PERIOD_MAP[data.period] ?? data.period) : '-'
                }
              />
              <Row
                label='类型'
                value={ORDER_TYPE_MAP[data.type] ?? data.type}
              />
              <Row
                label='状态'
                value={ORDER_STATUS_MAP[data.status] ?? data.status}
              />
              <Row label='订单金额' value={yuan(data.total_amount)} />
              <Row label='手续费' value={yuan(data.handling_amount)} />
              <Row label='余额抵扣' value={yuan(data.balance_amount)} />
              <Row label='优惠抵扣' value={yuan(data.discount_amount)} />
              <Row label='折抵金额' value={yuan(data.surplus_amount)} />
              <Row
                label='邀请人'
                value={data.invite_user?.email ?? data.invite_user_id ?? '-'}
              />
              <Row label='佣金' value={yuan(data.commission_balance)} />
              <Row label='创建时间' value={time(data.created_at)} />
              <Row label='支付时间' value={time(data.paid_at)} />
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
