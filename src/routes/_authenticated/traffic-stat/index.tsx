import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TrafficStatPage } from '@/features/traffic-stat'

export const Route = createFileRoute('/_authenticated/traffic-stat/')({
  component: TrafficStatPage,
  validateSearch: z.object({
    /** 节点统计(diagnostics) / 用户审计(audit)，用于从侧栏或风控抽屉直达对应页签。 */
    tab: z.enum(['diagnostics', 'audit']).optional(),
    /** 预填用户邮箱/UID（如从连接与风控取证抽屉跳转过来）。 */
    user: z.string().optional(),
  }),
})
