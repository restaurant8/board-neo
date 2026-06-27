import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
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

/** 订单状态徽章（对齐原版：已完成=绿、已取消=红、待支付/开通中=灰）。 */
function StatusBadge({ status }: { status: number }) {
  const label = ORDER_STATUS_MAP[status] ?? String(status)
  const cls =
    status === 3
      ? 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
      : status === 2
        ? 'border-transparent bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
        : undefined
  return (
    <Badge variant={cls ? 'outline' : 'secondary'} className={cls}>
      {label}
    </Badge>
  )
}

/** 信息分区卡片。 */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className='rounded-lg border p-4'>
      <div className='mb-2 text-sm font-semibold'>{title}</div>
      <div className='space-y-0.5'>{children}</div>
    </div>
  )
}

/** 标签 / 值 一行。 */
function Field({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className='grid grid-cols-3 gap-2 py-1 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className={cn('col-span-2 break-all', valueClassName)}>{value}</span>
    </div>
  )
}

/** 用户/邀请人邮箱：点击跳转到用户管理并按邮箱过滤（对齐原版）。 */
function UserLink({
  email,
  fallback,
  onNavigate,
}: {
  email?: string | null
  fallback: React.ReactNode
  onNavigate: () => void
}) {
  if (!email) return <>{fallback}</>
  return (
    <Link
      to='/user'
      search={{ email }}
      onClick={onNavigate}
      className='text-primary group inline-flex items-center gap-1 hover:underline'
    >
      {email}
      <ExternalLink className='size-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
    </Link>
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
        <DialogHeader className='pe-10'>
          <DialogTitle>订单信息</DialogTitle>
          {data && (
            <div className='flex flex-wrap items-center gap-2 text-sm'>
              <span className='text-muted-foreground'>订单号：</span>
              <span className='font-mono break-all'>{data.trade_no}</span>
              <StatusBadge status={data.status} />
            </div>
          )}
        </DialogHeader>
        <ScrollArea className='max-h-[65vh] pe-4'>
          {isLoading || !data ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              加载中...
            </p>
          ) : (
            <div className='space-y-3'>
              <Section title='基本信息'>
                <Field
                  label='用户邮箱'
                  value={
                    <UserLink
                      email={data.user?.email}
                      fallback={data.user_id}
                      onNavigate={() => onOpenChange(false)}
                    />
                  }
                />
                <Field
                  label='订单周期'
                  value={
                    data.period ? (PERIOD_MAP[data.period] ?? data.period) : '-'
                  }
                />
                <Field
                  label='订阅计划'
                  value={data.plan?.name ?? data.plan_id}
                />
                <Field label='类型' value={ORDER_TYPE_MAP[data.type] ?? data.type} />
                <Field
                  label='邀请人'
                  value={
                    <UserLink
                      email={data.invite_user?.email}
                      fallback={data.invite_user_id ?? '-'}
                      onNavigate={() => onOpenChange(false)}
                    />
                  }
                />
                <Field
                  label='回调单号'
                  value={data.callback_no ?? '-'}
                  valueClassName='font-mono'
                />
              </Section>

              <Section title='金额信息'>
                <Field label='支付金额' value={yuan(data.total_amount)} />
                <Field label='手续费' value={yuan(data.handling_amount)} />
                <Field label='余额支付' value={yuan(data.balance_amount)} />
                <Field
                  label='优惠金额'
                  value={yuan(data.discount_amount)}
                  valueClassName='text-emerald-600 dark:text-emerald-400'
                />
                <Field label='折抵金额' value={yuan(data.surplus_amount)} />
                <Field label='佣金' value={yuan(data.commission_balance)} />
              </Section>

              <Section title='时间信息'>
                <Field label='创建时间' value={time(data.created_at)} />
                <Field label='更新时间' value={time(data.updated_at)} />
                <Field label='支付时间' value={time(data.paid_at)} />
              </Section>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
