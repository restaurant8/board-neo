import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { OrderPage } from '@/features/order'

const searchSchema = z.object({
  /** 页码（从 1 开始）。 */
  page: z.number().optional(),
  /** 每页条数。 */
  pageSize: z.number().optional(),
  /** 订单号搜索（trade_no like）。 */
  trade_no: z.string().optional(),
  /** 「TA的订单」跳转：按用户过滤，值形如 "eq:123"。 */
  user_id: z.string().optional(),
  /** 类型多选（值为 type 数字字符串）。 */
  type: z.array(z.string()).optional(),
  /** 周期多选（值为旧版周期键，如 month_price）。 */
  period: z.array(z.string()).optional(),
  /** 订单状态多选（值为 status 数字字符串）。 */
  status: z.array(z.string()).optional(),
  /** 佣金状态多选（值为 commission_status 数字字符串）。 */
  commission_status: z.array(z.string()).optional(),
  /** 仅看待处理佣金（后端 is_commission：有邀请人、未取消/未待支付、佣金>0）。 */
  is_commission: z.boolean().optional(),
  /** 排序，形如 "status.desc" / "created_at.asc"。 */
  sort: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/order/')({
  component: OrderPage,
  validateSearch: searchSchema,
})
