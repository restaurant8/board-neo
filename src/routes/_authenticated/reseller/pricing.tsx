import { createFileRoute } from '@tanstack/react-router'
import { ResellerPricingPage } from '@/features/reseller/pricing'

export const Route = createFileRoute('/_authenticated/reseller/pricing')({
  component: ResellerPricingPage,
})
