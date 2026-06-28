import { createFileRoute } from '@tanstack/react-router'
import { ResellerDashboardPage } from '@/features/reseller/dashboard'

export const Route = createFileRoute('/_authenticated/reseller/dashboard')({
  component: ResellerDashboardPage,
})
