import { createFileRoute } from '@tanstack/react-router'
import { PaymentPage } from '@/features/payment'

export const Route = createFileRoute('/_authenticated/payment/')({
  component: PaymentPage,
})
