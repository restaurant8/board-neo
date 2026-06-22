import { createFileRoute } from '@tanstack/react-router'
import { NoticePage } from '@/features/notice'

export const Route = createFileRoute('/_authenticated/notice/')({
  component: NoticePage,
})
