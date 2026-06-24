import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { OrderPage } from '@/features/order'

const searchSchema = z.object({
  /** 仅看待处理佣金（后端 is_commission：有邀请人、状态非取消/待支付、佣金>0）。 */
  is_commission: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/order/')({
  component: OrderPage,
  validateSearch: searchSchema,
})
