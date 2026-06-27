import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Pencil,
  Plus,
  Search,
  Server as ServerIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { type ServerGroup, dropServerGroup, fetchServerGroups } from './api'
import { GroupMutateDialog } from './components/group-mutate-dialog'

type SortKey = 'id' | 'name' | 'users_count' | 'server_count'
type SortDir = 'asc' | 'desc'

export function ServerGroupPage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<ServerGroup | null>(null)
  const [deleting, setDeleting] = useState<ServerGroup | null>(null)
  const [selected, setSelected] = useState<number[]>([])

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
    return groups.filter(
      (g) => g.name.toLowerCase().includes(kw) || String(g.id).includes(kw)
    )
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

  const allSelected =
    paged.length > 0 && paged.every((g) => selected.includes(g.id))
  const toggleSelectAll = (checked: boolean) =>
    setSelected(checked ? paged.map((g) => g.id) : [])
  const toggleSelect = (id: number, checked: boolean) =>
    setSelected((s) => (checked ? [...s, id] : s.filter((x) => x !== id)))

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
        <ArrowUp className='size-3.5' />
      ) : (
        <ArrowDown className='size-3.5' />
      )
    ) : (
      <ChevronsUpDown className='size-3.5 opacity-50' />
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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>权限组管理</h2>
            <p className='text-muted-foreground'>
              管理所有权限组，包括添加、删除、编辑等操作。
            </p>
          </div>
        </div>

        {/* ----------------------------- 工具栏 ----------------------------- */}
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            size='sm'
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 添加权限组
          </Button>
          <div className='relative w-full max-w-xs'>
            <Search className='text-muted-foreground absolute start-2 top-1/2 size-4 -translate-y-1/2' />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder='搜索权限组...'
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
                <TableHead className='w-24'>
                  <button
                    type='button'
                    className='hover:text-foreground -ms-1 inline-flex items-center gap-1 rounded px-1'
                    onClick={() => toggleSort('id')}
                  >
                    组ID
                    {sortIcon('id')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type='button'
                    className='hover:text-foreground -ms-1 inline-flex items-center gap-1 rounded px-1'
                    onClick={() => toggleSort('name')}
                  >
                    组名称
                    {sortIcon('name')}
                  </button>
                </TableHead>
                <TableHead className='w-36'>
                  <button
                    type='button'
                    className='hover:text-foreground -ms-1 inline-flex items-center gap-1 rounded px-1'
                    onClick={() => toggleSort('users_count')}
                  >
                    用户数量
                    {sortIcon('users_count')}
                  </button>
                </TableHead>
                <TableHead className='w-36'>
                  <button
                    type='button'
                    className='hover:text-foreground -ms-1 inline-flex items-center gap-1 rounded px-1'
                    onClick={() => toggleSort('server_count')}
                  >
                    节点数量
                    {sortIcon('server_count')}
                  </button>
                </TableHead>
                <TableHead className='w-28 text-end'>操作</TableHead>
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
                paged.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(g.id)}
                        onCheckedChange={(c) => toggleSelect(g.id, !!c)}
                        aria-label={`选择 ${g.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>{g.id}</Badge>
                    </TableCell>
                    <TableCell className='font-medium'>{g.name}</TableCell>
                    <TableCell>
                      <span className='flex items-center gap-2 px-2'>
                        <Users className='text-muted-foreground size-4' />
                        <span className='font-medium'>{g.users_count ?? 0}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className='flex items-center gap-2 px-2'>
                        <ServerIcon className='text-muted-foreground size-4' />
                        <span className='font-medium'>
                          {g.server_count ?? 0}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setCurrent(g)
                          setMutateOpen(true)
                        }}
                      >
                        <Pencil className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setDeleting(g)}
                      >
                        <Trash2 className='text-destructive size-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    暂无权限组
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
