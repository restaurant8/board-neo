import { createFileRoute } from '@tanstack/react-router'
import { ResellerSettlementsPage } from '@/features/reseller/settlements'

export const Route = createFileRoute('/_authenticated/reseller/settlements')({
  component: ResellerSettlementsPage,
})
