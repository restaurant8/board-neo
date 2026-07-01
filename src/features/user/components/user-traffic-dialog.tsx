import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, RotateCw } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  fetchUserTraffic,
  fetchUserTrafficAudit,
  type User,
} from '../api'
import { formatBytes, formatTimestamp } from '../format'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

const PAGE_SIZES = [10, 20, 50, 100]

/** 秒级时间戳 → datetime-local 输入值（本地时区）。 */
function tsToLocalInput(ts: number): string {
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}
function localInputToTs(v: string): number | undefined {
  if (!v) return undefined
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? undefined : Math.floor(t / 1000)
}

export function UserTrafficDialog({ open, onOpenChange, user }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[85vh] max-h-[85vh] w-[95vw] max-w-4xl flex-col gap-3 sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>流量使用记录</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue='records' className='flex min-h-0 flex-1 flex-col'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='records'>用量记录</TabsTrigger>
            <TabsTrigger value='audit'>流量审计</TabsTrigger>
          </TabsList>

          <TabsContent
            value='records'
            className='mt-3 flex min-h-0 flex-1 flex-col'
          >
            <RecordsTab open={open} user={user} />
          </TabsContent>
          <TabsContent
            value='audit'
            className='mt-3 flex min-h-0 flex-1 flex-col'
          >
            <AuditTab open={open} user={user} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- 用量记录 ------------------------------- */

function RecordsTab({ open, user }: { open: boolean; user: User | null }) {
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
    <>
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
    </>
  )
}

/* ------------------------------- 流量审计 ------------------------------- */

function AuditTab({ open, user }: { open: boolean; user: User | null }) {
  const defaults = useMemo(() => {
    const end = Math.floor(Date.now() / 1000)
    const start = end - 7 * 24 * 3600
    return { start, end }
  }, [])

  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [destination, setDestination] = useState('')
  const [orderBy, setOrderBy] = useState<'total' | 'u' | 'd'>('total')
  const [page, setPage] = useState(1)
  const [applied, setApplied] = useState({
    start: defaults.start,
    end: defaults.end,
    destination: '',
  })

  useEffect(() => {
    if (open) {
      setStartInput(tsToLocalInput(defaults.start))
      setEndInput(tsToLocalInput(defaults.end))
      setDestination('')
      setOrderBy('total')
      setPage(1)
      setApplied({ start: defaults.start, end: defaults.end, destination: '' })
    }
  }, [open, user?.id, defaults])

  const pageSize = 20
  const { data, isFetching } = useQuery({
    queryKey: ['user-traffic-audit', user?.id, applied, orderBy, page],
    queryFn: () =>
      fetchUserTrafficAudit({
        user_id: user!.id,
        start_time: applied.start,
        end_time: applied.end,
        destination: applied.destination || undefined,
        order_by: orderBy,
        order_dir: 'desc',
        page,
        page_size: pageSize,
      }),
    enabled: open && !!user,
  })

  const list = data?.data?.list ?? []
  const total = data?.data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  const refresh = () => {
    setApplied({
      start: localInputToTs(startInput) ?? defaults.start,
      end: localInputToTs(endInput) ?? defaults.end,
      destination: destination.trim(),
    })
    setPage(1)
  }

  return (
    <>
      <div className='flex flex-wrap items-end gap-2 pb-2'>
        <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
          开始时间
          <Input
            type='datetime-local'
            className='h-8 w-[200px]'
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
          />
        </label>
        <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
          结束时间
          <Input
            type='datetime-local'
            className='h-8 w-[200px]'
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
          />
        </label>
        <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
          目标
          <Input
            className='h-8 w-[200px]'
            placeholder='输入目标域名或 IP'
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refresh()}
          />
        </label>
        <label className='flex flex-col gap-1 text-xs text-muted-foreground'>
          排序方式
          <Select
            value={orderBy}
            onValueChange={(v) => {
              setOrderBy(v as 'total' | 'u' | 'd')
              setPage(1)
            }}
          >
            <SelectTrigger className='h-8 w-[110px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='total'>总计</SelectItem>
              <SelectItem value='u'>上行</SelectItem>
              <SelectItem value='d'>下行</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button variant='outline' size='sm' className='h-8' onClick={refresh}>
          <RotateCw className='size-4' /> 刷新
        </Button>
      </div>

      <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
        <Table>
          <TableHeader className='sticky top-0 bg-background'>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>节点</TableHead>
              <TableHead>来源 IP</TableHead>
              <TableHead>主域名</TableHead>
              <TableHead>目标</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : list.length > 0 ? (
              list.map((r, i) => (
                <TableRow key={`${r.server_id}-${r.destination}-${i}`}>
                  <TableCell className='whitespace-nowrap text-muted-foreground'>
                    {formatTimestamp(r.last_record_at)}
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {r.server_name}
                  </TableCell>
                  <TableCell className='whitespace-nowrap font-mono text-xs'>
                    {r.source_ip || '—'}
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {r.main_domain || '—'}
                  </TableCell>
                  <TableCell className='whitespace-nowrap font-mono text-xs'>
                    {r.destination || r.destination_ip || '—'}
                    {r.destination_port ? `:${r.destination_port}` : ''}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='h-24 text-center text-muted-foreground'
                >
                  暂无用户审计数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-end gap-2 pt-2 text-sm text-muted-foreground'>
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
    </>
  )
}
