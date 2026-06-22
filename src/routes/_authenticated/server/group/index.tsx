import { createFileRoute } from '@tanstack/react-router'
import { ServerGroupPage } from '@/features/server-group'

export const Route = createFileRoute('/_authenticated/server/group/')({
  component: ServerGroupPage,
})
