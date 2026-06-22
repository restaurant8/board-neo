import { createFileRoute } from '@tanstack/react-router'
import { ServerManagePage } from '@/features/server-manage'

export const Route = createFileRoute('/_authenticated/server/manage/')({
  component: ServerManagePage,
})
