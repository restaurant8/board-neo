import { createFileRoute } from '@tanstack/react-router'
import { UpdatePage } from '@/features/update'

export const Route = createFileRoute('/_authenticated/update/')({
  component: UpdatePage,
})
