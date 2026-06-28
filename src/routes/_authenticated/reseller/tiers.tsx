import { createFileRoute } from '@tanstack/react-router'
import { ResellerTiersPage } from '@/features/reseller/tiers'

export const Route = createFileRoute('/_authenticated/reseller/tiers')({
  component: ResellerTiersPage,
})
