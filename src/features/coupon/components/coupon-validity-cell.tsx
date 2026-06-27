import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { type Coupon } from '../api'

/**
 * 有效期单元格（对齐原版 M6t）：
 * 彩色状态胶囊（已过期红 / 未开始黄 / 剩余绿）+ 起止时间，
 * 可展开查看完整起止时间。
 */
export function CouponValidityCell({ coupon }: { coupon: Coupon }) {
  const [open, setOpen] = useState(false)
  // 在 state 初始化器中快照当前时间（懒执行，满足纯函数 lint），与原版渲染时取值等价。
  const [now] = useState(() => Date.now())
  const start = coupon.started_at * 1000
  const end = coupon.ended_at * 1000

  const status = useMemo(() => {
    const expired = now > end
    const notStarted = now < start
    const remainingDays = Math.ceil((end - now) / 864e5)
    if (expired)
      return {
        label: `已过期${Math.abs(remainingDays)}天`,
        color: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
      }
    if (notStarted)
      return {
        label: `${Math.abs(Math.ceil((start - now) / 864e5))}天后开始`,
        color:
          'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400',
      }
    return {
      label: `剩余${remainingDays}天`,
      color:
        'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400',
    }
  }, [now, start, end])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className='group hover:bg-muted/40 -m-0.5 flex max-w-[280px] cursor-pointer items-center gap-2 rounded-md p-0.5 transition-colors'>
          <div className='flex flex-1 items-center gap-2'>
            <div
              className={cn(
                'rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
                status.color
              )}
            >
              {status.label}
            </div>
            <div className='text-muted-foreground flex min-w-0 items-center gap-1'>
              <div className='truncate text-xs'>
                {format(new Date(start), 'MM/dd HH:mm')}
              </div>
              <div className='shrink-0 opacity-30'>{'->'}</div>
              <div className='truncate text-xs'>
                {format(new Date(end), 'MM/dd HH:mm')}
              </div>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'text-muted-foreground/50 h-3.5 w-3.5 shrink-0 transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='px-0.5 pt-1.5 pb-0.5'>
          <div className='border-muted text-muted-foreground space-y-1.5 border-l-2 pl-3 text-xs'>
            <div className='flex items-center justify-between'>
              <span>开始时间</span>
              <span className='text-foreground font-medium'>
                {format(new Date(start), 'yyyy/MM/dd HH:mm')}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span>结束时间</span>
              <span className='text-foreground font-medium'>
                {format(new Date(end), 'yyyy/MM/dd HH:mm')}
              </span>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
