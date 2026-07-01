import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
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
  type ResellerApplication,
  fetchResellerApplications,
  markDepositRefunded,
} from './api'
import { ApplicationReviewDialog } from './components/application-review-dialog'

const STATUS_MAP: Record<
  ResellerApplication['status'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  pending: { label: '待审批', variant: 'default' },
  approved: { label: '已通过', variant: 'secondary' },
  rejected: { label: '已拒绝', variant: 'destructive' },
}

const yuan = (cents: number) => (cents / 100).toFixed(2)

export function ResellerApplicationsPage() {
  const queryClient = useQueryClient()
  const [reviewing, setReviewing] = useState<ResellerApplication | null>(null)
  const [action, setAction] = useState<'approve' | 'reject'>('approve')

  const { data } = useQuery({
    queryKey: ['reseller-applications'],
    queryFn: () => fetchResellerApplications(),
  })

  const markMutation = useMutation({
    mutationFn: (v: { id: number; refunded: boolean }) =>
      markDepositRefunded(v.id, v.refunded),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['reseller-applications'] })
    },
    onError: handleServerError,
  })

  const rows = data ?? []

  const openReview = (app: ResellerApplication, act: 'approve' | 'reject') => {
    setReviewing(app)
    setAction(act)
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
              <h2 className='text-2xl font-bold tracking-tight'>站长申请</h2>
            </div>
            <p className='text-muted-foreground'>
              审批用户提交的成为站长申请。通过后将自动创建分站并把该用户设为站长。
            </p>
          </div>
        </div>

        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[60px]'>ID</TableHead>
                  <TableHead className='w-[110px]'>状态</TableHead>
                  <TableHead>申请人</TableHead>
                  <TableHead>期望分站名</TableHead>
                  <TableHead>期望域名</TableHead>
                  <TableHead className='w-[160px]'>押金</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead className='w-[140px] text-end'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Badge variant='outline' className='font-mono'>
                          {a.id}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_MAP[a.status].variant}>
                          {STATUS_MAP[a.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className='font-mono text-xs'>
                          {a.user_email ?? `#${a.user_id}`}
                        </span>
                      </TableCell>
                      <TableCell>{a.desired_name}</TableCell>
                      <TableCell>
                        <span className='font-mono text-xs text-muted-foreground'>
                          {a.desired_domain ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {a.deposit_amount > 0 ? (
                          <div className='flex items-center gap-2'>
                            <span className='font-mono text-xs'>
                              ¥{yuan(a.deposit_amount)}
                            </span>
                            {a.deposit_refunded_at ? (
                              <button
                                type='button'
                                title='点击撤销（改回未退）'
                                onClick={() =>
                                  markMutation.mutate({
                                    id: a.id,
                                    refunded: false,
                                  })
                                }
                              >
                                <Badge variant='secondary'>已退</Badge>
                              </button>
                            ) : (
                              <Button
                                variant='outline'
                                size='sm'
                                className='h-6 px-2 text-xs'
                                disabled={markMutation.isPending}
                                onClick={() =>
                                  markMutation.mutate({
                                    id: a.id,
                                    refunded: true,
                                  })
                                }
                              >
                                标记已退
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className='text-xs text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className='font-mono text-xs text-muted-foreground'>
                          {a.contact ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className='text-end'>
                        {a.status === 'pending' ? (
                          <div className='flex items-center justify-end space-x-2'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:bg-green-100 dark:hover:bg-green-900'
                              onClick={() => openReview(a, 'approve')}
                            >
                              <Check className='h-4 w-4 text-muted-foreground hover:text-green-600' />
                              <span className='sr-only'>通过</span>
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                              onClick={() => openReview(a, 'reject')}
                            >
                              <X className='h-4 w-4 text-muted-foreground hover:text-red-600' />
                              <span className='sr-only'>拒绝</span>
                            </Button>
                          </div>
                        ) : (
                          <span className='text-xs text-muted-foreground'>
                            {a.review_remark || '已处理'}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className='h-24 text-center'>
                      暂无申请
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Main>

      <ApplicationReviewDialog
        open={!!reviewing}
        onOpenChange={(o) => !o && setReviewing(null)}
        application={reviewing}
        action={action}
      />
    </>
  )
}
