import { createFileRoute } from '@tanstack/react-router'
import { TicketPage } from '@/features/ticket'

export const Route = createFileRoute('/_authenticated/ticket/')({
  component: TicketPage,
})
