import { createFileRoute } from '@tanstack/react-router'
import { ServerBackendPage } from '@/features/server-machine/backend-page'

export const Route = createFileRoute('/_authenticated/server/backend/')({
  component: ServerBackendPage,
})
