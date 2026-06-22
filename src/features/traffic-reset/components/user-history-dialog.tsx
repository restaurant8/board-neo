import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchUserHistory } from '../api'

type Props = {
  userId: number | null
  onOpenChange: (open: boolean) => void
}

export function UserHistoryDialog({ userId, onOpenChange }: Props) {
  const open = userId != null
  const { data, isLoading } = useQuery({
    queryKey: ['traffic-reset-user-history', userId],
    queryFn: () => fetchUserHistory(userId!, 50),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>用户重置历史</DialogTitle>
          <DialogDescription>
            {data?.user
              ? `${data.user.email} · 累计重置 ${data.user.reset_count ?? 0} 次`
              : '查询该用户的流量重置历史。'}
          </DialogDescription>
        </DialogHeader>

        {data?.user ? (
          <div className='grid grid-cols-2 gap-2 text-sm sm:grid-cols-3'>
            <div>
              <span className='text-muted-foreground'>上次重置：</span>
              {data.user.last_reset_at ?? '—'}
            </div>
            <div>
              <span className='text-muted-foreground'>下次重置：</span>
              {data.user.next_reset_at ?? '—'}
            </div>
          </div>
        ) : null}

        <div className='max-h-[50vh] overflow-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>重置前流量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-16 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : data && data.history.length > 0 ? (
                data.history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className='whitespace-nowrap text-xs'>
                      {h.reset_time}
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary'>{h.reset_type_name}</Badge>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {h.trigger_source_name}
                    </TableCell>
                    <TableCell className='text-xs'>
                      {h.old_traffic.formatted}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='h-16 text-center text-muted-foreground'
                  >
                    暂无历史记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
