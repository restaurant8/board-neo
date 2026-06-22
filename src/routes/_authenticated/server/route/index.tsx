import { createFileRoute } from '@tanstack/react-router'
import { ServerRoutePage } from '@/features/server-route'

export const Route = createFileRoute('/_authenticated/server/route/')({
  component: ServerRoutePage,
})
