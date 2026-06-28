import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type ResellerApplication,
  reviewResellerApplication,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: ResellerApplication | null
  action: 'approve' | 'reject'
}

export function ApplicationReviewDialog({
  open,
  onOpenChange,
  application,
  action,
}: Props) {
  const queryClient = useQueryClient()
  const isApprove = action === 'approve'
  const [domain, setDomain] = useState('')
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (open) {
      setDomain(application?.desired_domain ?? '')
      setRemark('')
    }
  }, [open, application])

  const mutation = useMutation({
    mutationFn: () =>
      reviewResellerApplication({
        id: application!.id,
        action,
        domain: isApprove ? domain || null : undefined,
        review_remark: remark || null,
      }),
    onSuccess: () => {
      toast.success(isApprove ? '已通过，分站已创建' : '已拒绝')
      queryClient.invalidateQueries({ queryKey: ['reseller-applications'] })
      queryClient.invalidateQueries({ queryKey: ['reseller-sites'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <DialogHeader className='border-b bg-muted/20 px-6 pb-4 pt-6'>
          <DialogTitle className='font-mono text-lg tracking-tight'>
            {isApprove ? '通过申请' : '拒绝申请'}
          </DialogTitle>
          <DialogDescription className='font-mono text-xs opacity-70'>
            {isApprove
              ? '通过后将自动创建分站，并把该用户设为站长。'
              : '拒绝该用户的成为站长申请。'}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 px-6 py-4 font-mono'>
          <div className='rounded-md border bg-muted/20 p-3 text-xs'>
            <div>申请人：{application?.user_email ?? `#${application?.user_id}`}</div>
            <div>期望分站名：{application?.desired_name}</div>
            {application?.contact && <div>联系方式：{application.contact}</div>}
            {application?.remark && <div>理由：{application.remark}</div>}
          </div>
          {isApprove && (
            <div className='space-y-2'>
              <Label className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                绑定域名（可改，留空表示暂不绑定）
              </Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder='如：shop.example.com'
                className='h-9 font-mono text-xs'
              />
            </div>
          )}
          <div className='space-y-2'>
            <Label className='text-[11px] uppercase tracking-wider text-muted-foreground'>
              审批备注（选填）
            </Label>
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className='h-9 font-mono text-xs'
            />
          </div>
        </div>
        <DialogFooter className='border-t bg-muted/20 px-6 py-4'>
          <div className='flex w-full items-center justify-end gap-3'>
            <Button
              type='button'
              variant='ghost'
              className='h-8 px-4 font-mono text-xs font-bold'
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              取消
            </Button>
            <Button
              type='button'
              variant={isApprove ? 'default' : 'destructive'}
              className='h-8 px-8 font-mono text-xs font-bold'
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {isApprove ? '确认通过' : '确认拒绝'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
