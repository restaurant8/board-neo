import { createFileRoute } from '@tanstack/react-router'
import { ServerDnsPage } from '@/features/server-dns'

export const Route = createFileRoute('/_authenticated/server/dns/')({
  component: ServerDnsPage,
})
