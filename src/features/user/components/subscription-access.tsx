import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import {
  fetchSubscriptionAccess,
  fetchSubscriptionAudit,
  type AccessFilter,
  type SubscriptionTarget,
} from '../api'
import { formatTimestamp, pauseLabel } from '../format'

const filters: Record<AccessFilter, string> = {
  all: '全部',
  observed: '观察命中',
  limited: '触发限频',
  paused: '当前暂停',
  review: '待核查',
}

export function AccessOverview({
  onSelect,
}: {
  onSelect: (user: SubscriptionTarget) => void
}) {
  const [input, setInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<AccessFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const params = { keyword, filter, page, page_size: pageSize }
  const query = useQuery({
    staleTime: 0,
    queryKey: ['subscription-access', params],
    queryFn: () => fetchSubscriptionAccess(params),
  })
  return (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        <form
          className='flex gap-2'
          onSubmit={(e) => {
            e.preventDefault()
            setKeyword(input.trim())
            setPage(1)
          }}
        >
          <Input
            aria-label='用户邮箱或 ID'
            placeholder='用户邮箱 / ID'
            className='h-8 w-44'
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button size='sm'>查询</Button>
        </form>
        <select
          aria-label='访问状态筛选'
          className='h-8 rounded-md border bg-background px-2 text-sm'
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as AccessFilter)
            setPage(1)
          }}
        >
          {Object.entries(filters).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <Button size='sm' variant='outline' onClick={() => query.refetch()}>
          刷新
        </Button>
        <span className='text-sm text-muted-foreground'>
          共 {query.data?.total ?? '—'} 位用户
        </span>
      </div>
      {filter === 'review' && (
        <p className='text-xs text-muted-foreground'>
          最近一小时至少 10 次，达到前一小时的两倍，且出现至少 3 个此前 23
          小时未见的 IP 或客户端标识。
        </p>
      )}
      <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                '用户',
                '近24小时请求',
                '观察命中',
                '限频拦截',
                '当前状态 / 提醒',
                '最近请求',
                '操作',
              ].map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data?.data.map((row) => (
              <TableRow key={row.user_id}>
                <TableCell>
                  {row.user_email}
                  <div className='text-xs text-muted-foreground'>
                    ID {row.user_id}
                  </div>
                </TableCell>
                <TableCell>{row.requests}</TableCell>
                <TableCell>{row.observed}</TableCell>
                <TableCell>{row.limited}</TableCell>
                <TableCell>
                  <div>
                    {pauseLabel(row.paused_until) ||
                      (row.retry_at
                        ? `额度恢复于 ${formatTimestamp(row.retry_at)}`
                        : row.max_requests === 0
                          ? '免限频'
                          : row.max_requests != null
                            ? '用户自定义额度'
                            : '跟随全站规则')}
                  </div>
                  {pauseLabel(row.paused_until) && (
                    <div className='max-w-56 text-xs whitespace-normal'>
                      {row.pause_reason}
                    </div>
                  )}
                  {Number(row.needs_review) > 0 && (
                    <div className='mt-1'>
                      <Badge variant='outline'>待核查</Badge>
                      <div className='text-xs text-muted-foreground'>
                        本小时 {row.hour_count} 次，前一小时{' '}
                        {row.previous_count} 次 · {row.new_ips} 个新 IP /{' '}
                        {row.new_clients} 个新客户端标识
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>{formatTimestamp(row.last_at)}</TableCell>
                <TableCell>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onSelect(row)}
                  >
                    查看用户
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!query.data?.data.length && (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  {query.isError
                    ? '读取访问概览失败，可点击刷新重试'
                    : query.isPending
                      ? '加载中…'
                      : '没有匹配的用户'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <SimplePagination
        page={page}
        totalPages={Math.max(1, Math.ceil((query.data?.total ?? 0) / pageSize))}
        total={query.data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n)
          setPage(1)
        }}
      />
    </>
  )
}

const actions = {
  global: '全站规则',
  override: '用户例外',
  inherit: '恢复全站规则',
  pause: '暂停订阅',
  resume: '恢复订阅',
  rotate: '更换订阅链接',
  clear: '清理访问记录',
}
export function AccessAudit({ userId }: { userId?: number }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    staleTime: 0,
    queryKey: ['subscription-audit', userId, page],
    queryFn: () => fetchSubscriptionAudit(page, userId),
  })
  return (
    <>
      <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {['操作时间', '管理员', '范围', '操作', '详情'].map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data?.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatTimestamp(row.record_at)}</TableCell>
                <TableCell>{row.admin_email}</TableCell>
                <TableCell>
                  {row.user_id ? `用户 #${row.user_id}` : '全站'}
                </TableCell>
                <TableCell>{actions[row.action] ?? row.action}</TableCell>
                <TableCell className='max-w-72 break-words whitespace-normal'>
                  {row.description}
                  {row.action === 'pause' && (
                    <div>
                      {row.paused_until
                        ? `截至 ${formatTimestamp(row.paused_until)}`
                        : '至手动恢复'}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!query.data?.data.length && (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  {query.isError
                    ? '操作记录加载失败'
                    : query.isPending
                      ? '加载中…'
                      : '暂无管理操作'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-end gap-3 text-sm'>
        <Button
          variant='outline'
          size='sm'
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          上一页
        </Button>
        第 {page} / {Math.max(1, Math.ceil((query.data?.total ?? 0) / 25))} 页
        <Button
          variant='outline'
          size='sm'
          disabled={page * 25 >= (query.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          下一页
        </Button>
      </div>
    </>
  )
}
