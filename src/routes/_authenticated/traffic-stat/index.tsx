import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TrafficStatPage } from '@/features/traffic-stat'

export const Route = createFileRoute('/_authenticated/traffic-stat/')({
  component: TrafficStatPage,
  validateSearch: z.object({
    /** 节点统计(diagnostics) / 用户审计(audit)，用于从侧栏直达对应页签。 */
    tab: z.enum(['diagnostics', 'audit']).optional(),
  }),
})
