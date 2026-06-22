import { createFileRoute } from '@tanstack/react-router'
import { TrafficResetPage } from '@/features/traffic-reset'

export const Route = createFileRoute('/_authenticated/traffic-reset/')({
  component: TrafficResetPage,
})
