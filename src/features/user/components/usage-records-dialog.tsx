import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
  type UsageOrderBy,
  type UsageOrderDir,
  type UsageRecordType,
  clearUsageRecords,
  fetchUsageRecords,
} from '../api'
import { formatTimestamp } from '../format'

const PAGE_SIZE = 50

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 行内入口预填的关键词（用户邮箱或 ID）。 */
  prefillKeyword?: string
}

export function UsageRecordsDialog({
  open,
  onOpenChange,
  prefillKeyword,
}: Props) {
  const queryClient = useQueryClient()

  // 表单输入（待提交）
  const [keywordInput, setKeywordInput] = useState('')
  const [ipInput, setIpInput] = useState('')
  const [typeInput, setTypeInput] = useState<UsageRecordType | ''>('')

  // 已应用的查询条件
  const [applied, setApplied] = useState<{
    keyword: string
    ip: string
    type: UsageRecordType | ''
  }>({ keyword: '', ip: '', type: '' })

  const [page, setPage] = useState(1)
  const [orderBy, setOrderBy] = useState<UsageOrderBy>('record_at')
  const [orderDir, setOrderDir] = useState<UsageOrderDir>('desc')
  const [confirmClear, setConfirmClear] = useState(false)

  // 打开时重置并应用预填
  useEffect(() => {
    if (open) {
      const kw = prefillKeyword ?? ''
      setKeywordInput(kw)
      setIpInput('')
      setTypeInput('')
      setApplied({ keyword: kw, ip: '', type: '' })
      setPage(1)
      setOrderBy('record_at')
      setOrderDir('desc')
    }
  }, [open, prefillKeyword])

  const queryParams = {
    keyword: applied.keyword || undefined,
    ip: applied.ip || undefined,
    type: applied.type || undefined,
    order_by: orderBy,
    order_dir: orderDir,
    page,
    page_size: PAGE_SIZE,
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['usage-records', queryParams],
    queryFn: () => fetchUsageRecords(queryParams),
    enabled: open,
  })

  const hasFilter = !!(applied.keyword || applied.ip || applied.type)
  const total = data?.total ?? 0
  const rows = data?.data ?? []
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const applyFilters = () => {
    setApplied({ keyword: keywordInput.trim(), ip: ipInput.trim(), type: typeInput })
    setPage(1)
  }

  const resetFilters = () => {
    setKeywordInput('')
    setIpInput('')
    setTypeInput('')
    setApplied({ keyword: '', ip: '', type: '' })
    setPage(1)
  }

  const toggleSort = (key: UsageOrderBy) => {
    if (orderBy === key) {
      setOrderDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrderBy(key)
      setOrderDir('desc')
    }
    setPage(1)
  }

  const clearMutation = useMutation({
    mutationFn: () =>
      clearUsageRecords({
        keyword: applied.keyword || undefined,
        ip: applied.ip || undefined,
        type: applied.type || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`已清除 ${res.deleted} 条记录`)
      setConfirmClear(false)
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['usage-records'] })
    },
    onError: handleServerError,
  })

  const sortIcon = (key: UsageOrderBy) => {
    if (orderBy !== key) return null
    return orderDir === 'asc' ? (
      <ArrowUp className='ms-1 inline size-3' />
    ) : (
      <ArrowDown className='ms-1 inline size-3' />
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='flex h-[85vh] max-w-5xl flex-col gap-3'>
          <DialogHeader>
            <DialogTitle>使用记录</DialogTitle>
            <DialogDescription>
              用户连接 / 订阅过的真实 IP、归属地与 User-Agent。
            </DialogDescription>
          </DialogHeader>

          {/* 筛选条 */}
          <div className='flex flex-wrap items-center gap-2'>
            {hasFilter && (
              <Button variant='outline' size='sm' onClick={resetFilters}>
                <ArrowLeft className='size-4' /> 返回全部
              </Button>
            )}
            <Input
              className='h-8 w-44'
              placeholder='用户邮箱 / ID'
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
            <Input
              className='h-8 w-40'
              placeholder='IP（可模糊）'
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
            <Select
              value={typeInput || 'all'}
              onValueChange={(v) =>
                setTypeInput(v === 'all' ? '' : (v as UsageRecordType))
              }
            >
              <SelectTrigger className='h-8 w-32'>
                <SelectValue placeholder='全部类型' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部类型</SelectItem>
                <SelectItem value='connect'>连接</SelectItem>
                <SelectItem value='subscribe'>订阅</SelectItem>
              </SelectContent>
            </Select>
            <Button size='sm' onClick={applyFilters}>
              查询
            </Button>
            <Button variant='outline' size='sm' onClick={() => refetch()}>
              <RefreshCw className='size-4' /> 刷新
            </Button>
            <div className='ms-auto'>
              <Button
                variant='outline'
                size='sm'
                className='text-destructive'
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className='size-4' /> 一键清除
              </Button>
            </div>
          </div>

          {/* 表格 */}
          <div className='flex-1 overflow-auto rounded-md border'>
            <Table>
              <TableHeader className='sticky top-0 bg-background'>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead
                    className='cursor-pointer select-none'
                    onClick={() => toggleSort('online')}
                  >
                    在线IP{sortIcon('online')}
                  </TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>归属地</TableHead>
                  <TableHead>节点</TableHead>
                  <TableHead>User-Agent</TableHead>
                  <TableHead
                    className='cursor-pointer select-none'
                    onClick={() => toggleSort('count')}
                  >
                    次数{sortIcon('count')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer select-none'
                    onClick={() => toggleSort('record_at')}
                  >
                    时间{sortIcon('record_at')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={9} className='h-24 text-center'>
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>{r.user_email || `#${r.user_id}`}</div>
                        <div className='text-xs text-muted-foreground'>
                          ID {r.user_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            r.online_ip_count > 0
                              ? 'font-semibold text-emerald-600'
                              : 'text-muted-foreground'
                          }
                        >
                          {r.online_ip_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        {r.type === 'subscribe' ? (
                          <Badge variant='secondary' className='text-blue-600'>
                            订阅
                          </Badge>
                        ) : (
                          <Badge variant='secondary' className='text-emerald-600'>
                            连接
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>{r.ip}</TableCell>
                      <TableCell>
                        {r.location || (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {r.server_name || '—'}
                      </TableCell>
                      <TableCell
                        className='max-w-[220px] truncate text-xs text-muted-foreground'
                        title={r.ua ?? ''}
                      >
                        {r.ua || '—'}
                      </TableCell>
                      <TableCell>{r.count || 1}</TableCell>
                      <TableCell className='whitespace-nowrap'>
                        <div>{formatTimestamp(r.record_at)}</div>
                        <div className='text-xs text-muted-foreground'>
                          首次 {formatTimestamp(r.first_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className='h-24 text-center'>
                      暂无记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页页脚 */}
          <div className='flex items-center gap-3 text-sm'>
            <span className='text-muted-foreground'>共 {total} 条</span>
            <div className='ms-auto flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span>
                {page} / {maxPage}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= maxPage}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title='清除使用记录'
        desc={
          hasFilter
            ? '确认清除【当前筛选条件】下的所有使用记录？此操作不可恢复。'
            : '确认清除【全部】使用记录？此操作不可恢复！'
        }
        confirmText='清除'
        destructive
        isLoading={clearMutation.isPending}
        handleConfirm={() => clearMutation.mutate()}
      />
    </>
  )
}
