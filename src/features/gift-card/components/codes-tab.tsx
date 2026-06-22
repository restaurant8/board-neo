import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  type GiftCardCode,
  GIFT_CODE_STATUS_DISABLED,
  GIFT_CODE_STATUS_MAP,
  GIFT_CODE_STATUS_USED,
  deleteCode,
  fetchCodes,
  toggleCode,
} from '../api'

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function statusVariant(status: number) {
  if (status === GIFT_CODE_STATUS_USED) return 'default' as const
  if (status === GIFT_CODE_STATUS_DISABLED) return 'destructive' as const
  return 'secondary' as const
}

export function CodesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleting, setDeleting] = useState<GiftCardCode | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['gift-codes', page, statusFilter],
    queryFn: () =>
      fetchCodes({
        page,
        per_page: 15,
        status: statusFilter === 'all' ? undefined : Number(statusFilter),
      }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'enable' | 'disable' }) =>
      toggleCode(id, action),
    onSuccess: (res) => {
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['gift-codes'] })
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => deleteCode(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['gift-codes'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const rows = data?.data ?? []
  const lastPage = data?.last_page ?? 1

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex justify-end'>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='状态筛选' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>全部状态</SelectItem>
            {Object.entries(GIFT_CODE_STATUS_MAP).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>兑换码</TableHead>
              <TableHead>模板</TableHead>
              <TableHead className='w-20'>状态</TableHead>
              <TableHead>使用者</TableHead>
              <TableHead className='w-24 text-end'>次数</TableHead>
              <TableHead className='w-40'>过期时间</TableHead>
              <TableHead className='w-32 text-end'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className='font-mono text-xs'>{c.code}</TableCell>
                  <TableCell>{c.template_name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>
                      {c.status_name ?? GIFT_CODE_STATUS_MAP[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-xs'>
                    {c.user_email ?? '-'}
                  </TableCell>
                  <TableCell className='text-end'>
                    {c.usage_count}/{c.max_usage}
                  </TableCell>
                  <TableCell className='text-xs'>{time(c.expires_at)}</TableCell>
                  <TableCell className='text-end'>
                    {c.status === GIFT_CODE_STATUS_DISABLED ? (
                      <Button
                        variant='ghost'
                        size='icon'
                        title='启用'
                        onClick={() =>
                          toggleMutation.mutate({
                            id: c.id,
                            action: 'enable',
                          })
                        }
                      >
                        <CheckCircle2 className='size-4 text-green-600' />
                      </Button>
                    ) : (
                      <Button
                        variant='ghost'
                        size='icon'
                        title='禁用'
                        onClick={() =>
                          toggleMutation.mutate({
                            id: c.id,
                            action: 'disable',
                          })
                        }
                      >
                        <Ban className='size-4' />
                      </Button>
                    )}
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className='size-4 text-destructive' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  暂无兑换码
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between'>
        <span className='text-muted-foreground text-sm'>
          共 {data?.total ?? 0} 条，第 {page} / {lastPage} 页
        </span>
        <div className='flex gap-2'>
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
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除兑换码'
        desc={`确定删除兑换码「${deleting?.code}」吗？已使用或有记录的无法删除。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </div>
  )
}
