import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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
  type Coupon,
  COUPON_TYPE_AMOUNT,
  COUPON_TYPE_BADGE_MAP,
  dropCoupon,
  fetchCoupons,
  toggleCouponShow,
} from './api'
import { CouponMutateDialog } from './components/coupon-mutate-dialog'
import { CouponValidityCell } from './components/coupon-validity-cell'

function couponValue(c: Coupon) {
  return c.type === COUPON_TYPE_AMOUNT
    ? `¥${(c.value / 100).toFixed(2)}`
    : `${c.value}%`
}

export function CouponPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Coupon | null>(null)
  const [deleting, setDeleting] = useState<Coupon | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', page, pageSize],
    queryFn: () => fetchCoupons({ current: page, pageSize }),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleCouponShow(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons'] }),
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropCoupon(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const rows = data?.data ?? []
  const lastPage = data?.last_page ?? 1

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
            <h2 className='text-2xl font-bold tracking-tight'>优惠券管理</h2>
            <p className='text-muted-foreground mt-2'>
              在这里可以查看优惠券，包括增加、查看、删除等操作。
            </p>
          </div>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 添加优惠券
          </Button>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead className='w-20'>启用</TableHead>
                <TableHead className='w-44'>卷名称</TableHead>
                <TableHead className='w-24'>类型</TableHead>
                <TableHead className='w-40'>卷码</TableHead>
                <TableHead className='w-24 text-end'>面值</TableHead>
                <TableHead className='w-24 text-end'>剩余次数</TableHead>
                <TableHead className='w-28 text-end'>可用次数/用户</TableHead>
                <TableHead>有效期</TableHead>
                <TableHead className='w-28 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge>{c.id}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!c.show}
                        onCheckedChange={() => toggleMutation.mutate(c.id)}
                      />
                    </TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {COUPON_TYPE_BADGE_MAP[c.type] ?? c.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary'>{c.code}</Badge>
                    </TableCell>
                    <TableCell className='text-end'>{couponValue(c)}</TableCell>
                    <TableCell className='text-end'>
                      <Badge variant='outline'>
                        {c.limit_use === null ? '无限次' : c.limit_use}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-end'>
                      <Badge variant='outline'>
                        {c.limit_use_with_user === null
                          ? '无限制'
                          : c.limit_use_with_user}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CouponValidityCell coupon={c} />
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end space-x-2'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='hover:bg-muted h-8 w-8'
                          onClick={() => {
                            setCurrent(c)
                            setMutateOpen(true)
                          }}
                        >
                          <Pencil className='text-muted-foreground hover:text-foreground h-4 w-4' />
                          <span className='sr-only'>编辑</span>
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900'
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 className='text-muted-foreground h-4 w-4 hover:text-red-600 dark:hover:text-red-400' />
                          <span className='sr-only'>删除</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className='h-24 text-center'>
                    暂无优惠券
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
      </Main>

      <CouponMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除优惠券'
        desc={`确定删除「${deleting?.name}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
