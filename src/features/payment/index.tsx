import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Copy, HelpCircle } from 'lucide-react'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
            <p className='mt-2 text-muted-foreground'>
              在这里可以配置支付方式，包括支付宝、微信等。
            </p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 添加支付方式
          </Button>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead>支付接口</TableHead>
                <TableHead>手续费</TableHead>
                <TableHead>
                  <div className='flex items-center'>
                    <span>通知地址</span>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger className='ml-1'>
                        <HelpCircle className='h-4 w-4 text-muted-foreground' />
                      </TooltipTrigger>
                      <TooltipContent>
                        支付网关将会把数据通知到本地址，请通过防火墙放行本地址。
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className='w-24'>启用</TableHead>
                <TableHead className='w-28 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : data && data.length > 0 ? (
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Badge variant='outline' className='font-mono'>
                        {p.id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className='block max-w-[200px] truncate font-medium'>
                        {p.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className='block max-w-[200px] truncate font-medium'>
                        {p.payment}
                      </span>
                    </TableCell>
                    <TableCell>{fee(p)}</TableCell>
                    <TableCell>
                      {p.notify_url ? (
                        <div className='group/url flex items-center gap-1'>
                          <span className='max-w-[260px] truncate font-medium'>
                            {p.notify_url}
                          </span>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-6 shrink-0 text-muted-foreground/40 opacity-0 transition-all duration-200 hover:text-muted-foreground group-hover/url:opacity-100'
                            onClick={() => {
                              navigator.clipboard.writeText(p.notify_url!)
                              toast.success('复制成功')
                            }}
                          >
                            <Copy className='size-3' />
                          </Button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.enable}
                        onCheckedChange={() => toggleMutation.mutate(p.id)}
                      />
                    </TableCell>
                    <TableCell className='text-end'>
                      <div className='flex items-center justify-end space-x-2'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8 hover:bg-muted'
                          onClick={() => {
                            setCurrent(p)
                            setMutateOpen(true)
                          }}
                        >
                          <Pencil className='h-4 w-4 text-muted-foreground hover:text-foreground' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8 hover:bg-destructive hover:text-destructive-foreground'
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className='h-4 w-4 text-muted-foreground' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className='h-24 text-center'>
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
        title='删除确认'
        desc='确定要删除该支付方式吗？此操作无法撤销。'
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
