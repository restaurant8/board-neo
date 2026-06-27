import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Notice,
  dropNotice,
  fetchNotices,
  sortNotices,
  toggleNoticeShow,
} from './api'
import { NoticeMutateDialog } from './components/notice-mutate-dialog'

export function NoticePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Notice | null>(null)
  const [deleting, setDeleting] = useState<Notice | null>(null)
  const [search, setSearch] = useState('')
  const [isSortMode, setIsSortMode] = useState(false)
  const [order, setOrder] = useState<Notice[] | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const { data } = useQuery({
    queryKey: ['notices'],
    queryFn: fetchNotices,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleNoticeShow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropNotice(id),
    onSuccess: () => {
      toast.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const sortMutation = useMutation({
    mutationFn: (ids: number[]) => sortNotices(ids),
    onSuccess: () => {
      toast.success('排序保存成功')
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      setIsSortMode(false)
      setOrder(null)
    },
    onError: handleServerError,
  })

  const baseRows = order ?? data ?? []
  const rows = isSortMode
    ? baseRows
    : baseRows.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase())
      )

  const handleSaveOrder = () => {
    if (isSortMode) {
      sortMutation.mutate((order ?? data ?? []).map((n) => n.id))
    } else {
      setOrder(data ?? [])
      setIsSortMode(true)
    }
  }

  const handleDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) return
    const next = [...(order ?? data ?? [])]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(target, 0, moved)
    setOrder(next)
    setDragIndex(null)
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col' fixed>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <div className='mb-2'>
              <h2 className='text-2xl font-bold tracking-tight'>公告管理</h2>
            </div>
            <p className='text-muted-foreground'>
              在这里可以配置公告，包括添加、删除、编辑等操作。
            </p>
          </div>
        </div>

        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          <div className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex flex-1 flex-wrap items-center gap-2 sm:flex-nowrap'>
                {!isSortMode && (
                  <Button
                    variant='outline'
                    size='sm'
                    className='space-x-2'
                    onClick={() => {
                      setCurrent(null)
                      setMutateOpen(true)
                    }}
                  >
                    <Plus className='h-4 w-4' /> <div>添加公告</div>
                  </Button>
                )}
                {!isSortMode && (
                  <Input
                    placeholder='搜索公告标题...'
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className='h-8 w-full min-w-[150px] sm:w-[150px] lg:w-[250px]'
                  />
                )}
                {search !== '' && !isSortMode && (
                  <Button
                    variant='ghost'
                    onClick={() => setSearch('')}
                    className='h-9 px-2 lg:px-3'
                  >
                    重置
                    <X className='ml-2 h-4 w-4' />
                  </Button>
                )}
              </div>
              {rows.length > 0 && (
                <div className='hidden items-center space-x-2 md:flex'>
                  <Button
                    variant={isSortMode ? 'default' : 'outline'}
                    onClick={handleSaveOrder}
                    className='h-8'
                    size='sm'
                  >
                    {isSortMode ? '保存排序' : '编辑排序'}
                  </Button>
                </div>
              )}
            </div>

            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSortMode && <TableHead className='w-10' />}
                    <TableHead className='w-[60px]'>ID</TableHead>
                    <TableHead className='w-[100px]'>显示状态</TableHead>
                    <TableHead>标题</TableHead>
                    {!isSortMode && <TableHead className='w-48'>标签</TableHead>}
                    {!isSortMode && (
                      <TableHead className='w-20'>弹窗</TableHead>
                    )}
                    {!isSortMode && (
                      <TableHead className='w-[100px] text-end'>操作</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((n, index) => (
                      <TableRow
                        key={n.id}
                        draggable={isSortMode}
                        onDragStart={() => isSortMode && setDragIndex(index)}
                        onDragOver={(e) => isSortMode && e.preventDefault()}
                        onDrop={() => isSortMode && handleDrop(index)}
                        className={cn(isSortMode && 'cursor-move')}
                      >
                        {isSortMode && (
                          <TableCell>
                            <div className='flex items-center justify-center'>
                              <GripVertical className='h-4 w-4 cursor-move text-muted-foreground' />
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className='flex items-center space-x-2'>
                            <Badge variant='outline' className='font-mono'>
                              {n.id}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center'>
                            <Switch
                              checked={!!n.show}
                              onCheckedChange={() => toggleMutation.mutate(n.id)}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex max-w-[500px] items-center'>
                            <span className='truncate font-medium'>
                              {n.title}
                            </span>
                          </div>
                        </TableCell>
                        {!isSortMode && (
                          <TableCell>
                            <div className='flex flex-wrap gap-1'>
                              {(n.tags ?? []).map((t) => (
                                <Badge key={t} variant='secondary'>
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        )}
                        {!isSortMode && (
                          <TableCell>
                            {n.popup ? (
                              <Badge>是</Badge>
                            ) : (
                              <span className='text-muted-foreground'>否</span>
                            )}
                          </TableCell>
                        )}
                        {!isSortMode && (
                          <TableCell className='text-end'>
                            <div className='flex items-center justify-end space-x-2'>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8 hover:bg-muted'
                                onClick={() => {
                                  setCurrent(n)
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
                                onClick={() => setDeleting(n)}
                              >
                                <Trash2 className='h-4 w-4 text-muted-foreground hover:text-red-600 dark:hover:text-red-400' />
                                <span className='sr-only'>删除确认</span>
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={isSortMode ? 4 : 6}
                        className='h-24 text-center'
                      >
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Main>

      <NoticeMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除确认'
        desc='确定要删除该条公告吗？此操作无法撤销。'
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
