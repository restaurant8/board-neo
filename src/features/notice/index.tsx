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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  toggleNoticeShow,
} from './api'
import { NoticeMutateDialog } from './components/notice-mutate-dialog'

export function NoticePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Notice | null>(null)
  const [deleting, setDeleting] = useState<Notice | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: fetchNotices,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleNoticeShow(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notices'] }),
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropNotice(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

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
            <h2 className='text-2xl font-bold tracking-tight'>公告管理</h2>
            <p className='text-muted-foreground'>管理站点公告与弹窗通知。</p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 新建公告
          </Button>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>标签</TableHead>
                <TableHead className='w-24'>显示</TableHead>
                <TableHead className='w-20'>弹窗</TableHead>
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
              ) : data && data.length > 0 ? (
                data.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{n.id}</TableCell>
                    <TableCell className='font-medium'>{n.title}</TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        {(n.tags ?? []).map((t) => (
                          <Badge key={t} variant='secondary'>
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!n.show}
                        onCheckedChange={() => toggleMutation.mutate(n.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {n.popup ? (
                        <Badge>是</Badge>
                      ) : (
                        <span className='text-muted-foreground'>否</span>
                      )}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setCurrent(n)
                          setMutateOpen(true)
                        }}
                      >
                        <Pencil className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setDeleting(n)}
                      >
                        <Trash2 className='size-4 text-destructive' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    暂无公告
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
        title='删除公告'
        desc={`确定删除公告「${deleting?.title}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
