import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchUsages } from '../api'

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function brief(obj: Record<string, unknown> | null) {
  if (!obj) return '-'
  try {
    return JSON.stringify(obj)
  } catch {
    return '-'
  }
}

export function UsagesTab() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['gift-usages', page],
    queryFn: () => fetchUsages({ page, per_page: 15 }),
  })

  const rows = data?.data ?? []
  const lastPage = data?.last_page ?? 1

  return (
    <div className='flex flex-col gap-4'>
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>兑换码</TableHead>
              <TableHead>模板</TableHead>
              <TableHead>使用者</TableHead>
              <TableHead>邀请人</TableHead>
              <TableHead>发放奖励</TableHead>
              <TableHead className='w-40'>使用时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className='font-mono text-xs'>{u.code}</TableCell>
                  <TableCell>{u.template_name}</TableCell>
                  <TableCell className='text-xs'>{u.user_email}</TableCell>
                  <TableCell className='text-xs'>
                    {u.invite_user_email ?? '-'}
                  </TableCell>
                  <TableCell className='max-w-xs truncate text-xs'>
                    {brief(u.rewards_given)}
                  </TableCell>
                  <TableCell className='text-xs'>{time(u.created_at)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center'>
                  暂无使用记录
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
    </div>
  )
}
