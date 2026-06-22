import { createFileRoute } from '@tanstack/react-router'
import { GiftCardPage } from '@/features/gift-card'

export const Route = createFileRoute('/_authenticated/gift-card/')({
  component: GiftCardPage,
})
