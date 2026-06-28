import { createFileRoute } from '@tanstack/react-router'
import { ResellerPage } from '@/features/reseller'

export const Route = createFileRoute('/_authenticated/reseller/')({
  component: ResellerPage,
})
