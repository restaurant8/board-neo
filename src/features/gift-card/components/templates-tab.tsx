import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type GiftCardTemplate,
  GIFT_CARD_TYPE_MAP,
  deleteTemplate,
  fetchTemplates,
} from '../api'
import { GenerateCodesDialog } from './generate-codes-dialog'
import { TemplateMutateDialog } from './template-mutate-dialog'

export function TemplatesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<GiftCardTemplate | null>(null)
  const [deleting, setDeleting] = useState<GiftCardTemplate | null>(null)
  const [genTemplate, setGenTemplate] = useState<number | null>(null)
  const [genOpen, setGenOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['gift-templates', page],
    queryFn: () => fetchTemplates({ page, per_page: 15 }),
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['gift-templates'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const rows = data?.data ?? []
  const lastPage = data?.last_page ?? 1

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex justify-end gap-2'>
        <Button
          variant='outline'
          onClick={() => {
            setGenTemplate(null)
            setGenOpen(true)
          }}
        >
          <Ticket className='size-4' /> 生成兑换码
        </Button>
        <Button
          onClick={() => {
            setCurrent(null)
            setMutateOpen(true)
          }}
        >
          <Plus className='size-4' /> 新建模板
        </Button>
      </div>

      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-16'>ID</TableHead>
              <TableHead>名称</TableHead>
              <TableHead className='w-28'>类型</TableHead>
              <TableHead className='w-20'>状态</TableHead>
              <TableHead className='w-24 text-end'>兑换码数</TableHead>
              <TableHead className='w-24 text-end'>已使用</TableHead>
              <TableHead className='w-36 text-end'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  加载中...
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell className='font-medium'>{t.name}</TableCell>
                  <TableCell>
                    {t.type_name ?? GIFT_CARD_TYPE_MAP[t.type] ?? t.type}
                  </TableCell>
                  <TableCell>
                    {t.status ? (
                      <Badge>启用</Badge>
                    ) : (
                      <Badge variant='secondary'>禁用</Badge>
                    )}
                  </TableCell>
                  <TableCell className='text-end'>
                    {t.codes_count ?? '-'}
                  </TableCell>
                  <TableCell className='text-end'>
                    {t.used_count ?? '-'}
                  </TableCell>
                  <TableCell className='text-end'>
                    <Button
                      variant='ghost'
                      size='icon'
                      title='生成兑换码'
                      onClick={() => {
                        setGenTemplate(t.id)
                        setGenOpen(true)
                      }}
                    >
                      <Ticket className='size-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => {
                        setCurrent(t)
                        setMutateOpen(true)
                      }}
                    >
                      <Pencil className='size-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 className='size-4 text-destructive' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  暂无模板
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

      <TemplateMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />
      <GenerateCodesDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        templateId={genTemplate}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除模板'
        desc={`确定删除模板「${deleting?.name}」吗？有兑换码时无法删除。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </div>
  )
}
