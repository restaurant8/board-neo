import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UserPage } from '@/features/user'

const searchSchema = z.object({
  /** 从其他页面（如订单详情）跳转时携带的邮箱，用于预填快速搜索。 */
  email: z.string().optional(),
  /** 「TA的邀请」跳转：只看被该用户 id 邀请的用户（invite_user_id）。 */
  invite_user_id: z.number().optional(),
})

export const Route = createFileRoute('/_authenticated/user/')({
  component: UserPage,
  validateSearch: searchSchema,
})
