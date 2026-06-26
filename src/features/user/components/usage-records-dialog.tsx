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
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import { formatTimestamp } from '../format'

const DEFAULT_PAGE_SIZE = 50

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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
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
      setPageSize(DEFAULT_PAGE_SIZE)
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
    page_size: pageSize,
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['usage-records', queryParams],
    queryFn: () => fetchUsageRecords(queryParams),
    enabled: open,
  })

  const hasFilter = !!(applied.keyword || applied.ip || applied.type)
  const total = data?.total ?? 0
  const rows = data?.data ?? []
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

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
        <DialogContent className='flex h-[85vh] max-h-[85vh] w-[95vw] max-w-6xl flex-col gap-3 sm:max-w-6xl'>
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
          <div className='flex-1 overflow-y-auto overflow-x-auto rounded-md border'>
            <Table className='min-w-[960px] table-fixed'>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead className='w-[180px]'>用户</TableHead>
                  <TableHead
                    className='w-[72px] cursor-pointer select-none whitespace-nowrap'
                    onClick={() => toggleSort('online')}
                  >
                    在线IP{sortIcon('online')}
                  </TableHead>
                  <TableHead className='w-[72px]'>类型</TableHead>
                  <TableHead className='w-[130px]'>IP</TableHead>
                  <TableHead className='w-[120px]'>归属地</TableHead>
                  <TableHead className='w-[110px]'>节点</TableHead>
                  <TableHead>User-Agent</TableHead>
                  <TableHead
                    className='w-[64px] cursor-pointer select-none whitespace-nowrap'
                    onClick={() => toggleSort('count')}
                  >
                    次数{sortIcon('count')}
                  </TableHead>
                  <TableHead
                    className='w-[170px] cursor-pointer select-none whitespace-nowrap'
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
                      <TableCell className='align-top'>
                        <div
                          className='truncate'
                          title={r.user_email || `#${r.user_id}`}
                        >
                          {r.user_email || `#${r.user_id}`}
                        </div>
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
                      <TableCell
                        className='truncate font-mono text-xs'
                        title={r.ip}
                      >
                        {r.ip}
                      </TableCell>
                      <TableCell className='truncate' title={r.location || ''}>
                        {r.location || (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className='truncate text-sm text-muted-foreground'
                        title={r.server_name || ''}
                      >
                        {r.server_name || '—'}
                      </TableCell>
                      <TableCell
                        className='truncate text-xs text-muted-foreground'
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
          <SimplePagination
            page={page}
            totalPages={maxPage}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
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
