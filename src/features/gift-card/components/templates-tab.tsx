import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
  type GiftCardTemplate,
  GIFT_CARD_TYPE_MAP,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
} from '../api'
import { GenerateCodesDialog } from './generate-codes-dialog'
import { SimplePagination } from './simple-pagination'
import { TemplateMutateDialog } from './template-mutate-dialog'

export function TemplatesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<GiftCardTemplate | null>(null)
  const [deleting, setDeleting] = useState<GiftCardTemplate | null>(null)
  const [genTemplate, setGenTemplate] = useState<number | null>(null)
  const [genOpen, setGenOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['gift-templates', page, pageSize],
    queryFn: () => fetchTemplates({ page, per_page: pageSize }),
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

  const statusMutation = useMutation({
    mutationFn: (t: GiftCardTemplate) =>
      updateTemplate({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        status: !t.status,
        conditions: t.conditions,
        rewards: t.rewards,
        limits: t.limits,
        special_config: t.special_config,
        icon: t.icon,
        background_image: t.background_image,
        theme_color: t.theme_color,
        sort: t.sort,
      }),
    onSuccess: () => {
      toast.success('模板更新成功')
      queryClient.invalidateQueries({ queryKey: ['gift-templates'] })
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
          <Plus className='size-4' /> 添加模板
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
              <TableHead className='w-72 text-end'>操作</TableHead>
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
                  <TableCell>
                    <Badge>{t.id}</Badge>
                  </TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {t.type_name ?? GIFT_CARD_TYPE_MAP[t.type] ?? t.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={t.status}
                      disabled={statusMutation.isPending}
                      onCheckedChange={() => statusMutation.mutate(t)}
                    />
                  </TableCell>
                  <TableCell className='text-end'>
                    {t.codes_count ?? '-'}
                  </TableCell>
                  <TableCell className='text-end'>
                    {t.used_count ?? '-'}
                  </TableCell>
                  <TableCell className='text-end'>
                    <div className='flex justify-end space-x-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setGenTemplate(t.id)
                          setGenOpen(true)
                        }}
                      >
                        <Ticket className='h-4 w-4' />
                        生成
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setCurrent(t)
                          setMutateOpen(true)
                        }}
                      >
                        <Pencil className='h-4 w-4' />
                        编辑
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setDeleting(t)}
                      >
                        <Trash2 className='h-4 w-4' />
                        删除
                      </Button>
                    </div>
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

      <SimplePagination
        page={page}
        totalPages={lastPage}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
      />

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
