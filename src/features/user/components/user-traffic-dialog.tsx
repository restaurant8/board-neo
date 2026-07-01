import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const PAGE_SIZES = [10, 20, 50, 100]

export function UserTrafficDialog({ open, onOpenChange, user }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    if (open) {
      setPage(1)
      setPageSize(10)
    }
  }, [open, user?.id])

  const { data, isFetching } = useQuery({
    queryKey: ['user-traffic', user?.id, page, pageSize],
    queryFn: () => fetchUserTraffic(user!.id, page, pageSize),
    enabled: open && !!user,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[85vh] max-h-[85vh] w-[95vw] max-w-3xl flex-col gap-3 sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>流量使用记录</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
          <Table>
            <TableHeader className='sticky top-0 bg-background'>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>上行流量</TableHead>
                <TableHead>下行流量</TableHead>
                <TableHead>倍率</TableHead>
                <TableHead>总计</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((r) => {
                  const rate = parseFloat(String(r.server_rate)) || 1
                  return (
                    <TableRow key={r.id}>
                      <TableCell className='whitespace-nowrap text-muted-foreground'>
                        {formatTimestamp(r.record_at)}
                      </TableCell>
                      <TableCell className='whitespace-nowrap font-mono'>
                        <ArrowUp className='mr-1 inline size-3.5 text-emerald-500' />
                        {formatBytes((r.u ?? 0) / rate)}
                      </TableCell>
                      <TableCell className='whitespace-nowrap font-mono'>
                        <ArrowDown className='mr-1 inline size-3.5 text-blue-500' />
                        {formatBytes((r.d ?? 0) / rate)}
                      </TableCell>
                      <TableCell className='whitespace-nowrap font-mono'>
                        {rate}x
                      </TableCell>
                      <TableCell className='whitespace-nowrap font-mono font-medium'>
                        {formatBytes(((r.u ?? 0) + (r.d ?? 0)) / rate)}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='h-24 text-center text-muted-foreground'
                  >
                    暂无记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='flex items-center justify-between gap-3 pt-2 text-sm text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <span>每页显示</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className='h-8 w-[72px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>条记录</span>
          </div>
          <div className='flex items-center gap-2'>
            <span>
              第 {page} / {maxPage} 页
            </span>
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
              disabled={page >= maxPage}
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
