import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TicketPage } from '@/features/ticket'

const searchSchema = z.object({
  /** 初始状态筛选：0 开启(待处理) / 1 关闭。URL 中会被解析为数字，coerce 回字符串。 */
  status: z.coerce.string().optional(),
})

export const Route = createFileRoute('/_authenticated/ticket/')({
  component: TicketPage,
  validateSearch: searchSchema,
})
