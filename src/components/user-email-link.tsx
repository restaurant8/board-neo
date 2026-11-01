import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 用户邮箱：点击跳转到用户管理并按邮箱过滤（对齐原版订单详情）。
 * 位于弹窗内时传 onNavigate 关闭弹窗；位于可点击行内时会阻止事件冒泡。
 */
export function UserEmailLink({
  email,
  fallback = '-',
  onNavigate,
  className,
}: {
  email?: string | null
  fallback?: React.ReactNode
  onNavigate?: () => void
  className?: string
}) {
  if (!email) return <>{fallback}</>
  return (
    <Link
      to='/user'
      search={{ email }}
      onClick={(e) => {
        e.stopPropagation()
        onNavigate?.()
      }}
      className={cn('text-primary group break-all hover:underline', className)}
    >
      {email}
      <ExternalLink className='ms-1 inline size-3.5 align-[-2px] opacity-0 transition-opacity group-hover:opacity-100' />
    </Link>
  )
}
