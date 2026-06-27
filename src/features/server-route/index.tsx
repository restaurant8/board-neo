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
  block: '禁止访问',
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
      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800',
  },
  dns: {
    icon: Globe,
    variant: 'secondary',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800',
  },
  direct: {
    icon: Network,
    variant: 'secondary',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800',
  },
  proxy: {
    icon: ArrowRightLeft,
    variant: 'default',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800',
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
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>路由管理</h2>
            <p className='mt-2 text-muted-foreground'>
              管理所有路由组，包括添加、删除、编辑等操作。
            </p>
          </div>
        </div>

        {/* ----------------------------- 工具栏 ----------------------------- */}
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setCurrent(null)
                setMutateOpen(true)
              }}
            >
              <Plus className='size-4' /> 添加路由
            </Button>
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder='搜索路由...'
              className='h-8 w-full min-w-[150px] sm:w-[150px] lg:w-[250px]'
            />
            {keyword && (
              <Button
                variant='ghost'
                onClick={() => {
                  setKeyword('')
                  setPage(1)
                }}
                className='h-8 px-2 lg:px-3'
              >
                重置 <X className='ml-2 h-4 w-4' />
              </Button>
            )}
          </div>
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
                  <div className='flex items-center gap-1'>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='ghost'
                        size='default'
                        className='-ml-3 flex h-8 items-center gap-2 text-nowrap font-medium hover:bg-muted/60'
                        onClick={cycleIdSort}
                      >
                        <span>组ID</span>
                        {idSort === 'asc' ? (
                          <ArrowUp className='h-4 w-4 text-foreground/70' />
                        ) : idSort === 'desc' ? (
                          <ArrowDown className='h-4 w-4 text-foreground/70' />
                        ) : (
                          <ChevronsUpDown className='h-4 w-4 text-muted-foreground/70 transition-colors hover:text-foreground/70' />
                        )}
                      </Button>
                    </div>
                  </div>
                </TableHead>
                <TableHead className='w-24'>备注</TableHead>
                <TableHead>动作值</TableHead>
                <TableHead className='w-28'>动作</TableHead>
                <TableHead className='w-28'>
                  <div className='text-right'>操作</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
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
                        <div className='flex items-center space-x-2'>
                          <Badge variant='outline'>{r.id}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex space-x-2'>
                          <span className='max-w-32 truncate font-medium sm:max-w-72 md:max-w-[31rem]'>
                            {r.remarks}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col space-y-1'>
                          <span className='text-sm font-medium'>
                            {av.destructive ? (
                              <span className='text-destructive'>{av.text}</span>
                            ) : (
                              av.text
                            )}
                          </span>
                          <span className='text-xs text-muted-foreground'>
                            匹配{matchCount}条规则
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center space-x-2'>
                          <Badge
                            variant={style?.variant ?? 'default'}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1',
                              style?.className
                            )}
                          >
                            {Icon && <Icon className='h-3.5 w-3.5' />}
                            {ACTION_LABEL[r.action] ?? r.action}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center justify-center'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 hover:bg-muted'
                            onClick={() => {
                              setCurrent(r)
                              setMutateOpen(true)
                            }}
                          >
                            <Pencil className='h-4 w-4 text-muted-foreground hover:text-foreground' />
                            <span className='sr-only'>编辑</span>
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 className='h-4 w-4 text-muted-foreground hover:text-red-600 dark:hover:text-red-400' />
                            <span className='sr-only'>删除</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
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
