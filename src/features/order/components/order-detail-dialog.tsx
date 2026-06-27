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
import { Separator } from '@/components/ui/separator'
import {
  COMMISSION_STATUS_MAP,
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

/** 订单状态徽章（对齐原版：彩底胶囊）。 */
function StatusBadge({ status }: { status: number }) {
  const map: Record<number, string> = {
    0: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    1: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    2: 'bg-red-100 text-red-800 hover:bg-red-100',
    3: 'bg-green-100 text-green-800 hover:bg-green-100',
    4: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  }
  return (
    <Badge
      variant='secondary'
      className={cn('font-medium text-nowrap', map[status])}
    >
      {ORDER_STATUS_MAP[status] ?? String(status)}
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
      <div className='mb-2 text-sm font-medium'>{title}</div>
      <div className='space-y-0.5'>{children}</div>
    </div>
  )
}

/** 标签 / 值 一行（对齐原版 v6t：label 固定 w-28）。 */
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
    <div className='flex items-center py-1.5'>
      <div className='text-muted-foreground w-28 shrink-0 text-sm'>{label}</div>
      <div className={cn('text-sm', valueClassName)}>{value || '-'}</div>
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

  const showCommission =
    data?.commission_status != null && !!data?.commission_balance

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-xl'>
        <DialogHeader className='space-y-2'>
          <DialogTitle className='text-lg font-medium'>订单信息</DialogTitle>
          {data && (
            <div className='flex items-center justify-between text-sm'>
              <div className='flex items-center space-x-6'>
                <div className='text-muted-foreground'>
                  订单号：{data.trade_no}
                </div>
                {!!data.status && <StatusBadge status={data.status} />}
              </div>
            </div>
          )}
        </DialogHeader>
        {isLoading || !data ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            加载中...
          </p>
        ) : (
          <div className='space-y-4'>
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
                valueClassName='font-medium'
              />
              <Field
                label='类型'
                value={ORDER_TYPE_MAP[data.type] ?? data.type}
              />
              <Field
                label='回调单号'
                value={data.callback_no}
                valueClassName='font-mono text-xs'
              />
            </Section>

            <Section title='金额信息'>
              <Field
                label='支付金额'
                value={yuan(data.total_amount)}
                valueClassName='text-primary font-medium'
              />
              <Separator className='my-2' />
              <Field label='手续费' value={yuan(data.handling_amount)} />
              <Field label='余额支付' value={yuan(data.balance_amount)} />
              <Field
                label='优惠金额'
                value={yuan(data.discount_amount)}
                valueClassName='text-green-600'
              />
              <Field label='折抵金额' value={yuan(data.surplus_amount)} />
            </Section>

            <Section title='时间信息'>
              <Field
                label='创建时间'
                value={time(data.created_at)}
                valueClassName='font-mono text-xs'
              />
              <Field
                label='更新时间'
                value={time(data.updated_at)}
                valueClassName='font-mono text-xs'
              />
              <Field
                label='支付时间'
                value={time(data.paid_at)}
                valueClassName='font-mono text-xs'
              />
            </Section>

            {showCommission && (
              <Section title='佣金信息'>
                <Field
                  label='佣金状态'
                  value={
                    <Badge
                      variant='secondary'
                      className={cn(
                        'font-medium',
                        data.commission_status === 0
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                          : data.commission_status === 1
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                            : data.commission_status === 2
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-red-100 text-red-800 hover:bg-red-100'
                      )}
                    >
                      {COMMISSION_STATUS_MAP[data.commission_status as number] ??
                        '有效'}
                    </Badge>
                  }
                />
                <Field
                  label='佣金金额'
                  value={yuan(data.commission_balance)}
                  valueClassName='text-orange-600 font-medium'
                />
                {!!data.actual_commission_balance && (
                  <Field
                    label='实际佣金'
                    value={yuan(data.actual_commission_balance)}
                    valueClassName='text-orange-700 font-medium'
                  />
                )}
                {data.invite_user && (
                  <>
                    <Separator className='my-2' />
                    <Field
                      label='邀请人'
                      value={
                        <UserLink
                          email={data.invite_user.email}
                          fallback={data.invite_user_id ?? '-'}
                          onNavigate={() => onOpenChange(false)}
                        />
                      }
                    />
                    <Field
                      label='邀请人ID'
                      value={data.invite_user.id}
                      valueClassName='font-mono text-xs'
                    />
                  </>
                )}
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
