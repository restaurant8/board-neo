import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Ban,
  ChevronsUpDown,
  Globe,
  type LucideIcon,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleServerError } from '@/lib/handle-server-error'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type RouteAction,
  type ServerRoute,
  dropServerRoute,
  fetchServerRoutes,
} from './api'
import { RouteMutateDialog } from './components/route-mutate-dialog'

const ACTION_LABEL: Record<RouteAction, string> = {
  block: '阻断',
  direct: '直连',
  dns: 'DNS',
  proxy: '代理',
}

type ActionStyle = {
  icon: LucideIcon
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
}

/** 动作徽章样式（对齐原版：阻断红 / DNS蓝 / 直连绿 / 代理紫）。 */
const ACTION_STYLE: Record<RouteAction, ActionStyle> = {
  block: {
    icon: Ban,
    variant: 'destructive',
    className:
      'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800',
  },
  dns: {
    icon: Globe,
    variant: 'secondary',
    className:
      'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-400 dark:hover:bg-blue-800',
  },
  direct: {
    icon: Network,
    variant: 'secondary',
    className:
      'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-400 dark:hover:bg-green-800',
  },
  proxy: {
    icon: ArrowRightLeft,
    variant: 'default',
    className:
      'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-400 dark:hover:bg-purple-800',
  },
}

/** 动作值列主文案（对齐原版 columns.action_value）。 */
function actionValueText(r: ServerRoute): {
  text: string
  destructive?: boolean
} {
  if (r.action === 'dns' && r.action_value) {
    return { text: `DNS: ${r.action_value}` }
  }
  if (r.action === 'proxy' && r.action_value) {
    return { text: `转发 (${r.action_value})` }
  }
  if (r.action === 'block') {
    return { text: '阻止访问', destructive: true }
  }
  return { text: '直连' }
}

type SortDir = 'asc' | 'desc'

export function ServerRoutePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<ServerRoute | null>(null)
  const [deleting, setDeleting] = useState<ServerRoute | null>(null)
  const [selected, setSelected] = useState<number[]>([])

  const [keyword, setKeyword] = useState('')
  const [idSort, setIdSort] = useState<SortDir | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data, isLoading } = useQuery({
    queryKey: ['server-routes'],
    queryFn: fetchServerRoutes,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropServerRoute(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['server-routes'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const routes = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return routes
    return routes.filter(
      (r) =>
        (r.remarks ?? '').toLowerCase().includes(kw) ||
        String(r.id).includes(kw) ||
        (r.match ?? []).some((m) => m.toLowerCase().includes(kw))
    )
  }, [routes, keyword])

  const sorted = useMemo(() => {
    if (!idSort) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => (idSort === 'asc' ? a.id - b.id : b.id - a.id))
    return arr
  }, [filtered, idSort])

  const total = sorted.length
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  )

  const allSelected =
    paged.length > 0 && paged.every((r) => selected.includes(r.id))
  const toggleSelectAll = (checked: boolean) =>
    setSelected(checked ? paged.map((r) => r.id) : [])
  const toggleSelect = (id: number, checked: boolean) =>
    setSelected((s) => (checked ? [...s, id] : s.filter((x) => x !== id)))

  const cycleIdSort = () =>
    setIdSort((s) => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>路由规则</h2>
            <p className='text-muted-foreground'>
              配置节点流量的匹配与处理动作（阻断/直连/DNS/代理）。
            </p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 新建规则
          </Button>
        </div>

        {/* ----------------------------- 工具栏 ----------------------------- */}
        <div className='flex flex-wrap items-center gap-2'>
          <div className='relative w-full max-w-xs'>
            <Search className='text-muted-foreground absolute start-2 top-1/2 size-4 -translate-y-1/2' />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder='搜索路由...'
              className='h-8 ps-8'
            />
          </div>
          {keyword && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setKeyword('')
                setPage(1)
              }}
            >
              重置 <X className='size-4' />
            </Button>
          )}
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-10'>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => toggleSelectAll(!!c)}
                    aria-label='全选'
                  />
                </TableHead>
                <TableHead className='w-20'>
                  <button
                    type='button'
                    className='hover:text-foreground -ms-1 inline-flex items-center gap-1 rounded px-1'
                    onClick={cycleIdSort}
                  >
                    ID
                    {idSort === 'asc' ? (
                      <ArrowUp className='size-3.5' />
                    ) : idSort === 'desc' ? (
                      <ArrowDown className='size-3.5' />
                    ) : (
                      <ChevronsUpDown className='size-3.5 opacity-50' />
                    )}
                  </button>
                </TableHead>
                <TableHead>备注</TableHead>
                <TableHead>匹配规则</TableHead>
                <TableHead className='w-28'>动作</TableHead>
                <TableHead className='w-64'>动作值</TableHead>
                <TableHead className='w-28 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : paged.length > 0 ? (
                paged.map((r) => {
                  const style = ACTION_STYLE[r.action]
                  const Icon = style?.icon
                  const matchCount = r.match?.length ?? 0
                  const av = actionValueText(r)
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(r.id)}
                          onCheckedChange={(c) => toggleSelect(r.id, !!c)}
                          aria-label={`选择 ${r.remarks}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{r.id}</Badge>
                      </TableCell>
                      <TableCell className='max-w-72 truncate font-medium'>
                        {r.remarks}
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-wrap gap-1'>
                          {(r.match ?? []).slice(0, 6).map((m, i) => (
                            <Badge
                              key={`${m}-${i}`}
                              variant='secondary'
                              className='font-mono'
                            >
                              {m}
                            </Badge>
                          ))}
                          {matchCount > 6 && (
                            <Badge variant='outline'>+{matchCount - 6}</Badge>
                          )}
                          {matchCount === 0 && (
                            <span className='text-muted-foreground'>-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={style?.variant ?? 'default'}
                          className={cn(
                            'flex w-fit items-center gap-1.5 px-3 py-1 capitalize',
                            style?.className
                          )}
                        >
                          {Icon && <Icon className='size-3.5' />}
                          {ACTION_LABEL[r.action] ?? r.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col space-y-1'>
                          <span
                            className={cn(
                              'text-sm font-medium',
                              av.destructive && 'text-destructive'
                            )}
                          >
                            {av.text}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            匹配{matchCount}条规则
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className='text-end'>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            setCurrent(r)
                            setMutateOpen(true)
                          }}
                        >
                          <Pencil className='size-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 className='text-destructive size-4' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className='h-24 text-center'>
                    暂无路由规则
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <SimplePagination
          page={safePage}
          totalPages={maxPage}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          left={
            <>
              已选择 {selected.length} 项，共 {total} 项
            </>
          }
        />
      </Main>

      <RouteMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除路由规则'
        desc={`确定删除路由规则「${deleting?.remarks}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
