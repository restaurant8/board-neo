import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UserPage } from '@/features/user'

const searchSchema = z.object({
  /** 从其他页面（如订单详情）跳转时携带的邮箱，用于预填快速搜索。 */
  email: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/user/')({
  component: UserPage,
  validateSearch: searchSchema,
})
