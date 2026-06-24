import { createFileRoute } from '@tanstack/react-router'
import { TrafficStatPage } from '@/features/traffic-stat'

export const Route = createFileRoute('/_authenticated/traffic-stat/')({
  component: TrafficStatPage,
})
