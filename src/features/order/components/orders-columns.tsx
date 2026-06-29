import { type ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
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
import {
  COMMISSION_STATUS_MAP,
  ORDER_STATUS_MAP,
  ORDER_TYPE_MAP,
  PERIOD_MAP,
  type Order,
} from '../api'
import {
  COMMISSION_STATUS_COLOR,
  COMMISSION_STATUS_ICON,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_ICON,
} from '../data'

function time(ts?: number | null) {
  if (!ts) return '-'
  return format(new Date(ts * 1000), 'yyyy/MM/dd HH:mm:ss')
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
      meta: { className: 'w-10' },
    },
    {
      accessorKey: 'trade_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订单号' />
      ),
      enableSorting: false,
      meta: { className: 'w-32' },
      cell: ({ row }) => {
        const order = row.original
        const t = order.trade_no
        const short = t.length > 6 ? `${t.slice(0, 3)}...${t.slice(-3)}` : t
        return (
          <div className='flex items-center'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handlers.onView(order)}
              className='hover:bg-primary/10 text-primary hover:text-primary/80 flex h-8 items-center gap-1.5 px-2 font-medium transition-colors'
              title='查看订单详情'
            >
              <span className='font-mono'>{short}</span>
              <ExternalLink className='h-3.5 w-3.5 opacity-70' />
            </Button>
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='类型' />
      ),
      enableSorting: false,
      meta: { className: 'w-24' },
      cell: ({ row }) => (
        <Badge
          variant='secondary'
          className='border-border/50 text-nowrap border bg-slate-100/80 font-medium text-slate-700 transition-colors hover:bg-slate-200/80'
        >
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
          <div className='flex space-x-2'>
            <span className='text-foreground/90 max-w-32 truncate font-medium sm:max-w-72 md:max-w-[31rem]'>
              {order.plan?.name ?? String(order.plan_id)}
            </span>
          </div>
        )
      },
    },
    {
      id: 'site',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='来源' />
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const name = row.original.site_name
        return name ? (
          <Badge variant='secondary'>{name}</Badge>
        ) : (
          <Badge variant='outline'>主站</Badge>
        )
      },
    },
    {
      accessorKey: 'period',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='周期' />
      ),
      enableSorting: false,
      meta: { className: 'w-24' },
      cell: ({ row }) => {
        const period = row.original.period
        return (
          <Badge
            variant='secondary'
            className='hover:bg-opacity-80 text-nowrap bg-slate-100/80 font-medium text-slate-700 transition-colors'
          >
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
      meta: { className: 'w-28' },
      cell: ({ row }) => {
        const v = row.original.total_amount
        const n = typeof v === 'number' ? (v / 100).toFixed(2) : 'N/A'
        return (
          <div className='text-foreground/90 flex items-center font-mono'>
            ¥{n}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订单状态' />
      ),
      meta: { className: 'w-28' },
      cell: ({ row }) => {
        const status = row.original.status
        const Icon = ORDER_STATUS_ICON[status]
        const label = ORDER_STATUS_MAP[status]
        if (label == null)
          return <span className='text-muted-foreground'>-</span>
        return (
          <div className='flex items-center gap-2'>
            {Icon && (
              <Icon className={cn('h-4 w-4', ORDER_STATUS_COLOR[status])} />
            )}
            <span className='text-sm font-medium'>{label}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'commission_balance',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='佣金金额' />
      ),
      meta: { className: 'w-28' },
      cell: ({ row }) => {
        const v = row.original.commission_balance
        const n = v ? (v / 100).toFixed(2) : '-'
        return (
          <div className='text-foreground/90 flex items-center font-mono'>
            {v ? `¥${n}` : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'commission_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='佣金状态' />
      ),
      meta: { className: 'w-28' },
      cell: ({ row }) => {
        const status = row.original.commission_status
        const balance = row.original.commission_balance
        if (status == null || !balance)
          return <span className='text-muted-foreground'>-</span>
        const Icon = COMMISSION_STATUS_ICON[status]
        return (
          <div className='flex items-center gap-2'>
            {Icon && (
              <Icon className={cn('h-4 w-4', COMMISSION_STATUS_COLOR[status])} />
            )}
            <span className='text-sm font-medium'>
              {COMMISSION_STATUS_MAP[status] ?? status}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='创建时间' />
      ),
      meta: { className: 'w-44' },
      cell: ({ row }) => (
        <div className='text-muted-foreground text-nowrap font-mono text-sm'>
          {time(row.original.created_at)}
        </div>
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
                        className='text-destructive focus:text-destructive'
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
                      className='text-destructive focus:text-destructive'
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
      meta: { className: cn('w-16 text-end') },
    },
  ]
}
