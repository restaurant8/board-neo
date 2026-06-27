import { useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  type KnowledgeListItem,
  dropKnowledge,
  fetchKnowledge,
  sortKnowledge,
  toggleKnowledgeShow,
} from './api'
import { KnowledgeMutateDialog } from './components/knowledge-mutate-dialog'

export function KnowledgePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<KnowledgeListItem | null>(null)
  const [deleting, setDeleting] = useState<KnowledgeListItem | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [isSortMode, setIsSortMode] = useState(false)
  const [order, setOrder] = useState<KnowledgeListItem[] | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const { data } = useQuery({
    queryKey: ['knowledge-list'],
    queryFn: fetchKnowledge,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleKnowledgeShow(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['knowledge-list'] }),
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropKnowledge(id),
    onSuccess: () => {
      toast.success('操作成功')
      queryClient.invalidateQueries({ queryKey: ['knowledge-list'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const sortMutation = useMutation({
    mutationFn: (ids: number[]) => sortKnowledge(ids),
    onSuccess: () => {
      toast.success('排序保存成功')
      queryClient.invalidateQueries({ queryKey: ['knowledge-list'] })
      setIsSortMode(false)
      setOrder(null)
    },
    onError: handleServerError,
  })

  const categories = useMemo(
    () => Array.from(new Set((data ?? []).map((k) => k.category))),
    [data]
  )

  const baseRows = order ?? data ?? []
  const rows = isSortMode
    ? baseRows
    : baseRows.filter((k) => {
        const matchesSearch = k.title
          .toLowerCase()
          .includes(search.toLowerCase())
        const matchesCategory = category === 'all' || k.category === category
        return matchesSearch && matchesCategory
      })

  const hasFilters = search !== '' || category !== 'all'

  const handleSaveOrder = () => {
    if (isSortMode) {
      sortMutation.mutate((order ?? data ?? []).map((k) => k.id))
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
            <h2 className='mb-2 text-2xl font-bold tracking-tight'>知识库管理</h2>
            <p className='text-muted-foreground'>
              在这里可以配置知识库，包括添加、删除、编辑等操作。
            </p>
          </div>
        </div>

        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          <div className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              {isSortMode ? (
                <p className='text-sm text-muted-foreground'>
                  拖拽知识条目进行排序，完成后点击保存
                </p>
              ) : (
                <div className='flex flex-wrap items-center gap-2 sm:flex-nowrap'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='space-x-2'
                    onClick={() => {
                      setCurrent(null)
                      setMutateOpen(true)
                    }}
                  >
                    <Plus className='h-4 w-4' /> <div>添加知识</div>
                  </Button>
                  <Input
                    placeholder='搜索知识...'
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className='h-8 w-full sm:w-[150px] lg:w-[250px]'
                  />
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className='h-8 w-auto min-w-[120px] border-dashed'>
                      <SelectValue placeholder='分类' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>全部分类</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasFilters && (
                    <Button
                      variant='ghost'
                      onClick={() => {
                        setSearch('')
                        setCategory('all')
                      }}
                    >
                      重置
                      <X className='ml-2 h-4 w-4' />
                    </Button>
                  )}
                </div>
              )}
              {rows.length > 0 && (
                <div className='hidden items-center gap-2 md:flex'>
                  <Button
                    variant={isSortMode ? 'default' : 'outline'}
                    onClick={handleSaveOrder}
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
                    <TableHead className='w-[70px]'>ID</TableHead>
                    <TableHead className='w-[100px]'>状态</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead className='w-48'>分类</TableHead>
                    {!isSortMode && (
                      <TableHead className='w-[100px] text-end'>操作</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((k, index) => (
                      <TableRow
                        key={k.id}
                        draggable={isSortMode}
                        onDragStart={() => isSortMode && setDragIndex(index)}
                        onDragOver={(e) => isSortMode && e.preventDefault()}
                        onDrop={() => isSortMode && handleDrop(index)}
                        className={cn(isSortMode && 'cursor-move')}
                      >
                        {isSortMode && (
                          <TableCell>
                            <div className='flex items-center justify-center'>
                              <GripVertical className='size-4 cursor-move text-muted-foreground' />
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className='flex items-center space-x-2'>
                            <Badge variant='outline' className='font-mono'>
                              {k.id}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center'>
                            <Switch
                              checked={k.show}
                              onCheckedChange={() => toggleMutation.mutate(k.id)}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex space-x-2'>
                            <span className='line-clamp-2 font-medium'>
                              {k.title}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant='secondary'
                            className='max-w-[180px] truncate'
                          >
                            {k.category}
                          </Badge>
                        </TableCell>
                        {!isSortMode && (
                          <TableCell className='text-end'>
                            <div className='flex items-center justify-end space-x-1'>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8 hover:bg-muted'
                                onClick={() => {
                                  setCurrent(k)
                                  setMutateOpen(true)
                                }}
                              >
                                <Pencil className='h-4 w-4 text-muted-foreground hover:text-foreground' />
                                <span className='sr-only'>编辑知识</span>
                              </Button>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                                onClick={() => setDeleting(k)}
                              >
                                <Trash2 className='h-4 w-4 text-muted-foreground hover:text-red-600 dark:hover:text-red-400' />
                                <span className='sr-only'>删除</span>
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={isSortMode ? 5 : 6}
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

      <KnowledgeMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='确认删除'
        desc='此操作将永久删除该知识库记录，删除后无法恢复。确定要继续吗？'
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
