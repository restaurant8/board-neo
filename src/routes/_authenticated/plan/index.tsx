import { createFileRoute } from '@tanstack/react-router'
import { PlanPage } from '@/features/plan'

export const Route = createFileRoute('/_authenticated/plan/')({
  component: PlanPage,
})
