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
  type Payment,
  dropPayment,
  fetchPayments,
  togglePayment,
} from './api'
import { PaymentMutateDialog } from './components/payment-mutate-dialog'

function fee(p: Payment) {
  const parts: string[] = []
  if (p.handling_fee_fixed) parts.push(`¥${(p.handling_fee_fixed / 100).toFixed(2)}`)
  if (p.handling_fee_percent) parts.push(`${p.handling_fee_percent}%`)
  return parts.length ? parts.join(' + ') : '-'
}

export function PaymentPage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Payment | null>(null)
  const [deleting, setDeleting] = useState<Payment | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: fetchPayments,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => togglePayment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropPayment(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['payments'] })
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
            <h2 className='text-2xl font-bold tracking-tight'>支付配置</h2>
            <p className='text-muted-foreground'>管理支付网关与手续费。</p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 新增支付方式
          </Button>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>网关</TableHead>
                <TableHead>手续费</TableHead>
                <TableHead className='w-24'>启用</TableHead>
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
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.id}</TableCell>
                    <TableCell className='font-medium'>{p.name}</TableCell>
                    <TableCell>{p.payment}</TableCell>
                    <TableCell>{fee(p)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={p.enable}
                        onCheckedChange={() => toggleMutation.mutate(p.id)}
                      />
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setCurrent(p)
                          setMutateOpen(true)
                        }}
                      >
                        <Pencil className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 className='size-4 text-destructive' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    暂无支付方式
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Main>

      <PaymentMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除支付方式'
        desc={`确定删除「${deleting?.name}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
