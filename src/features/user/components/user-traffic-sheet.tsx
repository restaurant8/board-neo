import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchUserTraffic, type User } from '../api'
import { formatBytes, formatTimestamp } from '../format'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function UserTrafficSheet({ open, onOpenChange, user }: Props) {
  const { data, isFetching, isError } = useQuery({
    queryKey: ['user-traffic', user?.id],
    queryFn: () => fetchUserTraffic(user!.id, 1, 100),
    enabled: open && !!user,
  })

  // getStatUser 返回非标准信封 { data, total }
  const rows = data?.data ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='flex w-full flex-col gap-3 p-4 sm:max-w-2xl'
      >
        <SheetHeader className='p-0'>
          <SheetTitle>TA的流量记录</SheetTitle>
          <SheetDescription>{user?.email} 的每日流量明细</SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto rounded-md border'>
          <Table>
            <TableHeader className='sticky top-0 bg-background'>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>上行</TableHead>
                <TableHead>下行</TableHead>
                <TableHead>合计</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='h-24 text-center text-muted-foreground'
                  >
                    暂无法获取流量记录
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='whitespace-nowrap'>
                      {formatTimestamp(r.record_at)}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {formatBytes(r.u)}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {formatBytes(r.d)}
                    </TableCell>
                    <TableCell className='whitespace-nowrap font-medium'>
                      {formatBytes((r.u ?? 0) + (r.d ?? 0))}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    暂无流量记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='text-sm text-muted-foreground'>
          共 {data?.total ?? rows.length} 条
        </div>
      </SheetContent>
    </Sheet>
  )
}
