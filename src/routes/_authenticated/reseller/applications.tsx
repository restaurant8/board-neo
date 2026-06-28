import { createFileRoute } from '@tanstack/react-router'
import { ResellerApplicationsPage } from '@/features/reseller/applications'

export const Route = createFileRoute('/_authenticated/reseller/applications')({
  component: ResellerApplicationsPage,
})
