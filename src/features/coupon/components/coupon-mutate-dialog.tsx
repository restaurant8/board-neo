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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type Coupon,
  COUPON_TYPE_AMOUNT,
  COUPON_TYPE_PERCENT,
  generateCoupon,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: Coupon | null
}

/** datetime-local 字符串 <-> unix 秒 */
function toLocalInput(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string) {
  return v ? Math.floor(new Date(v).getTime() / 1000) : 0
}

export function CouponMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [type, setType] = useState<number>(COUPON_TYPE_AMOUNT)
  const [value, setValue] = useState('') // 金额(元) 或 比例(%)
  const [code, setCode] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [endedAt, setEndedAt] = useState('')
  const [limitUse, setLimitUse] = useState('')
  const [limitUseWithUser, setLimitUseWithUser] = useState('')
  const [generateCount, setGenerateCount] = useState('')

  useEffect(() => {
    if (open) {
      setName(current?.name ?? '')
      setType(current?.type ?? COUPON_TYPE_AMOUNT)
      // 金额型展示为元
      setValue(
        current
          ? current.type === COUPON_TYPE_AMOUNT
            ? String(current.value / 100)
            : String(current.value)
          : ''
      )
      setCode(current?.code ?? '')
      setStartedAt(toLocalInput(current?.started_at))
      setEndedAt(toLocalInput(current?.ended_at))
      setLimitUse(current?.limit_use != null ? String(current.limit_use) : '')
      setLimitUseWithUser(
        current?.limit_use_with_user != null
          ? String(current.limit_use_with_user)
          : ''
      )
      setGenerateCount('')
    }
  }, [open, current])

  const mutation = useMutation({
    mutationFn: () => {
      const numValue =
        type === COUPON_TYPE_AMOUNT
          ? Math.round(Number(value) * 100) // 元 → 分
          : Math.round(Number(value)) // 百分比整数
      return generateCoupon({
        id: current?.id,
        name,
        type,
        value: numValue,
        started_at: fromLocalInput(startedAt),
        ended_at: fromLocalInput(endedAt),
        limit_use: limitUse ? Number(limitUse) : null,
        limit_use_with_user: limitUseWithUser
          ? Number(limitUseWithUser)
          : null,
        code: !isEdit && code ? code : undefined,
        generate_count:
          !isEdit && generateCount ? Number(generateCount) : undefined,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑优惠券' : '新增优惠券'}</DialogTitle>
          <DialogDescription>
            金额型单位为「元」，比例型为百分比。
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label>类型</Label>
              <Select
                value={String(type)}
                onValueChange={(v) => setType(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(COUPON_TYPE_AMOUNT)}>
                    金额
                  </SelectItem>
                  <SelectItem value={String(COUPON_TYPE_PERCENT)}>
                    比例
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-2'>
              <Label>
                {type === COUPON_TYPE_AMOUNT ? '金额（元）' : '比例（%）'}
              </Label>
              <Input
                type='number'
                step={type === COUPON_TYPE_AMOUNT ? '0.01' : '1'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label>开始时间</Label>
              <Input
                type='datetime-local'
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>结束时间</Label>
              <Input
                type='datetime-local'
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label>总可用次数</Label>
              <Input
                type='number'
                placeholder='留空不限'
                value={limitUse}
                onChange={(e) => setLimitUse(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>每用户可用次数</Label>
              <Input
                type='number'
                placeholder='留空不限'
                value={limitUseWithUser}
                onChange={(e) => setLimitUseWithUser(e.target.value)}
              />
            </div>
          </div>
          {!isEdit && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>券码</Label>
                <Input
                  placeholder='留空自动生成'
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!generateCount}
                />
              </div>
              <div className='grid gap-2'>
                <Label>批量生成数量</Label>
                <Input
                  type='number'
                  placeholder='单张留空，最大 500'
                  value={generateCount}
                  onChange={(e) => setGenerateCount(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name || !value}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
