import { createFileRoute } from '@tanstack/react-router'
import { ExternalNodesPage } from '@/features/external-nodes'

export const Route = createFileRoute('/_authenticated/server/external/')({
  component: ExternalNodesPage,
})
