import { type ColumnDef } from '@tanstack/react-table'
import { ExternalLink, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import {
  COMMISSION_STATUS_MAP,
  ORDER_STATUS_MAP,
  ORDER_TYPE_MAP,
  PERIOD_MAP,
  type Order,
} from '../api'
import { COMMISSION_STATUS_ICON, ORDER_STATUS_ICON } from '../data'

function yuan(cents?: number | null) {
  if (cents == null) return '-'
  return `¥${(cents / 100).toFixed(2)}`
}

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function orderStatusVariant(status: number) {
  if (status === 3) return 'default' as const
  if (status === 0) return 'secondary' as const
  if (status === 2) return 'outline' as const
  return 'secondary' as const
}

function commissionStatusVariant(status: number) {
  if (status === 2) return 'default' as const
  if (status === 3) return 'outline' as const
  return 'secondary' as const
}

export type OrderColumnHandlers = {
  onView: (order: Order) => void
  onMarkPaid: (order: Order) => void
  onCancel: (order: Order) => void
  /** 更新佣金状态（1=发放中 / 3=无效），仅对有佣金的订单可用。 */
  onSetCommission: (order: Order, commission_status: number) => void
}

export function getOrdersColumns(
  handlers: OrderColumnHandlers
): ColumnDef<Order>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='全选'
          className='translate-y-0.5'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='选择行'
          className='translate-y-0.5'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'trade_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订单号' />
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original
        return (
          <button
            type='button'
            onClick={() => handlers.onView(order)}
            className='hover:text-primary flex max-w-48 items-center gap-1.5 font-mono text-xs'
            title='查看订单详情'
          >
            <span className='truncate'>{order.trade_no}</span>
            <ExternalLink className='size-3.5 shrink-0 opacity-60' />
          </button>
        )
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='类型' />
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant='outline'>
          {ORDER_TYPE_MAP[row.original.type] ?? row.original.type}
        </Badge>
      ),
    },
    {
      id: 'plan',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订阅计划' />
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original
        return (
          <LongText className='max-w-36'>
            {order.plan?.name ?? String(order.plan_id)}
          </LongText>
        )
      },
    },
    {
      accessorKey: 'period',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='周期' />
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const period = row.original.period
        return (
          <Badge variant='secondary'>
            {period ? (PERIOD_MAP[period] ?? period) : '-'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'total_amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='支付金额' />
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <span className='tabular-nums'>{yuan(row.original.total_amount)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订单状态' />
      ),
      cell: ({ row }) => {
        const status = row.original.status
        const Icon = ORDER_STATUS_ICON[status]
        return (
          <Badge
            variant={orderStatusVariant(status)}
            className='gap-1 whitespace-nowrap'
          >
            {Icon && <Icon className='size-3.5' />}
            {ORDER_STATUS_MAP[status] ?? status}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'commission_balance',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='佣金金额' />
      ),
      cell: ({ row }) => (
        <span className='tabular-nums'>
          {yuan(row.original.commission_balance)}
        </span>
      ),
    },
    {
      accessorKey: 'commission_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='佣金状态' />
      ),
      cell: ({ row }) => {
        const status = row.original.commission_status
        if (status == null) return <span className='text-muted-foreground'>-</span>
        const Icon = COMMISSION_STATUS_ICON[status]
        return (
          <Badge
            variant={commissionStatusVariant(status)}
            className='gap-1 whitespace-nowrap'
          >
            {Icon && <Icon className='size-3.5' />}
            {COMMISSION_STATUS_MAP[status] ?? status}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='创建时间' />
      ),
      cell: ({ row }) => (
        <span className='text-xs whitespace-nowrap'>
          {time(row.original.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const order = row.original
        return (
          <div className='text-end'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label='打开操作菜单'
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => handlers.onView(order)}>
                  查看详情
                </DropdownMenuItem>
                {(order.commission_balance ?? 0) > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {order.commission_status !== 1 && (
                      <DropdownMenuItem
                        onClick={() => handlers.onSetCommission(order, 1)}
                      >
                        佣金发放中
                      </DropdownMenuItem>
                    )}
                    {order.commission_status !== 3 && (
                      <DropdownMenuItem
                        className='text-destructive'
                        onClick={() => handlers.onSetCommission(order, 3)}
                      >
                        佣金无效
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {order.status === 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlers.onMarkPaid(order)}>
                      标记已支付
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className='text-destructive'
                      onClick={() => handlers.onCancel(order)}
                    >
                      取消订单
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      meta: { className: cn('text-end') },
    },
  ]
}
