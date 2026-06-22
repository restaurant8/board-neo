import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/order'

export const Route = createFileRoute('/_authenticated/order/')({
  component: OrderPage,
})
