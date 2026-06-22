import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
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
  toggleKnowledgeShow,
} from './api'
import { KnowledgeMutateDialog } from './components/knowledge-mutate-dialog'

function time(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

export function KnowledgePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<KnowledgeListItem | null>(null)
  const [deleting, setDeleting] = useState<KnowledgeListItem | null>(null)
  const [category, setCategory] = useState<string>('all')

  const { data, isLoading } = useQuery({
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
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['knowledge-list'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const categories = Array.from(new Set((data ?? []).map((k) => k.category)))
  const rows =
    category === 'all'
      ? data ?? []
      : (data ?? []).filter((k) => k.category === category)

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
            <h2 className='text-2xl font-bold tracking-tight'>知识库</h2>
            <p className='text-muted-foreground'>管理帮助文档与常见问题。</p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 新建文章
          </Button>
        </div>

        <div className='flex items-center gap-2'>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className='w-48'>
              <SelectValue />
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
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className='w-40'>分类</TableHead>
                <TableHead className='w-40'>更新时间</TableHead>
                <TableHead className='w-24'>显示</TableHead>
                <TableHead className='w-24 text-end'>操作</TableHead>
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
                rows.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.id}</TableCell>
                    <TableCell className='font-medium'>{k.title}</TableCell>
                    <TableCell>{k.category}</TableCell>
                    <TableCell className='text-xs'>{time(k.updated_at)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={k.show}
                        onCheckedChange={() => toggleMutation.mutate(k.id)}
                      />
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setCurrent(k)
                          setMutateOpen(true)
                        }}
                      >
                        <Pencil className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setDeleting(k)}
                      >
                        <Trash2 className='size-4 text-destructive' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    暂无文章
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
        title='删除文章'
        desc={`确定删除文章「${deleting?.title}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
