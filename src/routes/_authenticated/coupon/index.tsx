import { createFileRoute } from '@tanstack/react-router'
import { CouponPage } from '@/features/coupon'

export const Route = createFileRoute('/_authenticated/coupon/')({
  component: CouponPage,
})
