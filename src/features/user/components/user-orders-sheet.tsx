import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ORDER_STATUS_MAP,
  ASSIGN_PERIOD_MAP,
  fetchUserOrders,
  type User,
} from '../api'
import { formatMoney, formatTimestamp } from '../format'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function UserOrdersSheet({ open, onOpenChange, user }: Props) {
  const { data, isFetching, isError } = useQuery({
    queryKey: ['user-orders', user?.id],
    queryFn: () => fetchUserOrders(user!.id, 1, 100),
    enabled: open && !!user,
  })

  const rows = data?.data ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='flex w-full flex-col gap-3 p-4 sm:max-w-2xl'
      >
        <SheetHeader className='p-0'>
          <SheetTitle>TA的订单</SheetTitle>
          <SheetDescription>{user?.email} 的全部订单</SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto rounded-md border'>
          <Table>
            <TableHeader className='sticky top-0 bg-background'>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='h-24 text-center text-muted-foreground'
                  >
                    暂无法获取订单
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className='font-mono text-xs'>
                      {o.trade_no}
                    </TableCell>
                    <TableCell>
                      {o.plan?.name ?? (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {o.period ? ASSIGN_PERIOD_MAP[o.period] ?? o.period : '—'}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {formatMoney(o.total_amount / 100)}
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary'>
                        {ORDER_STATUS_MAP[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-sm text-muted-foreground'>
                      {formatTimestamp(o.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    暂无订单
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='text-sm text-muted-foreground'>
          共 {data?.total ?? rows.length} 笔
        </div>
      </SheetContent>
    </Sheet>
  )
}
