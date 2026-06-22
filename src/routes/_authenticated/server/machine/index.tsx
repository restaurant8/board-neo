import { createFileRoute } from '@tanstack/react-router'
import { ServerMachinePage } from '@/features/server-machine'

export const Route = createFileRoute('/_authenticated/server/machine/')({
  component: ServerMachinePage,
})
