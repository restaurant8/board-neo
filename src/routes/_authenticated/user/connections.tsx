import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UserConnectionsPage } from '@/features/user-connections'

const searchSchema = z.object({
  /** 工作台一级 Tab：realtime（实时连接与风控）/ usage（历史使用记录）/ subscription（订阅访问风控）。 */
  tab: z.enum(['realtime', 'usage', 'subscription']).optional(),
  /** 从用户管理或其他页面跳转时携带的用户邮箱/UID/IP 过滤词。 */
  keyword: z.string().optional(),
  /** 精准定位的单个用户 ID（用于历史使用记录 / 订阅访问风控自动预填）。 */
  user_id: z.number().optional(),
  /** 从节点管理跳转时携带的节点 ID。 */
  server_id: z.number().optional(),
})

export const Route = createFileRoute('/_authenticated/user/connections')({
  component: UserConnectionsPage,
  validateSearch: searchSchema,
})
