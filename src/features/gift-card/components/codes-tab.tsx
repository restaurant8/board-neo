import { useState } from 'react'
import { format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
  GIFT_CODE_STATUS_EXPIRED,
  GIFT_CODE_STATUS_MAP,
  GIFT_CODE_STATUS_UNUSED,
  GIFT_CODE_STATUS_USED,
  deleteCode,
  fetchCodes,
  toggleCode,
} from '../api'
import { SimplePagination } from './simple-pagination'

function time(ts?: number | null) {
  if (!ts) return '-'
  return format(new Date(ts * 1000), 'yyyy/MM/dd HH:mm:ss')
}

/** 对齐原版：未使用→default，已使用→secondary，已禁用/已过期→destructive。 */
function statusVariant(status: number) {
  if (status === GIFT_CODE_STATUS_USED) return 'secondary' as const
  if (
    status === GIFT_CODE_STATUS_DISABLED ||
    status === GIFT_CODE_STATUS_EXPIRED
  )
    return 'destructive' as const
  return 'default' as const
}

export function CodesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleting, setDeleting] = useState<GiftCardCode | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['gift-codes', page, pageSize, statusFilter],
    queryFn: () =>
      fetchCodes({
        page,
        per_page: pageSize,
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
              <TableHead>模板名称</TableHead>
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
                  <TableCell>
                    <div className='flex items-center space-x-2'>
                      <Badge variant='secondary'>{c.code}</Badge>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6'
                        onClick={() => {
                          navigator.clipboard?.writeText(c.code)
                          toast.success('已复制')
                        }}
                      >
                        <Copy className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{c.template_name}</TableCell>
                  <TableCell>
                    <div className='flex items-center space-x-2'>
                      <Badge variant={statusVariant(c.status)}>
                        {c.status_name ?? GIFT_CODE_STATUS_MAP[c.status]}
                      </Badge>
                      {(c.status === GIFT_CODE_STATUS_UNUSED ||
                        c.status === GIFT_CODE_STATUS_DISABLED) && (
                        <Switch
                          checked={c.status !== GIFT_CODE_STATUS_DISABLED}
                          onCheckedChange={(v) =>
                            toggleMutation.mutate({
                              id: c.id,
                              action: v ? 'enable' : 'disable',
                            })
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='text-xs'>
                    {c.user_email ?? '-'}
                  </TableCell>
                  <TableCell className='text-end'>
                    {c.usage_count}/{c.max_usage}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>
                    {time(c.expires_at)}
                  </TableCell>
                  <TableCell className='text-end'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className='text-muted-foreground h-4 w-4 hover:text-red-600 dark:hover:text-red-400' />
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

      <SimplePagination
        page={page}
        totalPages={lastPage}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
      />

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
