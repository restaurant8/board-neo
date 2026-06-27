import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Plus,
  Server as ServerIcon,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { type ServerGroup, dropServerGroup, fetchServerGroups } from './api'
import { GroupMutateDialog } from './components/group-mutate-dialog'

type SortKey = 'id' | 'name' | 'users_count' | 'server_count'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50, 100, 500]

/** 原版「用户数量」列使用的双人内联 SVG 图标（非 lucide Users）。 */
function UsersGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className='inline-block'
      viewBox='0 0 24 24'
      width='1.2em'
      height='1.2em'
      {...props}
    >
      <path
        fill='currentColor'
        d='M15.71 12.71a6 6 0 1 0-7.42 0a10 10 0 0 0-6.22 8.18a1 1 0 0 0 2 .22a8 8 0 0 1 15.9 0a1 1 0 0 0 1 .89h.11a1 1 0 0 0 .88-1.1a10 10 0 0 0-6.25-8.19M12 12a4 4 0 1 1 4-4a4 4 0 0 1-4 4'
      />
    </svg>
  )
}

export function ServerGroupPage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<ServerGroup | null>(null)
  const [deleting, setDeleting] = useState<ServerGroup | null>(null)

  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data, isLoading } = useQuery({
    queryKey: ['server-groups'],
    queryFn: fetchServerGroups,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropServerGroup(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['server-groups'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const groups = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return groups
    return groups.filter((g) => g.name.toLowerCase().includes(kw))
  }, [groups, keyword])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      let av: number | string
      let bv: number | string
      if (sort.key === 'name') {
        av = a.name
        bv = b.name
      } else if (sort.key === 'users_count') {
        av = a.users_count ?? 0
        bv = b.users_count ?? 0
      } else if (sort.key === 'server_count') {
        av = a.server_count ?? 0
        bv = b.server_count ?? 0
      } else {
        av = a.id
        bv = b.id
      }
      const cmp =
        typeof av === 'string'
          ? (av as string).localeCompare(bv as string)
          : (av as number) - (bv as number)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sort])

  const total = sorted.length
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, maxPage)
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  )

  // 分页页码跳转输入框（与原版一致：可输入并回车/失焦跳转）。
  // 用「render 期间对齐」替代 effect，避免级联渲染；当前页变化时同步显示值。
  const [pageInput, setPageInput] = useState(String(safePage))
  const [pageInputSyncedTo, setPageInputSyncedTo] = useState(safePage)
  if (pageInputSyncedTo !== safePage) {
    setPageInputSyncedTo(safePage)
    setPageInput(String(safePage))
  }
  const commitPageInput = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= 1 && n <= maxPage) {
      setPage(n)
    } else {
      setPageInput(String(safePage))
    }
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s?.key === key
        ? s.dir === 'asc'
          ? { key, dir: 'desc' }
          : null
        : { key, dir: 'asc' }
    )

  const sortIcon = (key: SortKey) =>
    sort?.key === key ? (
      sort.dir === 'asc' ? (
        <ArrowUp className='h-4 w-4 text-foreground/70' />
      ) : (
        <ArrowDown className='h-4 w-4 text-foreground/70' />
      )
    ) : (
      <ChevronsUpDown className='h-4 w-4 text-muted-foreground/70 transition-colors hover:text-foreground/70' />
    )

  // 原版 DataTableColumnHeader：可排序列头按钮。
  const renderSortHeader = (sortKey: SortKey, title: string) => (
    <div className='flex items-center gap-1'>
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='default'
          className='-ml-3 flex h-8 items-center gap-2 text-nowrap font-medium hover:bg-muted/60'
          onClick={() => toggleSort(sortKey)}
        >
          <span>{title}</span>
          {sortIcon(sortKey)}
        </Button>
      </div>
    </div>
  )

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
            <h2 className='text-2xl font-bold tracking-tight'>权限组管理</h2>
            <p className='mt-2 text-muted-foreground'>
              管理所有权限组，包括添加、删除、编辑等操作。
            </p>
          </div>
        </div>

        <div className='space-y-4'>
          {/* ----------------------------- 工具栏 ----------------------------- */}
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex flex-1 flex-wrap items-center gap-2 sm:flex-nowrap'>
              <Button
                variant='outline'
                size='sm'
                className='space-x-2'
                onClick={() => {
                  setCurrent(null)
                  setMutateOpen(true)
                }}
              >
                <Plus className='size-4' />
                <span>添加权限组</span>
              </Button>
              <Input
                placeholder='搜索权限组...'
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                className={cn(
                  'h-8 w-full min-w-[150px] sm:w-[150px] lg:w-[250px]',
                  keyword && 'border-primary/50 ring-primary/20'
                )}
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
                  重置
                  <X className='ml-2 h-4 w-4' />
                </Button>
              )}
            </div>
          </div>

          {/* ----------------------------- 表格 ----------------------------- */}
          <div className='relative overflow-auto rounded-md border bg-card'>
            <div className='overflow-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='hover:bg-transparent'>
                    <TableHead className='h-11 w-24 bg-card px-4 text-muted-foreground'>
                      {renderSortHeader('id', '组ID')}
                    </TableHead>
                    <TableHead className='h-11 bg-card px-4 text-muted-foreground'>
                      {renderSortHeader('name', '组名称')}
                    </TableHead>
                    <TableHead className='h-11 w-32 bg-card px-4 text-muted-foreground'>
                      {renderSortHeader('users_count', '用户数量')}
                    </TableHead>
                    <TableHead className='h-11 w-32 bg-card px-4 text-muted-foreground'>
                      {renderSortHeader('server_count', '节点数量')}
                    </TableHead>
                    <TableHead className='h-11 w-28 bg-card px-4 text-muted-foreground'>
                      <div className='flex items-center space-x-1 text-nowrap py-2 font-medium text-muted-foreground justify-end'>
                        <span>操作</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow className='animate-fade-in'>
                      <TableCell colSpan={5} className='h-24 text-center'>
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : paged.length > 0 ? (
                    paged.map((g) => (
                      <TableRow
                        key={g.id}
                        className='animate-fade-in hover:bg-muted/50'
                      >
                        <TableCell className='bg-card'>
                          <div className='flex items-center space-x-2'>
                            <Badge variant='outline'>{g.id}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className='bg-card'>
                          <div className='flex space-x-2'>
                            <span className='max-w-32 truncate font-medium'>
                              {g.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className='bg-card'>
                          <div className='flex items-center space-x-2 px-4'>
                            <UsersGlyph className='h-4 w-4' />
                            <span className='font-medium'>
                              {g.users_count ?? 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className='bg-card'>
                          <div className='flex items-center space-x-2 px-4'>
                            <ServerIcon className='h-4 w-4' />
                            <span className='font-medium'>
                              {g.server_count ?? 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className='bg-card'>
                          <div className='flex items-center justify-center'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:bg-muted'
                              onClick={() => {
                                setCurrent(g)
                                setMutateOpen(true)
                              }}
                            >
                              <Pencil1Icon className='h-4 w-4 text-muted-foreground hover:text-foreground' />
                              <span className='sr-only'>编辑权限组</span>
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                              onClick={() => setDeleting(g)}
                            >
                              <Trash2 className='h-4 w-4 text-muted-foreground hover:text-red-600 dark:hover:text-red-400' />
                              <span className='sr-only'>删除</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className='animate-fade-in'>
                      <TableCell colSpan={5} className='h-24 text-center'>
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ----------------------------- 分页 ----------------------------- */}
          <div className='flex flex-col-reverse gap-4 px-2 py-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex-1 text-sm text-muted-foreground'>
              已选择 0 项，共 {total} 项
            </div>
            <div className='flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8'>
              <div className='flex items-center space-x-2'>
                <p className='text-sm font-medium'>每页显示</p>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(v) => {
                    setPageSize(Number(v))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className='h-8 w-[70px]'>
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side='top'>
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={`${s}`}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center justify-center space-x-2 text-sm font-medium'>
                <span>第</span>
                <Input
                  type='text'
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={(e) => commitPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitPageInput(e.currentTarget.value)
                    }
                  }}
                  className='h-8 w-[50px] text-center'
                />
                <span>页，共 {maxPage} 页</span>
              </div>
              <div className='flex items-center space-x-2'>
                <Button
                  variant='outline'
                  className='hidden h-8 w-8 p-0 lg:flex'
                  onClick={() => setPage(1)}
                  disabled={safePage <= 1}
                >
                  <span className='sr-only'>跳转到第一页</span>
                  <DoubleArrowLeftIcon className='h-4 w-4' />
                </Button>
                <Button
                  variant='outline'
                  className='h-8 w-8 p-0'
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                >
                  <span className='sr-only'>上一页</span>
                  <ChevronLeftIcon className='h-4 w-4' />
                </Button>
                <Button
                  variant='outline'
                  className='h-8 w-8 p-0'
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= maxPage}
                >
                  <span className='sr-only'>下一页</span>
                  <ChevronRightIcon className='h-4 w-4' />
                </Button>
                <Button
                  variant='outline'
                  className='hidden h-8 w-8 p-0 lg:flex'
                  onClick={() => setPage(maxPage)}
                  disabled={safePage >= maxPage}
                >
                  <span className='sr-only'>跳转到最后一页</span>
                  <DoubleArrowRightIcon className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Main>

      <GroupMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除权限组'
        desc={`确定删除权限组「${deleting?.name}」吗？若已被节点、订阅或用户使用将无法删除。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
